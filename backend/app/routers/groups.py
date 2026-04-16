import os
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, get_current_group

router = APIRouter(prefix="/groups", tags=["groups"])

APP_LANG = os.environ.get("APP_LANG", "en").lower()

DEFAULT_GROUP_NAMES = {
    "en": "My budget",
    "fr": "Notre budget",
}

DEFAULT_CATEGORIES = {
    "en": [
        ("Housing",       "🏠", "#3b82f6", 0),
        ("Car",           "🚗", "#f97316", 1),
        ("Groceries",     "🛒", "#10b981", 2),
        ("Entertainment", "🎬", "#a855f7", 3),
        ("Projects",      "🎯", "#ef4444", 4),
        ("Travel",        "✈️", "#06b6d4", 5),
        ("Health",        "❤️", "#ec4899", 6),
        ("Savings",       "💰", "#eab308", 7),
        ("Other",         "📦", "#94a3b8", 8),
    ],
    "fr": [
        ("Maison",         "🏠", "#3b82f6", 0),
        ("Voiture",        "🚗", "#f97316", 1),
        ("Alimentation",   "🛒", "#10b981", 2),
        ("Divertissement", "🎬", "#a855f7", 3),
        ("Projet",         "🎯", "#ef4444", 4),
        ("Voyage",         "✈️", "#06b6d4", 5),
        ("Santé",          "❤️", "#ec4899", 6),
        ("Épargne",        "💰", "#eab308", 7),
        ("Autre",          "📦", "#94a3b8", 8),
    ],
}

DEFAULT_PAYMENT_METHODS = {
    "en": ["Direct debit", "Card", "Transfer", "PayPal", "Cash", "Cheque"],
    "fr": ["Prélèvement", "Carte", "Virement", "PayPal", "Espèces", "Chèque"],
}


def _seed_group(group: models.Group, db: Session):
    lang = APP_LANG if APP_LANG in DEFAULT_CATEGORIES else "en"
    for i, name in enumerate(DEFAULT_PAYMENT_METHODS[lang]):
        db.add(models.PaymentMethod(group_id=group.id, name=name, sort_order=i))
    for name, icon, color, order in DEFAULT_CATEGORIES[lang]:
        db.add(models.Category(group_id=group.id, name=name, icon=icon, color=color, sort_order=order))


@router.get("/invite-info/{code}")
def get_invite_info(code: str, db: Session = Depends(get_db)):
    """Infos publiques sur une invitation (pas d'auth requise)."""
    group = db.query(models.Group).filter_by(invite_code=code.upper()).first()
    if not group or group.user2_id is not None:
        raise HTTPException(status_code=404, detail="Invitation invalide ou expirée")
    return {
        "inviter": group.user1.username,
        "group_name": group.name if group.name not in DEFAULT_GROUP_NAMES.values() else None,
    }


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
    lang = APP_LANG if APP_LANG in DEFAULT_GROUP_NAMES else "en"
    group = models.Group(
        name=body.name or DEFAULT_GROUP_NAMES[lang],
        currency=body.currency.upper() if body.currency.upper() in SUPPORTED_CURRENCIES else "EUR",
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


SUPPORTED_CURRENCIES = {"EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN"}

@router.patch("/me/currency", response_model=schemas.GroupOut)
def update_currency(
    body: schemas.GroupCurrencyUpdate,
    group: models.Group = Depends(get_current_group),
    db: Session = Depends(get_db),
):
    if body.currency.upper() not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Devise non supportée")
    group.currency = body.currency.upper()
    db.commit()
    db.refresh(group)
    return _to_out(group)


@router.patch("/me/name", response_model=schemas.GroupOut)
def rename_group(
    body: schemas.GroupRename,
    group: models.Group = Depends(get_current_group),
    db: Session = Depends(get_db),
):
    group.name = body.name.strip()
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
        currency=group.currency,
        user1_id=group.user1_id,
        user1_username=group.user1.username,
        user2_id=group.user2_id,
        user2_username=group.user2.username if group.user2 else None,
    )
