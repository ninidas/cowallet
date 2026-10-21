from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, field_validator

from ..schemas import Password, Username

from ..database import get_db
from .. import models
from ..auth import get_current_user, get_current_group, verify_password, hash_password

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    display_name:         Optional[Username] = None
    current_password:     Optional[Password] = None
    new_password:         Optional[Password] = None
    default_user1_share:  Optional[int] = None
    # 4 derniers chiffres de ses cartes, séparés par des virgules (« 4242 » ; vide pour effacer)
    card_digits:          Optional[str] = None
    notif_partner:        Optional[bool] = None
    notif_bank:           Optional[bool] = None
    notif_reminder:       Optional[bool] = None
    notif_budget:         Optional[bool] = None

    @field_validator("card_digits")
    @classmethod
    def validate_cards(cls, v):
        if v is None:
            return v
        parts = [p.strip() for p in v.replace(" ", ",").split(",") if p.strip()]
        if len(parts) > 4 or any(not (p.isdigit() and len(p) == 4) for p in parts):
            raise ValueError("Card digits: 4 digits per card")
        return ",".join(parts)

    @field_validator("default_user1_share")
    @classmethod
    def validate_share(cls, v):
        if v is not None and not (1 <= v <= 99):
            raise ValueError("Split must be between 1 and 99")
        return v


@router.patch("")
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    group: models.Group = Depends(get_current_group),
):
    if body.display_name is not None:
        name = body.display_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        current_user.display_name = name

    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Invalid current password")
        if len(body.new_password) < 12:
            raise HTTPException(status_code=400, detail="Password must be at least 12 characters")
        current_user.password_hash = hash_password(body.new_password)

    if body.card_digits is not None:
        current_user.card_digits = body.card_digits or None

    for kind in ("partner", "bank", "reminder", "budget"):
        value = getattr(body, f"notif_{kind}")
        if value is not None:
            setattr(current_user, f"notif_{kind}", value)

    if body.default_user1_share is not None:
        group.default_share = body.default_user1_share

    db.commit()
    db.refresh(current_user)
    return {"display_name": current_user.get_display_name()}
