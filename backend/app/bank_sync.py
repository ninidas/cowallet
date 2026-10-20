"""Transactions bancaires : lecture chez Enable Banking, reconnaissance du commerçant, import automatique.

Partagé par l'écran d'import (routers/bank.py) et la tâche du matin (scheduler.py)."""
import datetime
import logging
import re
import unicodedata

from sqlalchemy.orm import Session

from . import models, enablebanking

logger = logging.getLogger(__name__)

# Jours en début de mois pendant lesquels l'import automatique complète aussi le mois précédent :
# la banque enregistre parfois un achat de fin de mois quelques jours plus tard.
PREVIOUS_MONTH_DAYS = 5


def _eur_fr(s: str) -> str:
    return s.strip().rstrip("E").strip() + " €"


def remittance_detail(lines: list, account_name: str = "") -> str | None:
    """Les lignes après le libellé, quand elles disent quelque chose :
    « Provision charges 01/10/2026 », « Box Fibre », et pour une échéance de prêt
    « DONT CAP 321,09 ASS. 45,67E » + « INT. 123,45 COM. 0,00E » -> « Capital 321,09 € · assurance 45,67 € · intérêts 123,45 € ».
    Écarte les simples références (« 1234567890123 PAYPAL », « A1234B000001234C000000123 ») et le nom du titulaire."""
    joined = " ".join(lines)
    loan = re.findall(r'(CAP|ASS|INT|COM)\.?\s+(\d[\d\s]*,\d{2})E?', joined)
    if loan:
        names = {"CAP": "Capital", "ASS": "assurance", "INT": "intérêts", "COM": "commission"}
        parts = [f"{names[k]} {_eur_fr(v)}" for k, v in loan if v.replace(" ", "") != "0,00"]
        return " · ".join(parts).capitalize() if parts else None
    holder = {w for w in re.split(r"\W+", (account_name or "").upper()) if len(w) >= 4}
    for line in lines:
        words = line.split()
        if re.search(r"\b(RUM|ICS)\s*:", line, re.I):
            continue                                  # « RUM:XX123456789SEPA/ICS:FR00ZZZ0 » : références du mandat SEPA
        if not words or (all(w.isalpha() for w in words) and any(w.upper() in holder for w in words)):
            continue                                  # « DUPONT               JEAN » : le titulaire
        kept = [w for w in words if not re.fullmatch(r"[A-Z0-9]*\d[A-Z0-9]{5,}", w, re.I)]  # numéros de référence
        if kept and kept[-1].upper() in {"PAYPAL"} and len(kept) == 1:
            continue
        text = " ".join(kept)
        if sum(ch.isalpha() for ch in text) >= 3:
            return text[:120]
    return None


def parse_transaction(tx: dict, account: models.BankAccount) -> dict:
    """Transaction au format Enable Banking -> format de l'écran d'import."""
    raw_amount = tx.get("transaction_amount", {}).get("amount") or tx.get("amount") or 0
    amount = float(raw_amount)
    # Enable Banking : credit_debit_indicator = DBIT ou CRDT
    indicator = tx.get("credit_debit_indicator", "")
    is_debit = indicator == "DBIT" if indicator else amount < 0

    # remittance_information est une liste ; on écarte la référence carte (« 210326 CB****1111 »)
    # et la ligne de change (« 5,40EUR 1 EURO = 1,000000 »)
    remittance = tx.get("remittance_information") or []
    card_last4 = purchase_date = detail = None
    if isinstance(remittance, list):
        is_card = any(re.match(r'^\d{6}\s+CB\*', r) for r in remittance if r)
        for r in remittance:
            m = re.match(r'^(\d{2})(\d{2})(\d{2})\s+CB\*+(\d{4})', r or "")
            if m:
                purchase_date = f"20{m.group(3)}-{m.group(2)}-{m.group(1)}"
                card_last4 = m.group(4)
        cleaned = [r for r in remittance if r and not re.match(r'^\d{6}\s+CB\*', r) and "EUR" not in r]
        description = cleaned[0] if cleaned else " / ".join(r for r in remittance if r)
        if not is_card:
            detail = remittance_detail(cleaned[1:], account.name)
    else:
        is_card = False
        description = str(remittance)

    # transaction_id peut être null : entry_reference à défaut
    tx_id = tx.get("transaction_id") or tx.get("entry_reference") or tx.get("id", "")
    return {
        "id":           str(tx_id),
        "date":         tx.get("booking_date") or tx.get("value_date") or tx.get("date", ""),
        "description":  description,
        "amount":       abs(amount),
        "is_debit":     is_debit,
        "is_card":      is_card,
        "detail":       detail,
        "card_last4":   card_last4,
        "purchase_date": purchase_date,
        "currency":     tx.get("transaction_amount", {}).get("currency") or tx.get("currency", "EUR"),
        "account_name": account.name,
        "account_id":   str(account.id),
    }


def fetch_transactions(db: Session, conn: models.BankConnection, from_date: str, to_date: str = None,
                       psu_headers: dict = None) -> list:
    """Transactions des comptes activés de la connexion, les plus récentes d'abord.
    psu_headers : à passer quand l'utilisateur est devant l'écran (lecture non comptée par la banque)."""
    accounts = db.query(models.BankAccount).filter_by(connection_id=conn.id, enabled=True).all()
    result = []
    for account in accounts:
        for tx in enablebanking.get_transactions(account.saltedge_account_id, from_date, to_date, psu_headers):
            # Seulement les opérations passées : une opération en attente (PDNG) change de numéro une fois
            # passée, elle serait importée deux fois (un péage vu en double, puis en triple)
            if tx.get("status", "BOOK") != "BOOK":
                continue
            result.append(parse_transaction(tx, account))
    result.sort(key=lambda x: x["date"], reverse=True)
    return result


