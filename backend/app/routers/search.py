"""Recherche dans les dépenses et les transactions bancaires de tous les mois du groupe (2026-10-20)."""
import unicodedata

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..auth import get_current_group
from .months import effective_amount

router = APIRouter(prefix="/search", tags=["search"])

LIMIT = 50


def _fold(s: str) -> str:
    """Sans majuscules ni accents : « electricite » trouve « Électricité »."""
    s = unicodedata.normalize("NFD", s or "")
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn").casefold()


@router.get("")
def search(q: str = "", db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    needle = _fold(q.strip())
    if len(needle) < 2:
        return {"charges": [], "transactions": []}
    months = {m.id: m for m in db.query(models.Month).filter_by(group_id=group.id).all()}
    order = lambda m: (m.year, m.month)

    charges = [
        c for c in db.query(models.Charge).filter(models.Charge.month_id.in_(months)).all()
        if needle in _fold(c.label) or needle in _fold(c.note or "") or needle in _fold(c.category)
    ]
    charges.sort(key=lambda c: order(months[c.month_id]), reverse=True)

    txs = [
        t for t in db.query(models.BankTransaction).filter(models.BankTransaction.month_id.in_(months)).all()
        if needle in _fold(t.description) or needle in _fold(t.category or "")
    ]
    txs.sort(key=lambda t: t.date, reverse=True)

    return {
        "charges": [{
            "id": c.id, "label": c.label, "amount": effective_amount(c), "category": c.category,
            "month_id": c.month_id, "month_label": months[c.month_id].label,
        } for c in charges[:LIMIT]],
        "transactions": [{
            "id": t.id, "description": t.description, "amount": t.amount, "date": t.date, "category": t.category,
            "month_id": t.month_id, "month_label": months[t.month_id].label,
        } for t in txs[:LIMIT]],
        "total": len(charges) + len(txs),
    }
