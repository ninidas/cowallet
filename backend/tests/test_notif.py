"""Notifications (2026-10-21) : choix par type pour chaque personne, ajouts de dépenses regroupés."""
import time

from fastapi import APIRouter

from app import models
from app.routers import charges, push, settings
from .conftest import headers
from .test_lot1 import app_client, _couple  # noqa: F401  (fixture partagée)


def _add(client, token, month, label, amount):
    r = client.post(f"/api/months/{month.id}/charges", headers=headers(token),
                    json={"label": label, "amount": amount, "category": "Maison"})
    assert r.status_code == 201


def test_added_expenses_are_grouped_into_one_notification(app_client, db, monkeypatch):
    t1, _, g, oct_ = _couple(app_client, db)
    sent = []
    monkeypatch.setattr(charges, "send_notification", lambda db, uid, title, body, url="/", kind=None: sent.append((uid, title, body, kind)))
    for label, amount in (("Pharmacie", 12), ("Lave-linge", 232.39), ("Eau", 66.9)):
        _add(app_client, t1, oct_, label, amount)
    assert sent == []                                  # rien pendant la saisie
    charges.flush_added_charges(db, now=time.time() + 30)
    assert sent == []                                  # encore en train d'ajouter
    charges.flush_added_charges(db, now=time.time() + charges.QUIET + 1)
    assert sent == [(g.user2_id, "camille a ajouté 3 dépenses sur Octobre 2026",
                     "Pharmacie (12,00€), Lave-linge (232,39€), Eau (66,90€)", "partner")]
    # Un seul ajout : le texte d'avant
    sent.clear()
    _add(app_client, t1, oct_, "Pain", 2.5)
    charges.flush_added_charges(db, now=time.time() + charges.QUIET + 1)
    assert [s[1] for s in sent] == ["camille a ajouté 'Pain' (2,50€) sur Octobre 2026"]
    charges.flush_added_charges(db, now=time.time() + charges.QUIET + 1)
    assert len(sent) == 1                              # envoyé une seule fois


def test_each_person_chooses_notification_types(app_client, db, monkeypatch):
    t1, _, g, _ = _couple(app_client, db)
    api = APIRouter(prefix="/api"); api.include_router(settings.router); app_client.app.include_router(api)
    assert app_client.patch("/api/settings", headers=headers(t1), json={"notif_bank": False}).status_code == 200
    me = db.get(models.User, g.user1_id)
    assert (me.notif_partner, me.notif_bank, me.notif_reminder) == (True, False, True)

    pushed = []
    db.add(models.PushSubscription(user_id=me.id, endpoint="https://web.push.apple.com/x", p256dh="k", auth="a")); db.commit()
    monkeypatch.setattr(push, "get_vapid_keys", lambda db: ("pub", "priv"))
    import py_vapid
    monkeypatch.setattr(py_vapid.Vapid, "from_pem", staticmethod(lambda pem: object()))
    monkeypatch.setattr(push, "webpush", lambda **kw: pushed.append(kw["data"]))
    push.send_notification(db, me.id, "3 nouvelles transactions", "", kind="bank")
    assert pushed == []                                # coupé par Camille
    push.send_notification(db, me.id, "lou a ajouté 2 dépenses", "", kind="partner")
    push.send_notification(db, me.id, "Test", "")      # sans type : toujours envoyé
    assert len(pushed) == 2
