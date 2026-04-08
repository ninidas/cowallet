import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, get_current_group

router = APIRouter(prefix="/groups", tags=["groups"])

DEFAULT_CATEGORIES = [
    ("Maison",         "🏠", "#3b82f6", 0),
    ("Voiture",        "🚗", "#f97316", 1),
    ("Alimentation",   "🛒", "#10b981", 2),
    ("Divertissement", "🎬", "#a855f7", 3),
    ("Projet",         "🎯", "#ef4444", 4),
    ("Voyage",         "✈️", "#06b6d4", 5),
    ("Santé",          "❤️", "#ec4899", 6),
    ("Épargne",        "💰", "#eab308", 7),
    ("Autre",          "📦", "#94a3b8", 8),
]

DEFAULT_PAYMENT_METHODS = ["Prélèvement", "Carte", "Virement", "PayPal", "Espèces", "Chèque"]


def _seed_group(group: models.Group, db: Session):
    for i, name in enumerate(DEFAULT_PAYMENT_METHODS):
        db.add(models.PaymentMethod(group_id=group.id, name=name, sort_order=i))
    for name, icon, color, order in DEFAULT_CATEGORIES:
        db.add(models.Category(group_id=group.id, name=name, icon=icon, color=color, sort_order=order))


@router.get("/me", response_model=schemas.GroupOut)
def get_my_group(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = db.query(models.Group).filter(
        (models.Group.user1_id == current_user.id) |
        (models.Group.user2_id == current_user.id)
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Aucun groupe")
    return _to_out(group)


@router.post("", response_model=schemas.GroupOut, status_code=201)
def create_group(
    body: schemas.GroupCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.Group).filter(
        (models.Group.user1_id == current_user.id) |
        (models.Group.user2_id == current_user.id)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Vous avez déjà un groupe")

    invite_code = secrets.token_hex(4).upper()
    group = models.Group(
        name=body.name,
        invite_code=invite_code,
        default_share=body.default_share,
        user1_id=current_user.id,
    )
    db.add(group)
    db.flush()
    _seed_group(group, db)
    db.commit()
    db.refresh(group)
    return _to_out(group)


@router.post("/join", response_model=schemas.GroupOut)
def join_group(
    body: schemas.GroupJoin,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.Group).filter(
        (models.Group.user1_id == current_user.id) |
        (models.Group.user2_id == current_user.id)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Vous avez déjà un groupe")

    group = db.query(models.Group).filter_by(invite_code=body.invite_code.upper()).first()
    if not group:
        raise HTTPException(status_code=404, detail="Code d'invitation invalide")
    if group.user2_id is not None:
        raise HTTPException(status_code=409, detail="Ce groupe est déjà complet")
    if group.user1_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas rejoindre votre propre groupe")

    group.user2_id = current_user.id
    db.commit()
    db.refresh(group)
    return _to_out(group)


def _to_out(group: models.Group) -> schemas.GroupOut:
    return schemas.GroupOut(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        default_share=group.default_share,
        user1_id=group.user1_id,
        user1_username=group.user1.username,
        user2_id=group.user2_id,
        user2_username=group.user2.username if group.user2 else None,
    )
