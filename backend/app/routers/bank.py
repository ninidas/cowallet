import datetime
import hmac
import secrets
import time
from typing import Annotated, Optional, List

from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, enablebanking, bank_sync
from ..auth import get_current_user, get_current_group
from ..limiter import client_ip

router = APIRouter(prefix="/bank", tags=["bank"])


def _require_enablebanking():
    if not enablebanking.is_configured():
        raise HTTPException(status_code=503, detail="Enable Banking not configured on this server")


EXPIRES_SOON_DAYS = 14


def _consent(conn) -> dict:
    """Échéance de l'accès bancaire (la banque le coupe au bout de 90 à 180 jours)."""
    info = enablebanking.consent_info(conn.saltedge_connection_id)
    if not info:
        return {}
    vu = info["valid_until"]
    days = (vu - datetime.date.today()).days if vu else None
    return {
        "expired":       info["expired"],
        "valid_until":   vu.isoformat() if vu else None,
        "expires_soon":  (not info["expired"]) and days is not None and days <= EXPIRES_SOON_DAYS,
    }


# ── Schemas ────────────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    return_to:    str
    aspsp_name:   str
    aspsp_country: str = "FR"

class FinishRequest(BaseModel):
    auth_code: Annotated[str, Field(max_length=500)]
    state:     Annotated[str, Field(max_length=100)] = ""


# Une connexion commencée et jamais terminée ne peut plus être finalisée au bout de 30 minutes
PENDING_MAX_SECONDS = 30 * 60


def _check_return_to(return_to: str, request: Request) -> str:
    """Le retour de la banque ne peut ramener que sur la page /bank/callback de cette même instance."""
    url = urlsplit(return_to)
    host = request.headers.get("host", "")
    if url.scheme not in ("https", "http") or url.path != "/bank/callback" or url.query or url.fragment \
            or not host or url.netloc.lower() != host.lower():
        raise HTTPException(status_code=400, detail="Invalid return URL")
    return f"{url.scheme}://{url.netloc}/bank/callback"

class TransactionImportItem(BaseModel):
    saltedge_id:  Annotated[str, Field(min_length=1, max_length=200)]
    date:         Annotated[str, Field(max_length=10)]
    description:  Annotated[str, Field(max_length=300)]
    amount:       float
    account_name: Annotated[str, Field(max_length=120)]
    is_card:      bool = False
    is_debit:     bool = True
    detail:        Optional[Annotated[str, Field(max_length=200)]] = None
    card_last4:    Optional[Annotated[str, Field(max_length=4)]] = None
    purchase_date: Optional[Annotated[str, Field(max_length=10)]] = None

class ImportTransactionsRequest(BaseModel):
    month_id:     int
    transactions: List[TransactionImportItem]

class CategorizeRequest(BaseModel):
    category: Optional[Annotated[str, Field(max_length=60)]] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/aspsps")
def list_aspsps(
    country: str = "FR",
    user: models.User = Depends(get_current_user),
):
    """Liste les banques disponibles pour un pays donné."""
    _require_enablebanking()
    try:
        aspsps = enablebanking.get_aspsps(country)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enable Banking error: {exc}")
    return aspsps


@router.get("/status")
def get_status(
    consent: bool         = True,
    db:      Session      = Depends(get_db),
    user:    models.User  = Depends(get_current_user),
):
    """Retourne l'état de la connexion bancaire de l'utilisateur.
    consent=false : sans l'échéance de l'accès, qui demande Enable Banking (parfois lent) ;
    l'écran s'affiche avec ça puis complète."""
    if not enablebanking.is_configured():
        return {"configured": False}

    conn = db.query(models.BankConnection).filter_by(user_id=user.id, status="active").first()
    if not conn:
        return {"configured": True, "connected": False}

    accounts = db.query(models.BankAccount).filter_by(connection_id=conn.id).all()
    return {
        "configured":    True,
        "connected":     True,
        **(_consent(conn) if consent else {}),
        "no_accounts":   not accounts,
        "provider_name": conn.provider_name,
        "accounts": [
            {"id": a.id, "name": a.name, "nature": a.nature, "currency": a.currency, "enabled": a.enabled}
            for a in accounts
        ],
    }


