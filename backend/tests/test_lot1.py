"""Lot 1 de fiabilité (2026-10-19) : transactions supprimées avec leurs mois, montants réels partout,
parts qui tombent juste, remboursements, renommage de catégorie, notifications qui n'échouent jamais,
limite de connexion par visiteur, fichiers hors du front refusés."""
import csv
import io

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import models
from app.database import get_db
from app.limiter import client_ip
from app.routers import bank, categories, charges, export, months, push, users
from .conftest import register, headers

PW = "mot-de-passe-de-test"   # 12 caractères minimum (le conftest en utilise un trop court)


@pytest.fixture
def app_client(db, monkeypatch):
    sent = []
    monkeypatch.setattr(charges, "send_notification", lambda db, uid, title, body, url="/": sent.append(title))
    monkeypatch.setattr(months, "send_notification", lambda db, uid, title, body, url="/": sent.append(title))
    monkeypatch.setattr(charges, "APP_LANG", "fr")
    app = FastAPI()
    api = APIRouter(prefix="/api")
    for r in (users, months, charges, categories, bank, export):
        api.include_router(r.router)
    app.include_router(api)

    def override():
        yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        c.sent = sent
        yield c


def _couple(client, db, share=50):
    """Camille (user1) et Lou (user2) dans un groupe, avec un mois réglé par les deux."""
    t1 = register(client, "camille", PW)
    t2 = register(client, "lou", PW)
    u1 = db.query(models.User).filter_by(username="camille").first()
    u2 = db.query(models.User).filter_by(username="lou").first()
    g = models.Group(name="Notre budget", invite_code="ABCD", user1_id=u1.id, user2_id=u2.id)
    db.add(g); db.commit()
    m = models.Month(group_id=g.id, label="Octobre 2026", year=2026, month=10, user1_share=share,
                     user1_transferred=True, user2_transferred=True)
    db.add(m); db.commit()
    return t1, t2, g, m


def _charge(db, m, amount, actual=None, label="Eau", category="Maison", paid_by=None):
    c = models.Charge(month_id=m.id, label=label, amount=amount, actual_amount=actual, category=category, paid_by=paid_by)
    db.add(c); db.commit()
    return c


def _tx(db, m, sid, amount, category=None):
    db.add(models.BankTransaction(month_id=m.id, saltedge_id=sid, date="2026-10-05", description="SUPERMARCHE DEMO",
                                  amount=amount, category=category, account_name="Compte joint"))
    db.commit()


def test_bulk_delete_removes_bank_transactions(app_client, db):
    t1, _, g, m = _couple(app_client, db)
    _tx(db, m, "tx-1", 12.5)
    r = app_client.request("DELETE", "/api/months/bulk", json={"ids": [m.id]}, headers=headers(t1))
    assert r.status_code == 204
    assert db.query(models.BankTransaction).count() == 0


def test_actual_amount_change_notifies_partner(app_client, db):
    t1, _, g, m = _couple(app_client, db)
    c = _charge(db, m, 60.0)
    r = app_client.put(f"/api/charges/{c.id}", json={"actual_amount": 66.9}, headers=headers(t1))
    assert r.status_code == 200
    assert app_client.sent and "de 60,00€ à 66,90€" in app_client.sent[-1]


def test_shares_always_add_up_to_total(db):
    m = models.Month(label="x", year=2026, month=10, user1_share=60)
    m.charges = [models.Charge(label="a", amount=100.01, category="c"), models.Charge(label="b", amount=33.33, actual_amount=33.34, category="c")]
    t = months.compute_totals(m)
    assert t["total"] == 133.35
    assert round(t["user1_due"] + t["user2_due"], 2) == t["total"]


def test_refund_is_imported_as_negative(app_client, db):
    t1, _, g, m = _couple(app_client, db)
    item = {"date": "2026-10-03", "description": "REMB BOUTIQUE DEMO", "amount": 25.0, "account_name": "Compte joint"}
    r = app_client.post("/api/bank/transactions/import", headers=headers(t1), json={"month_id": m.id, "transactions": [
        {**item, "saltedge_id": "credit-1", "is_debit": False},
        {**item, "saltedge_id": "debit-1", "description": "SUPERMARCHE DEMO"},
    ]})
    assert r.status_code == 200 and r.json()["imported"] == 2
    amounts = {t.saltedge_id: t.amount for t in db.query(models.BankTransaction)}
    assert amounts == {"credit-1": -25.0, "debit-1": 25.0}


def test_category_rename_follows_bank_transactions(app_client, db):
    t1, _, g, m = _couple(app_client, db)
    cat = models.Category(group_id=g.id, name="Bouffe"); db.add(cat); db.commit()
    _charge(db, m, 10.0, category="Bouffe")
    _tx(db, m, "tx-1", 10.0, category="Bouffe")
    r = app_client.patch(f"/api/categories/{cat.id}", json={"name": "Alimentation"}, headers=headers(t1))
    assert r.status_code == 200
    assert {c.category for c in db.query(models.Charge)} == {"Alimentation"}
    assert {t.category for t in db.query(models.BankTransaction)} == {"Alimentation"}


def test_export_uses_actual_amounts_and_payer_names(app_client, db):
    t1, _, g, m = _couple(app_client, db)
    _charge(db, m, 60.0, actual=66.9, paid_by=2)
    r = app_client.get("/api/export/csv", headers=headers(t1))
    rows = list(csv.reader(io.StringIO(r.text.lstrip("﻿")), delimiter=";"))
    head, row = rows[0], rows[1]
    assert row[head.index("Montant")] == "66,90" and row[head.index("Montant prévu")] == "60,00"
    assert row[head.index("Total mois")] == "66,90"
    assert row[head.index("Avancé par")] == "lou"


def test_push_failure_never_breaks_the_request(db, monkeypatch):
    db.add(models.PushSubscription(user_id=1, endpoint="https://web.push.apple.com/x", p256dh="k", auth="a")); db.commit()
    monkeypatch.setattr(push, "get_vapid_keys", lambda db: ("pub", "priv"))
    import py_vapid
    monkeypatch.setattr(py_vapid.Vapid, "from_pem", staticmethod(lambda pem: object()))
    def boom(**kw):
        assert kw["timeout"] == 10
        raise ConnectionError("réseau coupé")
    monkeypatch.setattr(push, "webpush", boom)
    push.send_notification(db, 1, "titre", "")   # ne lève rien


def _request(headers):
    return Request({"type": "http", "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
                    "client": ("10.0.0.21", 1234)})


def test_rate_limit_is_per_visitor():
    assert client_ip(_request({"CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "10.0.0.1"})) == "203.0.113.7"
    assert client_ip(_request({"X-Forwarded-For": "198.51.100.2, 10.0.0.21"})) == "198.51.100.2"
    assert client_ip(_request({})) == "10.0.0.21"


def test_spa_refuses_files_outside_frontend(tmp_path, monkeypatch):
    import app.main as main
    front = tmp_path / "frontend_dist"; front.mkdir()
    (front / "index.html").write_text("APP")
    (front / "sw.js").write_text("SW")
    (tmp_path / "secret.pem").write_text("CLE")
    monkeypatch.setattr(main, "_FRONTEND_DIST", front)
    import asyncio
    body = lambda p: asyncio.run(main.spa_handler(p)).path
    assert body("sw.js").endswith("sw.js")
    assert body("../secret.pem").endswith("index.html")
    assert body("months/12").endswith("index.html")
