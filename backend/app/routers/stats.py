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

    grand_total = sum(cat_totals.values())
    by_category = sorted(
        [{"category": cat, "total": total, "pct": round(total / grand_total * 100, 1) if grand_total else 0}
         for cat, total in cat_totals.items()],
        key=lambda x: x["total"], reverse=True,
    )

    by_label: dict[tuple, dict] = {}
    for m in months_q:
        for c in m.charges:
            key = (c.label, c.category if c.category else "")
            if key not in by_label:
                by_label[key] = {"label": c.label, "category": key[1], "total": 0, "count": 0, "months": []}
            amt = effective_amount(c)
            by_label[key]["total"] = round(by_label[key]["total"] + amt, 2)
            by_label[key]["count"] += 1
            by_label[key]["months"].append({"label": m.label, "amount": round(amt, 2)})
        # Regroup bank transactions by description within the month
        tx_by_desc: dict[tuple, float] = {}
        for tx in m.bank_transactions:
            key = (tx.description, tx.category if tx.category else "")
            tx_by_desc[key] = round(tx_by_desc.get(key, 0.0) + tx.amount, 2)
        for key, amt in tx_by_desc.items():
            if key not in by_label:
                by_label[key] = {"label": key[0], "category": key[1], "total": 0, "count": 0, "months": []}
            by_label[key]["total"] = round(by_label[key]["total"] + amt, 2)
            by_label[key]["count"] += 1
            by_label[key]["months"].append({"label": m.label, "amount": amt})

    top_by_label = sorted(
        [{**v, "avg": round(v["total"] / v["count"], 2)} for v in by_label.values()],
        key=lambda x: x["total"], reverse=True,
    )[:10]

    # Garder top_recurring pour rétrocompatibilité
    top_recurring = [e for e in top_by_label if any(
        c.label == e["label"] and c.is_recurring for c in charges
    )][:8]

    by_month = []
    for m in months_q:
        row = {"label": m.label}
        for c in m.charges:
            key = c.category if c.category else "Autre"
            row[key] = round(row.get(key, 0) + effective_amount(c), 2)
        by_month.append(row)

    return {"by_category": by_category, "top_recurring": top_recurring, "by_label": top_by_label, "by_month": by_month}