@router.post("/connect")
def start_connect(
    body: ConnectRequest,
    request: Request,
    db:   Session      = Depends(get_db),
    user: models.User  = Depends(get_current_user),
):
    """Démarre le flux Enable Banking. Retourne un url à ouvrir côté frontend."""
    _require_enablebanking()
    return_to = _check_return_to(body.return_to, request)

    # Supprime une éventuelle connexion pending précédente
    existing = db.query(models.BankConnection).filter_by(user_id=user.id, status="pending").first()
    if existing:
        db.delete(existing)
        db.commit()

    try:
        # « state » revient avec le code de la banque : il prouve que le retour appartient à ce
        # parcours, commencé par ce compte (sans lui, un lien piégé pouvait relier la banque d'un autre)
        state = secrets.token_urlsafe(32)
        result = enablebanking.start_auth(body.aspsp_name, body.aspsp_country, return_to, state)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enable Banking error: {exc}")

    # Stocke la connexion en état pending avec l'auth_code
    auth_code = result.get("auth_code") or result.get("code", "")
    conn = models.BankConnection(
        user_id=user.id,
        saltedge_customer_id=auth_code,   # réutilisé pour stocker l'auth_code
        provider_name=body.aspsp_name,
        provider_code=body.aspsp_country,
        status="pending",
        oauth_state=f"{state}|{int(time.time())}",
    )
    db.add(conn)
    db.commit()

    connect_url = result.get("url") or result.get("connect_url", "")
    return {"connect_url": connect_url}


@router.post("/finish")
def finish_connect(
    body: FinishRequest,
    db:   Session      = Depends(get_db),
    user: models.User  = Depends(get_current_user),
):
    """Finalise la connexion après redirection Enable Banking."""
    _require_enablebanking()

    conn = db.query(models.BankConnection).filter_by(user_id=user.id, status="pending").first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    expected, _, started = (conn.oauth_state or "").partition("|")
    if not expected or not body.state or not hmac.compare_digest(expected, body.state) \
            or time.time() - int(started or 0) > PENDING_MAX_SECONDS:
        raise HTTPException(status_code=400, detail="Bank connection expired, please start again")

    try:
        session = enablebanking.create_session(body.auth_code)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enable Banking error: {exc}")

    accounts = session.get("accounts", [])
    if not accounts:
        # La banque a autorisé l'accès sans partager de compte : rien à importer.
        # On garde l'ancienne connexion telle quelle.
        db.delete(conn)
        db.commit()
        raise HTTPException(status_code=422, detail="No account shared by the bank")

    session_id = session.get("session_id") or session.get("id", "")
    conn.saltedge_connection_id = session_id
    conn.saltedge_customer_id   = session_id
    conn.status                 = "active"
    conn.oauth_state            = None

    # Les comptes sont retournés directement dans la réponse de session
    db.query(models.BankAccount).filter_by(connection_id=conn.id).delete()

    for acc in accounts:
        uid = acc.get("uid") or acc.get("id") or acc.get("account_id", "")
        db.add(models.BankAccount(
            connection_id=conn.id,
            saltedge_account_id=str(uid),
            name=acc.get("name") or acc.get("display_name", "Compte"),
            nature=acc.get("cash_account_type") or acc.get("nature"),
            currency=acc.get("currency") or acc.get("currency_code", "EUR"),
        ))

    # Reconnexion : la nouvelle connexion remplace l'ancienne (accès expiré ou bientôt expiré)
    for old in db.query(models.BankConnection).filter(
        models.BankConnection.user_id == user.id,
        models.BankConnection.id != conn.id,
    ).all():
        db.delete(old)

    db.commit()
    return {"status": "connected", "provider_name": conn.provider_name}


