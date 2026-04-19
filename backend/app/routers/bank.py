import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, enablebanking
from ..auth import get_current_user, get_current_group

router = APIRouter(prefix="/bank", tags=["bank"])


def _require_enablebanking():
    if not enablebanking.is_configured():
        raise HTTPException(status_code=503, detail="Enable Banking not configured on this server")


# ── Schemas ────────────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    return_to:    str
    aspsp_name:   str
    aspsp_country: str = "FR"

class FinishRequest(BaseModel):
    auth_code: str

class TransactionImportItem(BaseModel):
    saltedge_id:  str
    date:         str
    description:  str
    amount:       float
    account_name: str
    is_card:      bool = False

class ImportTransactionsRequest(BaseModel):
    month_id:     int
    transactions: List[TransactionImportItem]

class CategorizeRequest(BaseModel):
    category: Optional[str] = None


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
    db:   Session      = Depends(get_db),
    user: models.User  = Depends(get_current_user),
):
    """Retourne l'état de la connexion bancaire de l'utilisateur."""
    if not enablebanking.is_configured():
        return {"configured": False}

    conn = db.query(models.BankConnection).filter_by(user_id=user.id, status="active").first()
    if not conn:
        return {"configured": True, "connected": False}

    accounts = db.query(models.BankAccount).filter_by(connection_id=conn.id).all()
    return {
        "configured":    True,
        "connected":     True,
        "provider_name": conn.provider_name,
        "accounts": [
            {"id": a.id, "name": a.name, "nature": a.nature, "currency": a.currency, "enabled": a.enabled}
            for a in accounts
        ],
    }


@router.post("/connect")
def start_connect(
    body: ConnectRequest,
    db:   Session      = Depends(get_db),
    user: models.User  = Depends(get_current_user),
):
    """Démarre le flux Enable Banking. Retourne un url à ouvrir côté frontend."""
    _require_enablebanking()

    # Supprime une éventuelle connexion pending précédente
    existing = db.query(models.BankConnection).filter_by(user_id=user.id, status="pending").first()
    if existing:
        db.delete(existing)
        db.commit()

    try:
        result = enablebanking.start_auth(body.aspsp_name, body.aspsp_country, body.return_to)
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

    try:
        session = enablebanking.create_session(body.auth_code)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enable Banking error: {exc}")

    session_id = session.get("session_id") or session.get("id", "")
    conn.saltedge_connection_id = session_id
    conn.saltedge_customer_id   = session_id
    conn.status                 = "active"

    # Les comptes sont retournés directement dans la réponse de session
    db.query(models.BankAccount).filter_by(connection_id=conn.id).delete()
    accounts = session.get("accounts", [])

    for acc in accounts:
        uid = acc.get("uid") or acc.get("id") or acc.get("account_id", "")
        db.add(models.BankAccount(
            connection_id=conn.id,
            saltedge_account_id=str(uid),
            name=acc.get("name") or acc.get("display_name", "Compte"),
            nature=acc.get("cash_account_type") or acc.get("nature"),
            currency=acc.get("currency") or acc.get("currency_code", "EUR"),
        ))

    db.commit()
    return {"status": "connected", "provider_name": conn.provider_name}


@router.get("/transactions")
def get_transactions(
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

    accounts = db.query(models.BankAccount).filter_by(connection_id=conn.id, enabled=True).all()

    result = []
    try:
        for account in accounts:
            txs = enablebanking.get_transactions(account.saltedge_account_id, from_date, to_date)
            for tx in txs:
                # Montant : Enable Banking utilise souvent {amount, currency} ou {transaction_amount}
                raw_amount = (
                    tx.get("transaction_amount", {}).get("amount")
                    or tx.get("amount")
                    or 0
                )
                amount = float(raw_amount)

                # Enable Banking: credit_debit_indicator = DBIT ou CRDT
                indicator = tx.get("credit_debit_indicator", "")
                is_debit  = indicator == "DBIT" if indicator else amount < 0

                # remittance_information est une liste
                # On filtre les références carte (ex: "210326 CB****7073")
                # et les lignes de montant (ex: "5,40EUR 1 EURO = 1,000000")
                remittance = tx.get("remittance_information") or []
                if isinstance(remittance, list):
                    import re
                    is_card = any(re.match(r'^\d{6}\s+CB\*', r) for r in remittance if r)
                    cleaned = [
                        r for r in remittance
                        if r
                        and not re.match(r'^\d{6}\s+CB\*', r)
                        and "EUR" not in r
                    ]
                    description = cleaned[0] if cleaned else " / ".join(r for r in remittance if r)
                else:
                    is_card = False
                    description = str(remittance)

                # transaction_id peut être null, fallback sur entry_reference
                tx_id = (
                    tx.get("transaction_id")
                    or tx.get("entry_reference")
                    or tx.get("id", "")
                )

                result.append({
                    "id":           str(tx_id),
                    "date":         tx.get("booking_date") or tx.get("value_date") or tx.get("date", ""),
                    "description":  description,
                    "amount":       abs(amount),
                    "is_debit":     is_debit,
                    "is_card":      is_card,
                    "currency":     (
                        tx.get("transaction_amount", {}).get("currency")
                        or tx.get("currency", "EUR")
                    ),
                    "account_name": account.name,
                    "account_id":   str(account.id),
                })
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Enable Banking error: {exc}")

    result.sort(key=lambda x: x["date"], reverse=True)
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

    # Index des catégories connues : description -> catégorie la plus récente
    known = {}
    past_txs = (
        db.query(models.BankTransaction)
        .join(models.Month)
        .filter(models.Month.group_id == group.id, models.BankTransaction.category.isnot(None))
        .order_by(models.BankTransaction.date.desc())
        .all()
    )
    for past in past_txs:
        if past.description not in known:
            known[past.description] = past.category

    imported = skipped = auto_categorized = 0
    for tx in body.transactions:
        if db.query(models.BankTransaction).filter_by(saltedge_id=tx.saltedge_id).first():
            skipped += 1
            continue
        auto_cat = known.get(tx.description)
        db.add(models.BankTransaction(
            month_id=month.id,
            saltedge_id=tx.saltedge_id,
            date=tx.date,
            description=tx.description,
            amount=tx.amount,
            account_name=tx.account_name,
            is_card=tx.is_card,
            category=auto_cat,
        ))
        imported += 1
        if auto_cat:
            auto_categorized += 1

    db.commit()
    return {"imported": imported, "skipped": skipped, "auto_categorized": auto_categorized}


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
    db.commit()
    return {"id": tx.id, "category": tx.category}


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

    return {
        "rows":          result,
        "total_budget":  round(sum(r["budget"] for r in result), 2),
        "total_actual":  round(sum(r["actual"] for r in result), 2),
        "uncategorized": round(sum(tx.amount for tx in txs if not tx.category), 2),
    }
