import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..limiter import limiter
from .. import models, schemas
from ..auth import hash_password, get_current_user, verify_password, password_problem, create_access_token
from .groups import new_invite_code
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["users"])


class DeleteAccountRequest(BaseModel):
    password: schemas.Password


def registration_open(db: Session) -> bool:
    """Un couple = deux comptes : MAX_GROUPS couples, c'est au plus 2 × MAX_GROUPS comptes.
    Compter les couples seulement laissait créer des comptes sans limite tant qu'aucun couple n'existait."""
    max_groups = int(os.getenv("MAX_GROUPS", "1"))
    return db.query(models.User).count() < 2 * max_groups


@router.post("/register", response_model=schemas.TokenResponse, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    # Inscriptions fermées d'abord : sinon « identifiant déjà pris » révélerait les comptes existants
    if not registration_open(db):
        raise HTTPException(status_code=403, detail="Registration is closed: maximum number of groups reached")
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if problem := password_problem(body.password):
        raise HTTPException(status_code=400, detail=problem)
    if db.query(models.User).filter_by(username=username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = models.User(username=username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user)
    return schemas.TokenResponse(access_token=token, user_id=user.id, username=user.username, display_name=user.get_display_name())


@router.delete("/me", status_code=204)
def delete_account(
    body: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid password")

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
            group.invite_code = new_invite_code()   # l'ancien lien ne doit plus ouvrir le couple
        else:
            # user2 part → retirer du groupe
            group.user2_id = None
            group.invite_code = new_invite_code()

    # Ce qui n'appartient qu'à lui : accès bancaire (et ses comptes), budget perso, notifications, réglages
    uid = current_user.id
    for conn in db.query(models.BankConnection).filter_by(user_id=uid).all():
        db.query(models.AppConfig).filter_by(key=f"bank_import_failing:{conn.id}").delete()
        db.delete(conn)
    db.query(models.BudgetEntry).filter_by(user_id=uid).delete()
    db.query(models.PushSubscription).filter_by(user_id=uid).delete()
    db.query(models.AppConfig).filter_by(key=f"budget_seeded:{uid}").delete()
    # Ses validations de mois ne pointent plus vers un compte disparu
    db.query(models.Month).filter_by(validated_by=uid).update({"validated_by": None})

    db.delete(current_user)
    db.commit()
