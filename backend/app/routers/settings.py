from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, field_validator

from ..database import get_db
from .. import models
from ..auth import get_current_user, get_current_group, verify_password, hash_password

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    username:             Optional[str] = None
    current_password:     Optional[str] = None
    new_password:         Optional[str] = None
    default_user1_share:  Optional[int] = None

    @field_validator("default_user1_share")
    @classmethod
    def validate_share(cls, v):
        if v is not None and not (1 <= v <= 99):
            raise ValueError("La répartition doit être entre 1 et 99")
        return v


@router.patch("")
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    group: models.Group = Depends(get_current_group),
):
    if body.username is not None:
        name = body.username.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Le prénom ne peut pas être vide")
        existing = db.query(models.User).filter(
            models.User.username == name,
            models.User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ce prénom est déjà utilisé")
        current_user.username = name

    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="Mot de passe actuel requis")
        if not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")
        if len(body.new_password) < 4:
            raise HTTPException(status_code=400, detail="Le nouveau mot de passe est trop court")
        current_user.password_hash = hash_password(body.new_password)

    if body.default_user1_share is not None:
        group.default_share = body.default_user1_share

    db.commit()
    db.refresh(current_user)
    return {"username": current_user.username}
