import hmac
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


PASSWORD_MIN = 12
# bcrypt ne regarde que les 72 premiers octets : au-delà, deux mots de passe différents passeraient
PASSWORD_MAX_BYTES = 72


def password_problem(password: str) -> str | None:
    """Message d'erreur si le mot de passe ne respecte pas la règle, None sinon (inscription,
    installation et changement de mot de passe passent tous par ici)."""
    if len(password) < PASSWORD_MIN:
        return "Password must be at least 12 characters"
    if len(password.encode()) > PASSWORD_MAX_BYTES:
        return "Password is too long"
    return None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# Empreinte de calcul pour un identifiant inconnu : la connexion prend le même temps qu'il existe ou non
_DUMMY_HASH = bcrypt.hashpw(b"cowallet-dummy-password", bcrypt.gensalt()).decode()


def burn_password_check(plain: str) -> None:
    bcrypt.checkpw(plain.encode(), _DUMMY_HASH.encode())


def new_session_key() -> str:
    return secrets.token_hex(16)


def create_access_token(user: models.User) -> str:
    """Le jeton porte la clé de session du compte : la changer (mot de passe modifié) déconnecte
    tous les appareils, et un compte recréé avec le même numéro n'accepte pas les anciens jetons."""
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user.id), "username": user.username, "sk": user.session_key, "exp": expire}
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def _user_from_token(token: str, db: Session) -> models.User | None:
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        return None
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or payload.get("username") != user.username:
        return None
    key = user.session_key or ""
    sk = payload.get("sk")
    if sk is None:
        # Jetons émis avant la v1.1.1 (sans clé) : acceptés jusqu'à leur expiration, tant que le compte
        # garde la clé posée par la migration (préfixe « legacy- ») ; un changement de mot de passe les coupe
        return user if key.startswith("legacy-") else None
    return user if hmac.compare_digest(str(sk), key) else None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    user = _user_from_token(credentials.credentials, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme_optional),
    db: Session = Depends(get_db),
) -> models.User | None:
    if not credentials:
        return None
    return _user_from_token(credentials.credentials, db)


def get_current_group(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.Group:
    group = db.query(models.Group).filter(
        (models.Group.user1_id == current_user.id) |
        (models.Group.user2_id == current_user.id)
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="No group: create or join a group")
    return group