def _psu_headers(request: Request) -> dict:
    """L'utilisateur est devant l'écran : la banque ne compte pas cette lecture dans sa limite
    d'environ 4 par jour (réservée aux lectures en son absence)."""
    headers = {"Psu-Ip-Address": client_ip(request)}
    if request.headers.get("user-agent"):
        headers["Psu-User-Agent"] = request.headers["user-agent"]
    return headers


@router.get("/transactions")
def get_transactions(
    request:   Request,
    from_date: Optional[str] = None,
    to_date:   Optional[str] = None,
    db:   Session      = Depends(get_db),
    user: models.User  = Depends(get_current_user),
):
    """Récupère les transactions postées depuis Enable Banking."""
    _require_enablebanking()

    conn = db.query(models.BankConnection).filter_by(user_id=user.id, status="active").first()
    if not conn or not conn.saltedge_connection_id:
        raise HTTPException(status_code=404, detail="No active bank connection")

    if not from_date:
        today     = datetime.date.today()
        from_date = today.replace(day=1).isoformat()

    try:
        result = bank_sync.fetch_transactions(db, conn, from_date, to_date, _psu_headers(request))
    except Exception as exc:
        # Accès coupé par la banque (fin de validité) : le dire clairement, l'écran propose de reconnecter
        info = enablebanking.consent_info(conn.saltedge_connection_id, max_age=0)
        if info and info["expired"]:
            raise HTTPException(status_code=409, detail="Bank access expired")
        raise HTTPException(status_code=502, detail=f"Enable Banking error: {exc}")

    return result


