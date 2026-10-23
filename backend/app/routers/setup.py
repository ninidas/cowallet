from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from ..auth import hash_password, password_problem
from .users import registration_open

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status", response_model=schemas.SetupStatus)
def setup_status(db: Session = Depends(get_db)):
    needed = db.query(models.User).count() == 0
    return schemas.SetupStatus(needed=needed)


@router.get("/registration-status")
def registration_status(db: Session = Depends(get_db)):
    return {"open": registration_open(db)}


@router.post("", status_code=201)
def do_setup(body: schemas.SetupRequest, db: Session = Depends(get_db)):
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=400, detail="Setup already completed")

    u1, u2 = body.user1_username.strip(), body.user2_username.strip()
    if not u1 or not u2:
        raise HTTPException(status_code=400, detail="Username is required")
    if u1 == u2:
        raise HTTPException(status_code=400, detail="Both usernames must be different")
    for password in (body.user1_password, body.user2_password):
        if problem := password_problem(password):
            raise HTTPException(status_code=400, detail=problem)

    db.add(models.User(username=u1, password_hash=hash_password(body.user1_password)))
    db.add(models.User(username=u2, password_hash=hash_password(body.user2_password)))
    db.add(models.AppConfig(key="default_user1_share", value=str(body.default_user1_share)))
    db.commit()

    return {"detail": "Setup complete"}
