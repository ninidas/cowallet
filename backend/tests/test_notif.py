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


def test_budget_overrun_alerts_once_per_category_and_for_the_total(app_client, db, monkeypatch):
    from app import scheduler
    from .test_lot1 import _charge, _tx
    _, _, g, oct_ = _couple(app_client, db)
    monkeypatch.setattr(scheduler, "APP_LANG", "fr")
    sent = []
    monkeypatch.setattr(scheduler, "send_notification", lambda db, uid, title, body, url="/", kind=None: sent.append((uid, title, body, url, kind)))
    for cat, amount in (("Alimentation", 600), ("Bébé", 143.75), ("Divertissement", 200), ("Maison", 1662.9), ("Voiture", 60)):
        _charge(db, oct_, amount, label=cat, category=cat)
    check = lambda: scheduler.notify_budget_overruns(db, {oct_.id})

    _tx(db, oct_, "t1", 74.17, "Voiture")
    check()
    assert sent == [(u, "Voiture dépasse son budget", "Octobre : 74\u00a0€ dépensés sur 60\u00a0€ prévus", f"/months/{oct_.id}", "budget")
                    for u in (g.user1_id, g.user2_id)]
    sent.clear(); check()
    assert sent == []                                  # déjà signalée ce mois-ci

    _tx(db, oct_, "t2", 666.43, "Alimentation"); _tx(db, oct_, "t3", 1755.18, "Maison")
    check()
    assert [s[1:3] for s in sent][0] == ("2 catégories dépassent leur budget",
                                         "Alimentation 666\u00a0€ / 600\u00a0€ · Maison 1\u00a0755\u00a0€ / 1\u00a0663\u00a0€")
    # Sans prévu (Autre) ou sans catégorie : rien seules, mais comptées dans le total
    sent.clear()
    _tx(db, oct_, "t4", 54.08, "Autre"); _tx(db, oct_, "t5", 206.19)
    scheduler.notify_import_results(db, [{"connection_id": 1, "group_id": g.id, "month_id": oct_.id,
                                          "month": "Octobre 2026", "imported": 2, "auto_categorized": 1}])
    budget = [s for s in sent if s[4] == "budget"]
    assert [s[1:3] for s in budget] == [("Budget d'octobre dépassé",
        "2\u00a0756\u00a0€ dépensés sur 2\u00a0667\u00a0€ prévus (+89\u00a0€)\n"
        "Alimentation 666\u00a0€ / 600\u00a0€ · Maison 1\u00a0755\u00a0€ / 1\u00a0663\u00a0€ · Voiture 74\u00a0€ / 60\u00a0€")] * 2
    sent.clear(); check()
    assert sent == []


def test_budget_alerts_can_be_turned_off(app_client, db):
    t1, _, g, _ = _couple(app_client, db)
    api = APIRouter(prefix="/api"); api.include_router(settings.router); app_client.app.include_router(api)
    assert app_client.patch("/api/settings", headers=headers(t1), json={"notif_budget": False}).status_code == 200
    assert db.get(models.User, g.user1_id).notif_budget is False