@router.patch("/accounts/{account_id}")
def toggle_account(
    account_id: int,
    db:   Session      = Depends(get_db),
    user: models.User  = Depends(get_current_user),
):
    conn = db.query(models.BankConnection).filter_by(user_id=user.id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    account = db.query(models.BankAccount).filter_by(id=account_id, connection_id=conn.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    account.enabled = not account.enabled
    db.commit()
    return {"id": account.id, "enabled": account.enabled}


@router.delete("/connection")
def delete_connection(
    db:   Session      = Depends(get_db),
    user: models.User  = Depends(get_current_user),
):
    conn = db.query(models.BankConnection).filter_by(user_id=user.id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()
    return {"status": "disconnected"}


# ── Transactions importées ─────────────────────────────────────────────────────

@router.post("/transactions/import")
def import_transactions(
    body:  ImportTransactionsRequest,
    db:    Session       = Depends(get_db),
    group: models.Group  = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=body.month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")

    return bank_sync.add_transactions(db, group, month, [tx.model_dump() for tx in body.transactions])


@router.get("/months/{month_id}/transactions")
def get_month_transactions(
    month_id: int,
    db:    Session       = Depends(get_db),
    group: models.Group  = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")

    txs = db.query(models.BankTransaction).filter_by(month_id=month_id).order_by(
        models.BankTransaction.date.desc()
    ).all()
    # « 4242 » -> « Camille » : qui a payé, d'après les cartes renseignées dans Réglages › Compte
    owners = {}
    for u in (group.user1, group.user2):
        for digits in ((u.card_digits or "").split(",") if u else []):
            if digits.strip():
                owners[digits.strip()] = u.get_display_name()

    return [
        {
            "id":           tx.id,
            "saltedge_id":  tx.saltedge_id,
            "date":         tx.date,
            "description":  tx.description,
            "amount":       tx.amount,
            "category":     tx.category,
            "account_name": tx.account_name,
            "is_card":      tx.is_card,
            "detail":        tx.detail,
            "card_last4":    tx.card_last4,
            "card_owner":    owners.get(tx.card_last4 or ""),
            "purchase_date": tx.purchase_date,
        }
        for tx in txs
    ]


@router.patch("/transactions/{tx_id}")
def categorize_transaction(
    tx_id: int,
    body:  CategorizeRequest,
    db:    Session       = Depends(get_db),
    group: models.Group  = Depends(get_current_group),
):
    group_month_ids = db.query(models.Month.id).filter_by(group_id=group.id).subquery()
    tx = db.query(models.BankTransaction).filter(
        models.BankTransaction.id == tx_id,
        models.BankTransaction.month_id.in_(group_month_ids),
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.category = body.category
    # Les autres transactions du même commerçant encore sans catégorie suivent (« EPICERIE CENTRE » une fois pour toutes)
    also = 0
    key = bank_sync.merchant_key(tx.description)
    if body.category and key:
        for other in db.query(models.BankTransaction).filter(
            models.BankTransaction.month_id.in_(group_month_ids),
            models.BankTransaction.category.is_(None),
            models.BankTransaction.id != tx.id,
        ).all():
            if bank_sync.merchant_key(other.description) == key:
                other.category = body.category
                also += 1
    db.commit()
    return {"id": tx.id, "category": tx.category, "also_categorized": also}


@router.delete("/transactions/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    db:    Session       = Depends(get_db),
    group: models.Group  = Depends(get_current_group),
):
    group_month_ids = db.query(models.Month.id).filter_by(group_id=group.id).subquery()
    tx = db.query(models.BankTransaction).filter(
        models.BankTransaction.id == tx_id,
        models.BankTransaction.month_id.in_(group_month_ids),
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()


@router.get("/months/{month_id}/budget-vs-actual")
def budget_vs_actual(
    month_id: int,
    db:    Session       = Depends(get_db),
    group: models.Group  = Depends(get_current_group),
):
    month = db.query(models.Month).filter_by(id=month_id, group_id=group.id).first()
    if not month:
        raise HTTPException(status_code=404, detail="Month not found")

    categories = db.query(models.Category).filter_by(group_id=group.id).order_by(
        models.Category.sort_order
    ).all()
    cat_map = {c.name: {"icon": c.icon, "color": c.color} for c in categories}

    budget: dict[str, float] = {}
    for charge in month.charges:
        budget[charge.category] = budget.get(charge.category, 0.0) + charge.amount

    actual: dict[str, float] = {}
    txs = db.query(models.BankTransaction).filter_by(month_id=month_id).all()
    for tx in txs:
        if tx.category:
            actual[tx.category] = actual.get(tx.category, 0.0) + tx.amount

    # Si pas de transactions bancaires, utiliser les actual_amount saisis manuellement
    if not txs:
        for charge in month.charges:
            if charge.actual_amount is not None:
                actual[charge.category] = actual.get(charge.category, 0.0) + charge.actual_amount

    all_cats = sorted(set(budget.keys()) | set(actual.keys()))
    result = []
    for cat in all_cats:
        b    = round(budget.get(cat, 0.0), 2)
        a    = round(actual.get(cat, 0.0), 2)
        meta = cat_map.get(cat, {"icon": "📦", "color": "#94a3b8"})
        result.append({
            "category": cat,
            "icon":     meta["icon"],
            "color":    meta["color"],
            "budget":   b,
            "actual":   a,
            "delta":    round(a - b, 2),
        })

    uncategorized = round(sum(tx.amount for tx in txs if not tx.category), 2)
    return {
        "rows":          result,
        "total_budget":  round(sum(r["budget"] for r in result), 2),
        # Le réel compte aussi ce qui n'est pas encore catégorisé : sinon le total paraît sous le budget
        "total_actual":  round(sum(r["actual"] for r in result) + uncategorized, 2),
        "uncategorized": uncategorized,
        "uncategorized_count": sum(1 for tx in txs if not tx.category),
        "has_transactions": bool(txs),
        "first_date": min((tx.date for tx in txs), default=None),
        "last_date": max((tx.date for tx in txs), default=None),
    }
