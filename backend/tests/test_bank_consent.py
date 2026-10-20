"""Accès bancaire Enable Banking : durée maximale demandée, connexion sans compte refusée, échéance affichée, accès expiré signalé, rappel avant la fin."""
import datetime

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app import enablebanking, models, scheduler
from app.database import get_db
from app.routers import bank, users
from .conftest import register, headers

TODAY = datetime.date.today()
PW = "mot-de-passe-de-test"   # 12 caractères minimum (le conftest en utilise un trop court)


@pytest.fixture
def bclient(db, monkeypatch):
    monkeypatch.setattr(enablebanking, "is_configured", lambda: True)
    enablebanking._consent_cache.clear()
    app = FastAPI()
    api = APIRouter(prefix="/api")
    api.include_router(users.router)
    api.include_router(bank.router)
    app.include_router(api)
    def override():
        yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c


def _connect(db, session_id="sess-1", user_id=1):
    conn = models.BankConnection(user_id=user_id, saltedge_connection_id=session_id, saltedge_customer_id=session_id,
                                 provider_name="Banque Demo", provider_code="FR", status="active")
    db.add(conn); db.commit()
    db.add(models.BankAccount(connection_id=conn.id, saltedge_account_id="acc-1", name="Compte joint")); db.commit()
    return conn


def _session(monkeypatch, status, valid_until):
    monkeypatch.setattr(enablebanking, "get_session",
                        lambda sid: {"status": status, "access": {"valid_until": f"{valid_until.isoformat()}T00:00:00Z"}})


def test_start_auth_asks_the_bank_maximum(monkeypatch):
    sent = {}
    class R:
        is_success = True
        def json(self): return {"url": "https://bank", "auth_code": "x"}
    monkeypatch.setattr(enablebanking, "_headers", lambda: {})
    monkeypatch.setattr(enablebanking.httpx, "post", lambda url, headers, json, timeout: sent.update(json) or R())
    monkeypatch.setattr(enablebanking, "get_aspsps", lambda c: [{"name": "Banque Demo", "maximum_consent_validity": 15552000}])
    enablebanking.start_auth("Banque Demo", "FR", "https://cowallet/bank/callback")
    assert sent["access"]["valid_until"] == f"{(TODAY + datetime.timedelta(days=179)).isoformat()}T00:00:00Z"
    # Banque inconnue ou liste indisponible : 90 jours comme avant
    monkeypatch.setattr(enablebanking, "get_aspsps", lambda c: [])
    enablebanking.start_auth("Autre banque", "FR", "https://cowallet/bank/callback")
    assert sent["access"]["valid_until"] == f"{(TODAY + datetime.timedelta(days=89)).isoformat()}T00:00:00Z"


def test_status_expired(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW); _connect(db)
    _session(monkeypatch, "CLOSED", datetime.date(2026, 7, 13))
    st = bclient.get("/api/bank/status", headers=headers(token)).json()
    assert st["connected"] and st["expired"] and st["valid_until"] == "2026-07-13" and not st["expires_soon"]


def test_status_expires_soon_then_ok(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW); _connect(db)
    _session(monkeypatch, "AUTHORIZED", TODAY + datetime.timedelta(days=10))
    st = bclient.get("/api/bank/status", headers=headers(token)).json()
    assert not st["expired"] and st["expires_soon"]
    enablebanking._consent_cache.clear()
    _session(monkeypatch, "AUTHORIZED", TODAY + datetime.timedelta(days=150))
    st = bclient.get("/api/bank/status", headers=headers(token)).json()
    assert not st["expired"] and not st["expires_soon"]


def test_status_survives_enable_banking_outage(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW); _connect(db)
    monkeypatch.setattr(enablebanking, "get_session", lambda sid: (_ for _ in ()).throw(Exception("HTTP 503")))
    st = bclient.get("/api/bank/status", headers=headers(token)).json()
    assert st["connected"] and "expired" not in st


def test_status_without_consent_does_not_wait_for_enable_banking(bclient, db, monkeypatch):
    """Réglages : la carte Banque s'affiche d'abord sans l'échéance, sans attendre Enable Banking (parfois 15 s)."""
    token = register(bclient, "camille", PW); _connect(db)
    monkeypatch.setattr(enablebanking, "get_session", lambda sid: pytest.fail("Enable Banking appelé"))
    st = bclient.get("/api/bank/status?consent=false", headers=headers(token)).json()
    assert st["connected"] and st["provider_name"] == "Banque Demo" and "valid_until" not in st


