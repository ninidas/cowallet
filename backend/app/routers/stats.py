from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_group

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
def get_stats(db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    months_q = db.query(models.Month).filter_by(group_id=group.id).all()
    charges = [c for m in months_q for c in m.charges]

    if not charges:
        return {"by_category": [], "top_recurring": []}

    cat_totals: dict[str, float] = {}
    for c in charges:
        key = c.category if c.category else "Autre"
        cat_totals[key] = round(cat_totals.get(key, 0) + c.amount, 2)

    grand_total = sum(cat_totals.values())
    by_category = sorted(
        [{"category": cat, "total": total, "pct": round(total / grand_total * 100, 1) if grand_total else 0}
         for cat, total in cat_totals.items()],
        key=lambda x: x["total"], reverse=True,
    )

    recurring: dict[tuple, dict] = {}
    for c in charges:
        if not c.is_recurring:
            continue
        key = (c.label, c.category if c.category else "")
        if key not in recurring:
            recurring[key] = {"label": c.label, "category": key[1], "total": 0, "count": 0}
        recurring[key]["total"] = round(recurring[key]["total"] + c.amount, 2)
        recurring[key]["count"] += 1

    top_recurring = sorted(
        [{**v, "avg": round(v["total"] / v["count"], 2)} for v in recurring.values()],
        key=lambda x: x["total"], reverse=True,
    )[:8]

    months_sorted = db.query(models.Month).filter_by(group_id=group.id).order_by(models.Month.year, models.Month.month).all()
    by_month = []
    for m in months_sorted:
        row = {"label": m.label}
        for c in m.charges:
            key = c.category if c.category else "Autre"
            row[key] = round(row.get(key, 0) + c.amount, 2)
        by_month.append(row)

    return {"by_category": by_category, "top_recurring": top_recurring, "by_month": by_month}
