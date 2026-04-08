from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..auth import get_current_group
from .. import models, schemas

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=List[schemas.CategoryOut])
def list_categories(db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    return db.query(models.Category).filter_by(group_id=group.id).order_by(models.Category.sort_order, models.Category.id).all()


@router.post("", response_model=schemas.CategoryOut, status_code=201)
def create_category(data: schemas.CategoryCreate, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    if db.query(models.Category).filter_by(group_id=group.id, name=data.name).first():
        raise HTTPException(status_code=400, detail="Une catégorie avec ce nom existe déjà")
    max_order = db.query(models.Category).filter_by(group_id=group.id).count()
    cat = models.Category(group_id=group.id, name=data.name, icon=data.icon, color=data.color, sort_order=max_order)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{cat_id}", response_model=schemas.CategoryOut)
def update_category(cat_id: int, data: schemas.CategoryUpdate, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    cat = db.query(models.Category).filter_by(id=cat_id, group_id=group.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    if data.name is not None:
        existing = db.query(models.Category).filter(
            models.Category.group_id == group.id,
            models.Category.name == data.name,
            models.Category.id != cat_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ce nom est déjà utilisé")
        cat.name = data.name
    if data.icon is not None:
        cat.icon = data.icon
    if data.color is not None:
        cat.color = data.color
    if data.sort_order is not None:
        cat.sort_order = data.sort_order
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}", status_code=204)
def delete_category(cat_id: int, db: Session = Depends(get_db), group: models.Group = Depends(get_current_group)):
    cat = db.query(models.Category).filter_by(id=cat_id, group_id=group.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    db.delete(cat)
    db.commit()