def test_transactions_expired_gives_clear_error(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW); _connect(db)
    _session(monkeypatch, "CLOSED", datetime.date(2026, 7, 13))
    monkeypatch.setattr(enablebanking, "get_transactions", lambda *a: (_ for _ in ()).throw(Exception("HTTP 401 — Unauthorized")))
    r = bclient.get("/api/bank/transactions?from_date=2026-11-01&to_date=2026-11-30", headers=headers(token))
    assert r.status_code == 409 and r.json()["detail"] == "Bank access expired"


def test_other_errors_stay_502(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW); _connect(db)
    _session(monkeypatch, "AUTHORIZED", TODAY + datetime.timedelta(days=100))
    monkeypatch.setattr(enablebanking, "get_transactions", lambda *a: (_ for _ in ()).throw(Exception("HTTP 500")))
    r = bclient.get("/api/bank/transactions?from_date=2026-11-01", headers=headers(token))
    assert r.status_code == 502


def test_reconnect_replaces_old_connection(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW); old = _connect(db, "old-session")
    db.add(models.BankConnection(user_id=old.user_id, saltedge_customer_id="code", provider_name="Banque Demo",
                                 provider_code="FR", status="pending")); db.commit()
    monkeypatch.setattr(enablebanking, "create_session",
                        lambda code: {"session_id": "new-session", "accounts": [{"uid": "acc-2", "name": "Compte joint"}]})
    r = bclient.post("/api/bank/finish", json={"auth_code": "code"}, headers=headers(token))
    assert r.status_code == 200
    conns = db.query(models.BankConnection).all()
    assert [(c.saltedge_connection_id, c.status) for c in conns] == [("new-session", "active")]
    assert [a.saltedge_account_id for a in db.query(models.BankAccount).all()] == ["acc-2"]


def test_reminders_7_days_1_day_and_expiry_day(db, monkeypatch):
    sent = []
    monkeypatch.setattr(enablebanking, "is_configured", lambda: True)
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: db)
    monkeypatch.setattr(db, "close", lambda: None)
    monkeypatch.setattr(scheduler, "send_notification", lambda d, uid, title, body, url: sent.append((uid, title, url)))
    _connect(db)
    for days, expected in ((7, 1), (5, 0), (1, 1), (0, 1), (-3, 0)):
        sent.clear(); enablebanking._consent_cache.clear()
        _session(monkeypatch, "AUTHORIZED" if days > 0 else "CLOSED", TODAY + datetime.timedelta(days=days))
        scheduler.send_bank_expiry_reminders()
        assert len(sent) == expected, (days, sent)
        if expected:
            assert sent[0][2] == "/settings/bank"


def test_reconnect_without_accounts_keeps_old_connection(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW); old = _connect(db, "old-session")
    db.add(models.BankConnection(user_id=old.user_id, saltedge_customer_id="code", provider_name="Banque Demo",
                                 provider_code="FR", status="pending")); db.commit()
    monkeypatch.setattr(enablebanking, "create_session", lambda code: {"session_id": "empty-session", "accounts": []})
    r = bclient.post("/api/bank/finish", json={"auth_code": "code"}, headers=headers(token))
    assert r.status_code == 422 and r.json()["detail"] == "No account shared by the bank"
    assert [(c.saltedge_connection_id, c.status) for c in db.query(models.BankConnection).all()] == [("old-session", "active")]
    assert [a.saltedge_account_id for a in db.query(models.BankAccount).all()] == ["acc-1"]


def test_status_flags_connection_without_accounts(bclient, db, monkeypatch):
    token = register(bclient, "camille", PW)
    db.add(models.BankConnection(user_id=1, saltedge_connection_id="s", saltedge_customer_id="s",
                                 provider_name="Banque Demo", provider_code="FR", status="active")); db.commit()
    _session(monkeypatch, "AUTHORIZED", TODAY + datetime.timedelta(days=170))
    st = bclient.get("/api/bank/status", headers=headers(token)).json()
    assert st["connected"] and st["no_accounts"] and not st["expired"]
    assert not bclient.get("/api/bank/status", headers=headers(token)).json()["expires_soon"]
