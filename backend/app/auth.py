import os
import secrets
import bcrypt
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .database import get_db, SessionLocal
from . import models

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30
_secret_key: str | None = None


def _get_secret_key() -> str:
    global _secret_key
    if _secret_key is not None:
        return _secret_key
    if key := os.environ.get("SECRET_KEY"):
        _secret_key = key
        return _secret_key
    db = SessionLocal()
    try:
        cfg = db.query(models.AppConfig).filter_by(key="secret_key").first()
        if not cfg:
            cfg = models.AppConfig(key="secret_key", value=secrets.token_hex(32))
            db.add(cfg)
            db.commit()
        _secret_key = cfg.value
        return _secret_key
    finally:
        db.close()

bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, username: str) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "username": username, "exp": expire}
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme_optional),
    db: Session = Depends(get_db),
) -> models.User | None:
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, _get_secret_key(), algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        return db.query(models.User).filter(models.User.id == user_id).first()
    except Exception:
        return None


def get_current_group(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.Group:
    group = db.query(models.Group).filter(
        (models.Group.user1_id == current_user.id) |
        (models.Group.user2_id == current_user.id)
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="No group — create or join a group")
    return group
