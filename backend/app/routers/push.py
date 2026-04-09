import json
import logging
from pywebpush import webpush, WebPushException
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from .. import models
from ..auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/push", tags=["push"])


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class SubscriptionBody(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


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
        raise HTTPException(status_code=503, detail="VAPID non configuré")
    return {"public_key": pub}


@router.post("/subscribe", status_code=201)
def subscribe(
    body: SubscriptionBody,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(models.PushSubscription).filter_by(endpoint=body.endpoint).first()
    if existing:
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
    db.commit()
    return {"detail": "Subscription enregistrée"}


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
    return {"detail": "Subscription supprimée"}


def send_notification(db: Session, user_id: int, title: str, body: str, url: str = "/"):
    """Envoie une notification push à tous les appareils d'un utilisateur."""
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
    # Declarative Web Push (iOS 18.4+) — plus fiable, bypass le service worker
    payload = json.dumps({
        "web_push": 8030,
        "notification": {
            "title": title,
            "body": body,
            "navigate": url,
        }
    })

    for sub in subs:
        try:
            resp = webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=vapid,
                vapid_claims={"sub": "mailto:admin@cowallet.nhma.fr"},
                ttl=86400,
            )
            logger.info("Push sent to sub %s — status=%s body=%s", sub.id, resp.status_code if resp else 'N/A', resp.text[:200] if resp else '')
        except WebPushException as e:
            logger.warning("Push failed for sub %s: %s", sub.id, e)
            if e.response and e.response.status_code in (404, 410):
                db.delete(sub)
                db.commit()
