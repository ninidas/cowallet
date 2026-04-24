from fastapi import APIRouter, Depends
from typing import Optional
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_group
from .months import effective_amount

router = APIRouter(prefix="/stats", tags=["stats"])


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
        return {"by_category": [], "top_recurring": [], "by_label": [], "by_month": []}

    charges = [c for m in months_q for c in m.charges]

    cat_totals: dict[str, float] = {}
    for c in charges:
        key = c.category if c.category else "Autre"
        cat_totals[key] = round(cat_totals.get(key, 0) + effective_amount(c), 2)
    for m in months_q:
        for tx in m.bank_transactions:
            if tx.category:
                cat_totals[tx.category] = round(cat_totals.get(tx.category, 0) + tx.amount, 2)

    grand_total = sum(cat_totals.values())
    by_category = sorted(
        [{"category": cat, "total": total, "pct": round(total / grand_total * 100, 1) if grand_total else 0}
         for cat, total in cat_totals.items()],
        key=lambda x: x["total"], reverse=True,
    )

    # by_label : transactions bancaires uniquement (pas les charges prévisionnelles)
    by_label: dict[str, dict] = {}
    for m in months_q:
        tx_by_desc: dict[str, dict] = {}
        for tx in m.bank_transactions:
            if tx.description not in tx_by_desc:
                tx_by_desc[tx.description] = {"amount": 0.0, "count": 0, "category": tx.category or ""}
            tx_by_desc[tx.description]["amount"] = round(tx_by_desc[tx.description]["amount"] + tx.amount, 2)
            tx_by_desc[tx.description]["count"] += 1
        for desc, info in tx_by_desc.items():
            if desc not in by_label:
                by_label[desc] = {"label": desc, "category": info["category"], "total": 0, "count": 0, "months": []}
            by_label[desc]["total"] = round(by_label[desc]["total"] + info["amount"], 2)
            by_label[desc]["count"] += info["count"]
            by_label[desc]["months"].append({"label": m.label, "amount": info["amount"], "count": info["count"]})

    top_by_label = sorted(
        [{**v, "avg": round(v["total"] / v["count"], 2)} for v in by_label.values()],
        key=lambda x: x["total"], reverse=True,
    )

    top_recurring = []  # rétrocompatibilité

    by_month = []
    for m in months_q:
        row = {"label": m.label}
        for c in m.charges:
            key = c.category if c.category else "Autre"
            row[key] = round(row.get(key, 0) + effective_amount(c), 2)
        for tx in m.bank_transactions:
            if tx.category:
                row[tx.category] = round(row.get(tx.category, 0) + tx.amount, 2)
        by_month.append(row)

    return {"by_category": by_category, "top_recurring": top_recurring, "by_label": top_by_label, "by_month": by_month}
