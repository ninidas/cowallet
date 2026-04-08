from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/budget", tags=["budget"])


@router.get("", response_model=List[schemas.BudgetEntryOut])
def get_budget(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.BudgetEntry).filter_by(user_id=current_user.id).order_by(
        models.BudgetEntry.type, models.BudgetEntry.sort_order
    ).all()


@router.post("", response_model=schemas.BudgetEntryOut, status_code=201)
def create_entry(
    body: schemas.BudgetEntryCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.type not in ("income", "expense", "investment", "shared"):
        raise HTTPException(status_code=400, detail="Type invalide")
    entry = models.BudgetEntry(
        user_id=current_user.id,
        type=body.type,
        label=body.label,
        amount=body.amount,
        category=body.category,
        sort_order=body.sort_order,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{entry_id}", response_model=schemas.BudgetEntryOut)
def update_entry(
    entry_id: int,
    body: schemas.BudgetEntryUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(models.BudgetEntry).filter_by(id=entry_id, user_id=current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée introuvable")
    if body.label is not None:
        entry.label = body.label
    if body.amount is not None:
        entry.amount = body.amount
    if body.category is not None:
        entry.category = body.category
    if body.sort_order is not None:
        entry.sort_order = body.sort_order
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(models.BudgetEntry).filter_by(id=entry_id, user_id=current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée introuvable")
    db.delete(entry)
    db.commit()
