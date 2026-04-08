from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import hash_password

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status", response_model=schemas.SetupStatus)
def setup_status(db: Session = Depends(get_db)):
    needed = db.query(models.User).count() == 0
    return schemas.SetupStatus(needed=needed)


@router.post("", status_code=201)
def do_setup(body: schemas.SetupRequest, db: Session = Depends(get_db)):
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=400, detail="Le setup a déjà été effectué")

    if body.user1_username == body.user2_username:
        raise HTTPException(status_code=400, detail="Les deux identifiants doivent être différents")

    db.add(models.User(username=body.user1_username, password_hash=hash_password(body.user1_password)))
    db.add(models.User(username=body.user2_username, password_hash=hash_password(body.user2_password)))
    db.add(models.AppConfig(key="default_user1_share", value=str(body.default_user1_share)))
    db.commit()

    return {"detail": "Setup terminé"}
