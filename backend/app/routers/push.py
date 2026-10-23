import hmac
import ipaddress
import json
import logging
from typing import Annotated
from urllib.parse import urlsplit

import requests
from pywebpush import webpush, WebPushException
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from .. import models
from ..auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/push", tags=["push"])


class SubscriptionKeys(BaseModel):
    p256dh: Annotated[str, Field(max_length=200)]
    auth: Annotated[str, Field(max_length=100)]

class SubscriptionBody(BaseModel):
    endpoint: Annotated[str, Field(max_length=1024)]
    keys: SubscriptionKeys


# Le serveur envoie une requête à l'adresse fournie par le navigateur : seulement vers les services
# de notification des navigateurs, jamais vers une adresse du réseau local ou du serveur lui-même
PUSH_HOSTS = ("fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com")
MAX_SUBSCRIPTIONS_PER_USER = 10


def is_push_service(endpoint: str) -> bool:
    try:
        url = urlsplit(endpoint)
        host = (url.hostname or "").lower()
    except ValueError:
        return False
    if url.scheme != "https" or url.username or url.password or url.port not in (None, 443):
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return any(host == h or host.endswith("." + h) for h in PUSH_HOSTS)


def _no_redirect_session() -> requests.Session:
    """Un service de notification ne redirige pas : une redirection est refusée plutôt que suivie."""
    session = requests.Session()
    session.max_redirects = 0
    return session


def get_vapid_keys(db: Session):
    pub = db.query(models.AppConfig).filter_by(key="vapid_public").first()
    priv = db.query(models.AppConfig).filter_by(key="vapid_private").first()
    if not pub or not priv:
        return None, None
    return pub.value, priv.value


@router.get("/vapid-public")
def vapid_public(db: Session = Depends(get_db)):
    pub, _ = get_vapid_keys(db)
    if not pub:
        raise HTTPException(status_code=503, detail="VAPID not configured")
    return {"public_key": pub}


@router.post("/subscribe", status_code=201)
def subscribe(
    body: SubscriptionBody,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_push_service(body.endpoint):
        raise HTTPException(status_code=400, detail="Unsupported push service")
    existing = db.query(models.PushSubscription).filter_by(endpoint=body.endpoint).first()
    if existing:
        if existing.user_id != current_user.id:
            # Même appareil, autre compte (connexion de l'autre personne sur ce téléphone) : il présente
            # forcément les mêmes clés. Sans elles, on ne détourne pas les notifications de quelqu'un.
            same_keys = (hmac.compare_digest(existing.p256dh, body.keys.p256dh)
                         and hmac.compare_digest(existing.auth, body.keys.auth))
            if not same_keys:
                raise HTTPException(status_code=409, detail="Subscription belongs to another account")
        existing.p256dh = body.keys.p256dh
        existing.auth   = body.keys.auth
        existing.user_id = current_user.id
    else:
        db.add(models.PushSubscription(
            user_id  = current_user.id,
            endpoint = body.endpoint,
            p256dh   = body.keys.p256dh,
            auth     = body.keys.auth,
        ))
    db.flush()
    # Au-delà de 10 appareils, les plus anciens sont oubliés (chaque envoi coûte une requête)
    subs = (db.query(models.PushSubscription).filter_by(user_id=current_user.id)
            .order_by(models.PushSubscription.id.desc()).all())
    for old in subs[MAX_SUBSCRIPTIONS_PER_USER:]:
        db.delete(old)
    db.commit()
    return {"detail": "Subscription registered"}


@router.delete("/subscribe")
def unsubscribe(
    body: SubscriptionBody,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(models.PushSubscription).filter_by(
        endpoint=body.endpoint, user_id=current_user.id
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"detail": "Subscription removed"}


def send_notification(db: Session, user_id: int, title: str, body: str, url: str = "/", kind: str = None):
    """Envoie une notification push à tous les appareils d'un utilisateur.
    kind (partner, bank, reminder) : rien n'est envoyé si l'utilisateur a coupé ce type dans Réglages › Profil."""
    if kind:
        user = db.get(models.User, user_id)
        if user is not None and getattr(user, f"notif_{kind}") is False:
            return
    from py_vapid import Vapid
    pub_key, priv_pem = get_vapid_keys(db)
    if not pub_key or not priv_pem:
        return

    try:
        vapid = Vapid.from_pem(priv_pem.encode())
    except Exception as e:
        logger.warning("Failed to load VAPID key: %s", e)
        return

    subs = db.query(models.PushSubscription).filter_by(user_id=user_id).all()
    logger.info("send_notification: user_id=%s, subs=%s", user_id, len(subs))
    # Declarative Web Push (iOS 18.4+) : plus fiable, bypass le service worker
    payload = json.dumps({
        "web_push": 8030,
        "notification": {
            "title": title,
            "body": body,
            "navigate": url,
        }
    })

    session = _no_redirect_session()
    for sub in subs:
        if not is_push_service(sub.endpoint):
            # Enregistré avant le contrôle des adresses : jamais contacté, oublié
            db.delete(sub)
            db.commit()
            continue
        try:
            resp = webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=vapid,
                vapid_claims={"sub": "mailto:noreply@example.com"},
                ttl=86400,
                timeout=5,
                requests_session=session,
            )
            logger.info("Push sent to sub %s: status=%s", sub.id, getattr(resp, "status_code", "N/A"))
        except WebPushException as e:
            status = e.response.status_code if e.response is not None else None
            logger.warning("Push failed for sub %s: status=%s", sub.id, status)
            # Abonnement expiré ou retiré par le navigateur : on l'oublie
            # (« if e.response » était faux pour toute réponse 4xx, donc rien n'était jamais supprimé)
            if status in (404, 410):
                db.delete(sub)
                db.commit()
        except Exception as e:
            # Réseau, délai dépassé… : la notification est perdue, mais l'action de l'utilisateur
            # (déjà enregistrée) ne doit pas échouer pour autant, sinon il la refait en double.
            logger.warning("Push failed for sub %s: %s", sub.id, e)