# Intermédiaires de paiement qui regroupent des achats sans rapport entre eux (un prélèvement PayPal
# peut couvrir des achats sans rapport) : jamais de catégorie devinée pour eux (2026-10-20)
GENERIC_MERCHANTS = ("PAYPAL",)


def is_generic(description: str) -> bool:
    return any(g in merchant_key(description, raw=True) for g in GENERIC_MERCHANTS)


def merchant_key(description: str, raw: bool = False) -> str:
    """Le commerçant derrière un libellé, pour reconnaître un même achat d'un mois à l'autre.

    Paiement par carte : 15 caractères de commerçant, puis le pays ou le département, puis la ville
    (« HYPER DEMO     FR DEMOVILLE », « EPICERIE CENTRE99DEMOVILLE ») -> « HYPER DEMO », « EPICERIE CENTRE ».
    Prélèvement : « PRLV SEPA Energie clients » -> « ENERGIE CLIENTS ». Sinon le libellé entier."""
    s = unicodedata.normalize("NFD", description or "")
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn").upper()
    if raw:
        return s
    if any(g in s for g in GENERIC_MERCHANTS):
        return ""
    if s.startswith("PRLV SEPA "):
        s = s[len("PRLV SEPA "):]
    elif len(s) > 17 and re.match(r"[A-Z]{2}|\d{2}", s[15:17]):
        s = s[:15]
    return re.sub(r"\s+", " ", s).strip()


def category_index(db: Session, group: models.Group) -> tuple:
    """(libellé exact -> catégorie, commerçant -> catégorie), d'après les transactions déjà catégorisées
    du groupe ; la plus récente l'emporte. Une catégorie supprimée depuis n'est plus proposée."""
    exact, by_merchant = {}, {}
    names = [c.name for c in db.query(models.Category).filter_by(group_id=group.id).all()]
    past = (
        db.query(models.BankTransaction)
        .join(models.Month)
        .filter(models.Month.group_id == group.id, models.BankTransaction.category.in_(names))
        .order_by(models.BankTransaction.date.desc())
        .all()
    )
    for t in past:
        exact.setdefault(t.description, t.category)
        key = merchant_key(t.description)
        if key:
            by_merchant.setdefault(key, t.category)
    return exact, by_merchant


def guess_category(index: tuple, description: str):
    if is_generic(description):
        return None
    exact, by_merchant = index
    return exact.get(description) or by_merchant.get(merchant_key(description))


def add_transactions(db: Session, group: models.Group, month: models.Month, items: list) -> dict:
    """Enregistre des transactions dans un mois, sans doublon, avec la catégorie devinée.
    items : dicts avec saltedge_id, date, description, amount, account_name, is_card, is_debit."""
    index = category_index(db, group)
    imported = skipped = auto_categorized = 0
    for tx in items:
        if db.query(models.BankTransaction).filter_by(saltedge_id=tx["saltedge_id"]).first():
            skipped += 1
            continue
        cat = guess_category(index, tx["description"])
        db.add(models.BankTransaction(
            month_id=month.id,
            saltedge_id=tx["saltedge_id"],
            date=tx["date"],
            description=tx["description"],
            # Dépense en positif ; un remboursement reçu en négatif, pour qu'il diminue le réel
            amount=abs(tx["amount"]) if tx.get("is_debit", True) else -abs(tx["amount"]),
            account_name=tx["account_name"],
            is_card=tx.get("is_card", False),
            detail=tx.get("detail"),
            card_last4=tx.get("card_last4"),
            purchase_date=tx.get("purchase_date"),
            category=cat,
        ))
        imported += 1
        auto_categorized += bool(cat)
    db.commit()
    return {"imported": imported, "skipped": skipped, "auto_categorized": auto_categorized}


def auto_import(db: Session, today: datetime.date = None) -> list:
    """Import du matin : pour chaque connexion bancaire active, les débits du mois en cours (et du mois
    précédent les premiers jours) vont dans le mois correspondant s'il est créé. Mêmes règles que l'écran
    d'import avec « Débits uniquement » : sans doublon, catégorie devinée.
    Une seule lecture par compte, toute la période d'un coup : la banque n'en sert qu'environ 4 par jour
    sans l'utilisateur. Une banque en erreur (accès expiré, quota atteint…) n'empêche pas les autres."""
    today = today or datetime.date.today()
    first = today.replace(day=1)
    if today.day <= PREVIOUS_MONTH_DAYS:
        first = (first - datetime.timedelta(days=1)).replace(day=1)
    report = []
    for conn in db.query(models.BankConnection).filter_by(status="active").all():
        group = db.query(models.Group).filter(
            (models.Group.user1_id == conn.user_id) | (models.Group.user2_id == conn.user_id)
        ).first()
        if not group or not conn.saltedge_connection_id:
            continue
        months = {f"{m.year:04d}-{m.month:02d}": m for m in db.query(models.Month).filter_by(group_id=group.id).all()
                  if (first.year, first.month) <= (m.year, m.month) <= (today.year, today.month)}
        if not months:
            continue
        try:
            txs = fetch_transactions(db, conn, first.isoformat(), today.isoformat())
        except Exception as exc:
            logger.warning("Import automatique : banque injoignable (%s)", exc)
            report.append({"connection_id": conn.id, "user_id": conn.user_id, "error": str(exc)})
            continue
        for ym, month in sorted(months.items(), reverse=True):
            items = [{**t, "saltedge_id": t["id"]} for t in txs if t["is_debit"] and t["date"][:7] == ym]
            res = add_transactions(db, group, month, items)
            logger.info("Import automatique, %s : %s", month.label, res)
            report.append({"connection_id": conn.id, "group_id": group.id, "month_id": month.id,
                           "month": month.label, **res})
    return report
