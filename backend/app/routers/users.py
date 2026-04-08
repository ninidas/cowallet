from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import hash_password, get_current_user, verify_password
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["users"])


class DeleteAccountRequest(BaseModel):
    password: str


@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Identifiant requis")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (8 caractères min.)")
    if not any(c.isdigit() for c in body.password):
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins un chiffre")
    if db.query(models.User).filter_by(username=body.username.strip()).first():
        raise HTTPException(status_code=409, detail="Cet identifiant est déjà pris")

    user = models.User(username=body.username.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    from ..auth import create_access_token
    token = create_access_token(user.id, user.username)
    return schemas.TokenResponse(access_token=token, user_id=user.id, username=user.username)


@router.delete("/me", status_code=204)
def delete_account(
    body: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mot de passe incorrect")

    # Gérer le groupe
    group = db.query(models.Group).filter(
        (models.Group.user1_id == current_user.id) |
        (models.Group.user2_id == current_user.id)
    ).first()

    if group:
        if group.user2_id is None or (group.user1_id == current_user.id and group.user2_id is None):
            # Seul membre → supprimer le groupe et toutes ses données
            db.delete(group)
        elif group.user1_id == current_user.id:
            # user1 part, user2 reste → promouvoir user2
            group.user1_id = group.user2_id
            group.user2_id = None
        else:
            # user2 part → retirer du groupe
            group.user2_id = None

    db.delete(current_user)
    db.commit()
