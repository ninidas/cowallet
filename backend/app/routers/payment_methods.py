from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import get_current_group
from .. import models, schemas

router = APIRouter(prefix="/payment-methods", tags=["payment_methods"])


@router.get("", response_model=List[schemas.PaymentMethodOut])
def list_payment_methods(db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    return db.query(models.PaymentMethod).filter_by(group_id=group.id).order_by(models.PaymentMethod.sort_order, models.PaymentMethod.id).all()


@router.post("", response_model=schemas.PaymentMethodOut, status_code=201)
def create_payment_method(data: schemas.PaymentMethodCreate, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    if db.query(models.PaymentMethod).filter_by(group_id=group.id, name=data.name).first():
        raise HTTPException(status_code=400, detail="Payment method already exists")
    max_order = db.query(models.PaymentMethod).filter_by(group_id=group.id).count()
    pm = models.PaymentMethod(group_id=group.id, name=data.name, sort_order=max_order)
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm


@router.patch("/{pm_id}", response_model=schemas.PaymentMethodOut)
def update_payment_method(pm_id: int, data: schemas.PaymentMethodCreate, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    pm = db.query(models.PaymentMethod).filter_by(id=pm_id, group_id=group.id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    existing = db.query(models.PaymentMethod).filter(
        models.PaymentMethod.group_id == group.id,
        models.PaymentMethod.name == data.name,
        models.PaymentMethod.id != pm_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Payment method already exists")
    pm.name = data.name
    db.commit()
    db.refresh(pm)
    return pm


@router.delete("/{pm_id}", status_code=204)
def delete_payment_method(pm_id: int, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    pm = db.query(models.PaymentMethod).filter_by(id=pm_id, group_id=group.id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    db.delete(pm)
    db.commit()
