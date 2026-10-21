"""Bloc 1 (2026-10-20) : l'import du matin prévient ; nombre de transactions à catégoriser par mois."""
import datetime

from app import bank_sync, enablebanking, models, scheduler
from .conftest import headers
from .test_lot3 import client, _setup, _tx, _eb  # noqa: F401  (fixture partagée)


def _capture(monkeypatch):
    sent = []
    monkeypatch.setattr(scheduler, "send_notification",
                        lambda db, user_id, title, body, url="/": sent.append((user_id, title, body, url)))
    return sent


def _run(db, today):
    scheduler.notify_import_results(db, bank_sync.auto_import(db, today=today))


def test_new_transactions_notify_both_members(client, db, monkeypatch):
    _, g, (oct_,) = _setup(client, db)
    g.user2_id = 77; db.commit()
    _tx(db, oct_, "old", "EPICERIE CENTREFR DEMOVILLE", category="Alimentation")
    monkeypatch.setattr(enablebanking, "get_transactions", lambda acc, f, t=None, h=None: [
        _eb("n1", "EPICERIE CENTRE99DEMOVILLE", 42.1), _eb("n2", "MEUBLES DEMO   FR 99DEMOVILLE", 99.0)])
    monkeypatch.setattr(scheduler, "APP_LANG", "fr")
    sent = _capture(monkeypatch)
    _run(db, datetime.date(2026, 10, 20))
    assert {s[0] for s in sent} == {g.user1_id, 77}
    assert sent[0][1:] == ("2 nouvelles transactions", "Octobre 2026 · 1 à catégoriser",
                           f"/months/{oct_.id}?tab=transactions")
    sent.clear()
    _run(db, datetime.date(2026, 10, 21))          # rien de nouveau : pas de notification
    assert sent == []


def test_bank_error_notifies_owner_once_until_it_works(client, db, monkeypatch):
    _, g, _ = _setup(client, db)
    g.user2_id = 77; db.commit()
    monkeypatch.setattr(scheduler, "APP_LANG", "fr")
    sent = _capture(monkeypatch)
    fail = lambda *a: (_ for _ in ()).throw(Exception('HTTP 429 — {"error":"ASPSP_RATE_LIMIT_EXCEEDED"}'))
    monkeypatch.setattr(enablebanking, "get_transactions", fail)
    _run(db, datetime.date(2026, 10, 20))
    assert [(s[0], s[3]) for s in sent] == [(g.user1_id, "/settings/bank")] and "demain matin" in sent[0][2]
    _run(db, datetime.date(2026, 10, 21))          # toujours en échec : pas de 2e notification
    assert len(sent) == 1
    monkeypatch.setattr(enablebanking, "get_transactions", lambda *a: [])
    _run(db, datetime.date(2026, 10, 22))          # ça remarche : l'alerte est réarmée
    monkeypatch.setattr(enablebanking, "get_transactions", lambda *a: (_ for _ in ()).throw(Exception("HTTP 401")))
    _run(db, datetime.date(2026, 10, 23))
    assert len(sent) == 2 and "Réglages" in sent[1][2]


def test_months_report_uncategorized(client, db):
    token, g, (oct_,) = _setup(client, db)
    _tx(db, oct_, "a", "MEUBLES DEMO", category="Maison")
    _tx(db, oct_, "b", "PRLV SEPA PayPal (Europe")
    _tx(db, oct_, "c", "EPICERIE CENTREFR DEMOVILLE")
    from fastapi import APIRouter
    from app.routers import months
    api = APIRouter(prefix="/api"); api.include_router(months.router); client.app.include_router(api)
    assert client.get("/api/months", headers=headers(token)).json()[0]["uncategorized"] == 2
    assert client.get(f"/api/months/{oct_.id}", headers=headers(token)).json()["uncategorized"] == 2


