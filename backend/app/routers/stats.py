from fastapi import APIRouter, Depends
from typing import Optional
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_group
from ..bank_sync import merchant_group

router = APIRouter(prefix="/stats", tags=["stats"])

# Transactions pas encore catégorisées : comptées dans le réel, affichées « Sans catégorie »
UNCATEGORIZED = "__uncategorized__"


@router.get("")
def get_stats(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    group: models.Group = Depends(get_current_group),
):
    months_q = db.query(models.Month).filter_by(group_id=group.id)
    if year:
        months_q = months_q.filter_by(year=year)
    months_q = months_q.order_by(models.Month.year, models.Month.month).all()

    if not months_q:
        return {"by_category": [], "top_recurring": [], "by_merchant": [], "by_month": [], "by_month_actual": []}

    charges = [c for m in months_q for c in m.charges]

    # Prévu : le montant prévu des dépenses (comme l'écran du mois), jamais le réel saisi
    cat_budget: dict[str, float] = {}
    for c in charges:
        key = c.category if c.category else "Autre"
        cat_budget[key] = round(cat_budget.get(key, 0) + c.amount, 2)

    # Réel (transactions bancaires) par catégorie, y compris ce qui n'est pas encore catégorisé
    cat_actual: dict[str, float] = {}
    for m in months_q:
        for tx in m.bank_transactions:
            key = tx.category or UNCATEGORIZED
            cat_actual[key] = round(cat_actual.get(key, 0) + tx.amount, 2)

    all_cats = sorted(set(cat_budget.keys()) | set(cat_actual.keys()))
    grand_budget = sum(cat_budget.values()) or 1
    by_category = sorted(
        [
            {
                "category": cat,
                "budget":   round(cat_budget.get(cat, 0), 2),
                "actual":   round(cat_actual.get(cat, 0), 2),
                "delta":    round(cat_actual.get(cat, 0) - cat_budget.get(cat, 0), 2),
                "pct":      round(cat_budget.get(cat, 0) / grand_budget * 100, 1),
            }
            for cat in all_cats
        ],
        key=lambda x: x["budget"], reverse=True,
    )

    # by_merchant : réel de chaque commerçant, par mois et par catégorie (détail d'une catégorie dans l'Historique)
    merchants: dict[tuple, dict] = {}
    for m in months_q:
        for tx in m.bank_transactions:
            key, name, kind = merchant_group(tx.description, tx.is_card, tx.detail)
            # PayPal ne dit pas chez qui : un achat différent à chaque fois, donc une ligne par prélèvement, datée
            date = tx.purchase_date or tx.date if key == "PAYPAL" else None
            if date:
                key = f"PAYPAL|{tx.id}"
            cat = tx.category or UNCATEGORIZED
            row = merchants.setdefault((m.id, cat, key), {
                "month": m.label, "month_id": m.id, "category": cat, "key": key,
                "merchant": name, "kind": kind, "date": date, "total": 0.0, "count": 0,
            })
            row["total"] = round(row["total"] + tx.amount, 2)
            row["count"] += 1
    by_merchant = sorted(merchants.values(), key=lambda r: r["total"], reverse=True)

    top_recurring = []  # rétrocompatibilité

    # by_month : montants prévus par catégorie (graphe d'évolution et « Prévu » d'un mois)
    by_month = []
    for m in months_q:
        row = {"label": m.label}
        for c in m.charges:
            key = c.category if c.category else "Autre"
            row[key] = round(row.get(key, 0) + c.amount, 2)
        by_month.append(row)

    # by_month_actual : transactions bancaires uniquement (pour "Par catégorie" filtré par mois)
    by_month_actual = []
    for m in months_q:
        row = {"label": m.label}
        for tx in m.bank_transactions:
            key = tx.category or UNCATEGORIZED
            row[key] = round(row.get(key, 0) + tx.amount, 2)
        by_month_actual.append(row)

    return {
        "by_category":      by_category,
        "top_recurring":    top_recurring,
        "by_merchant":      by_merchant,
        "by_month":         by_month,
        "by_month_actual":  by_month_actual,
    }
