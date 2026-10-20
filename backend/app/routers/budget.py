from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/budget", tags=["budget"])


def _seeded_key(user_id: int) -> str:
    return f"budget_seeded:{user_id}"


def _mark_seeded(db: Session, user_id: int) -> None:
    """Les lignes d'exemple ne sont proposées qu'une fois : un budget vidé exprès reste vide."""
    # INSERT OR IGNORE : les lignes d'exemple sont créées en parallèle, sans conflit sur la clé
    db.execute(sqlite_insert(models.AppConfig).values(key=_seeded_key(user_id), value="1").on_conflict_do_nothing())


@router.get("", response_model=List[schemas.BudgetEntryOut])
def get_budget(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = db.query(models.BudgetEntry).filter_by(user_id=current_user.id).order_by(
        models.BudgetEntry.type, models.BudgetEntry.sort_order
    ).all()
    if entries and not db.get(models.AppConfig, _seeded_key(current_user.id)):
        _mark_seeded(db, current_user.id)
        db.commit()
    return entries


@router.get("/seeded")
def get_seeded(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"seeded": db.get(models.AppConfig, _seeded_key(current_user.id)) is not None}


@router.post("", response_model=schemas.BudgetEntryOut, status_code=201)
def create_entry(
    body: schemas.BudgetEntryCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = models.BudgetEntry(
        user_id=current_user.id,
        type=body.type,
        label=body.label,
        amount=body.amount,
        category=body.category,
        sort_order=body.sort_order,
    )
    db.add(entry)
    _mark_seeded(db, current_user.id)
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
        raise HTTPException(status_code=404, detail="Entry not found")
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
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