def test_pending_transactions_are_not_imported(client, db, monkeypatch):
    _setup(client, db)
    pending = {**_eb("00000AA0A-000XXXX", "PRLV SEPA PEAGE DEMO", 15.6, date=None), "status": "PDNG",
               "value_date": "2026-10-20"}
    booked = {**_eb("202601000000AA00-XX0X0X0", "EPICERIE CENTREFR DEMOVILLE", 140.05), "status": "BOOK"}
    monkeypatch.setattr(enablebanking, "get_transactions", lambda *a: [pending, booked])
    bank_sync.auto_import(db, today=datetime.date(2026, 10, 20))
    assert [t.saltedge_id for t in db.query(models.BankTransaction)] == ["202601000000AA00-XX0X0X0"]


def test_actual_total_counts_uncategorized(client, db):
    token, g, (oct_,) = _setup(client, db)
    db.add(models.Charge(month_id=oct_.id, label="Courses", amount=600.0, category="Alimentation")); db.commit()
    _tx(db, oct_, "a", "CRF", amount=701.07, category="Alimentation")
    _tx(db, oct_, "b", "PRLV SEPA SYNDIC DEMO", amount=183.2)
    from fastapi import APIRouter
    from app.routers import months
    api = APIRouter(prefix="/api"); api.include_router(months.router); client.app.include_router(api)
    bva = client.get(f"/api/bank/months/{oct_.id}/budget-vs-actual", headers=headers(token)).json()
    assert (bva["total_budget"], bva["total_actual"], bva["uncategorized"], bva["uncategorized_count"]) == (600.0, 884.27, 183.2, 1)
    m = client.get("/api/months", headers=headers(token)).json()[0]
    assert (m["planned"], m["spent"]) == (600.0, 884.27)


def test_unreachable_bank_is_retried_once_at_noon(client, db, monkeypatch):
    """Banque injoignable à 7 h (panne Enable Banking du 20/10) : un seul nouvel essai à midi, et la
    notification d'échec seulement si ce second essai échoue aussi."""
    _setup(client, db)
    monkeypatch.setattr(scheduler, "APP_LANG", "fr")
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: type("S", (), {"__getattr__": lambda _, n: getattr(db, n), "close": lambda _: None})())
    sent = _capture(monkeypatch)
    day = datetime.date(2026, 10, 20)
    reads = []
    def down(*a):
        reads.append(1); raise Exception("ConnectTimeout")
    monkeypatch.setattr(enablebanking, "get_transactions", down)
    scheduler.import_bank_transactions(day)
    assert sent == [] and len(reads) == 1                     # pas encore d'alerte
    monkeypatch.setattr(enablebanking, "get_transactions", lambda *a: reads.append(1) or [_eb("n1", "MEUBLES DEMO", 99.0)])
    scheduler.retry_bank_import(day)
    assert len(reads) == 2 and sent[0][1] == "1 nouvelle transaction"
    scheduler.retry_bank_import(day)                          # une seule fois par jour
    assert len(reads) == 2
    # Second essai en échec aussi : là on prévient
    monkeypatch.setattr(enablebanking, "get_transactions", down)
    sent.clear()
    scheduler.import_bank_transactions(day + datetime.timedelta(days=1))
    scheduler.retry_bank_import(day + datetime.timedelta(days=1))
    assert [s[1] for s in sent] == ["L'import bancaire de ce matin a échoué"]


def test_rate_limit_is_not_retried_at_noon(client, db, monkeypatch):
    _setup(client, db)
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: type("S", (), {"__getattr__": lambda _, n: getattr(db, n), "close": lambda _: None})())
    sent = _capture(monkeypatch)
    reads = []
    def limited(*a):
        reads.append(1); raise Exception('HTTP 429 — {"error":"ASPSP_RATE_LIMIT_EXCEEDED"}')
    monkeypatch.setattr(enablebanking, "get_transactions", limited)
    day = datetime.date(2026, 10, 20)
    scheduler.import_bank_transactions(day)
    scheduler.retry_bank_import(day)
    assert len(reads) == 1 and len(sent) == 1
