"""Lot 3 (2026-10-20) : commerçant reconnu d'un achat à l'autre, import automatique du matin,
catégorie propagée aux achats du même commerçant, recherche dans tous les mois."""
import datetime

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app import bank_sync, enablebanking, models
from app.database import get_db
from app.routers import bank, search, users
from .conftest import register, headers

PW = "mot-de-passe-de-test"


@pytest.fixture
def client(db, monkeypatch):
    monkeypatch.setattr(enablebanking, "is_configured", lambda: True)
    app = FastAPI()
    api = APIRouter(prefix="/api")
    for r in (users, bank, search):
        api.include_router(r.router)
    app.include_router(api)

    def override():
        yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c


def _setup(client, db, months=((2026, 10, "Octobre 2026"),)):
    token = register(client, "camille", PW)
    u = db.query(models.User).filter_by(username="camille").first()
    g = models.Group(name="Notre budget", invite_code="ABCD", user1_id=u.id)
    db.add(g); db.commit()
    db.add(models.Category(group_id=g.id, name="Alimentation")); db.commit()   # l'import ne devine qu'une catégorie existante
    ms = [models.Month(group_id=g.id, label=l, year=y, month=m) for (y, m, l) in months]
    db.add_all(ms); db.commit()
    conn = models.BankConnection(user_id=u.id, saltedge_connection_id="sess", saltedge_customer_id="sess",
                                 provider_name="Banque Demo", provider_code="FR", status="active")
    db.add(conn); db.commit()
    db.add(models.BankAccount(connection_id=conn.id, saltedge_account_id="acc-1", name="Compte joint")); db.commit()
    return token, g, ms


def _tx(db, month, sid, description, amount=10.0, category=None, date="2026-10-05"):
    t = models.BankTransaction(month_id=month.id, saltedge_id=sid, date=date, description=description,
                               amount=amount, category=category, account_name="Compte joint")
    db.add(t); db.commit()
    return t


def _eb(sid, description, amount, debit=True, date="2026-10-12"):
    return {"transaction_id": sid, "booking_date": date, "remittance_information": [description],
            "transaction_amount": {"amount": str(amount), "currency": "EUR"},
            "credit_debit_indicator": "DBIT" if debit else "CRDT"}


@pytest.mark.parametrize("description,key", [
    ("HYPER DEMO     FR DEMOVILLE", "HYPER DEMO"),
    ("EPICERIE CENTREFR DEMOVILLE", "EPICERIE CENTRE"),
    ("EPICERIE CENTRE99DEMOVILLE", "EPICERIE CENTRE"),
    ("PRLV SEPA Energie clients", "ENERGIE CLIENTS"),
    ("ECHEANCE PRET", "ECHEANCE PRET"),
    ("Électricité", "ELECTRICITE"),
])
def test_merchant_key(description, key):
    assert bank_sync.merchant_key(description) == key


def test_auto_import_morning(client, db, monkeypatch):
    _, g, (oct_,) = _setup(client, db)
    _tx(db, oct_, "old", "EPICERIE CENTREFR DEMOVILLE", category="Alimentation")
    monkeypatch.setattr(enablebanking, "get_transactions", lambda acc, f, t=None, h=None: [
        _eb("new-1", "EPICERIE CENTRE99DEMOVILLE", 42.1),       # même épicerie, autre magasin
        _eb("new-2", "MEUBLES DEMO   FR 99DEMOVILLE", 99.0),      # inconnu : sans catégorie
        _eb("salaire", "VIR SALAIRE", 2700, debit=False),      # crédit : jamais importé tout seul
        _eb("old", "EPICERIE CENTREFR DEMOVILLE", 10.0),        # déjà là : pas de doublon
    ])
    report = bank_sync.auto_import(db, today=datetime.date(2026, 10, 20))
    assert [{k: r[k] for k in ("month", "imported", "skipped", "auto_categorized")} for r in report] == \
        [{"month": "Octobre 2026", "imported": 2, "skipped": 1, "auto_categorized": 1}]
    got = {t.saltedge_id: (t.amount, t.category) for t in db.query(models.BankTransaction)}
    assert got["new-1"] == (42.1, "Alimentation") and got["new-2"] == (99.0, None) and "salaire" not in got


def test_auto_import_completes_previous_month_early_in_month(client, db, monkeypatch):
    _setup(client, db, months=((2026, 10, "Octobre 2026"), (2026, 11, "Novembre 2026")))
    asked = []
    monkeypatch.setattr(enablebanking, "get_transactions", lambda acc, f, t=None, h=None: asked.append((f, t, h)) or [])
    # Une seule lecture par compte, toute la période, sans en-têtes PSU (lecture en l'absence de l'utilisateur)
    bank_sync.auto_import(db, today=datetime.date(2026, 11, 3))
    assert asked == [("2026-10-01", "2026-11-03", None)]
    asked.clear()
    bank_sync.auto_import(db, today=datetime.date(2026, 11, 12))
    assert asked == [("2026-11-01", "2026-11-12", None)]


def test_auto_import_splits_the_period_by_month(client, db, monkeypatch):
    _setup(client, db, months=((2026, 10, "Octobre 2026"), (2026, 11, "Novembre 2026")))
    monkeypatch.setattr(enablebanking, "get_transactions", lambda acc, f, t=None, h=None: [
        _eb("oct", "MEUBLES DEMO   FR 99DEMOVILLE", 30, date="2026-10-30"),
        _eb("nov", "MEUBLES DEMO   FR 99DEMOVILLE", 40, date="2026-11-02"),
    ])
    bank_sync.auto_import(db, today=datetime.date(2026, 11, 3))
    got = {t.saltedge_id: t.month.label for t in db.query(models.BankTransaction)}
    assert got == {"oct": "Octobre 2026", "nov": "Novembre 2026"}


def test_manual_import_screen_sends_psu_headers(client, db, monkeypatch):
    token, _, _ = _setup(client, db)
    seen = []
    monkeypatch.setattr(enablebanking, "get_transactions", lambda acc, f, t=None, h=None: seen.append(h) or [])
    r = client.get("/api/bank/transactions?from_date=2026-10-01&to_date=2026-10-31",
                   headers={**headers(token), "CF-Connecting-IP": "203.0.113.9", "User-Agent": "iPhone Safari"})
    assert r.status_code == 200
    assert seen == [{"Psu-Ip-Address": "203.0.113.9", "Psu-User-Agent": "iPhone Safari"}]


def test_all_pages_are_read(monkeypatch):
    pages = {None: {"transactions": [{"id": 1}], "continuation_key": "p2"},
             "p2": {"transactions": [{"id": 2}], "continuation_key": None}}
    calls = []
    class R:
        def __init__(self, d): self.d = d
        is_success = True
        def json(self): return self.d
    monkeypatch.setattr(enablebanking, "_headers", lambda: {"Authorization": "x"})
    monkeypatch.setattr(enablebanking.httpx, "get", lambda url, headers, params, timeout: calls.append(dict(headers)) or R(pages[params.get("continuation_key")]))
    assert enablebanking.get_transactions("acc", "2026-10-01", psu_headers={"Psu-Ip-Address": "1.2.3.4"}) == [{"id": 1}, {"id": 2}]
    assert len(calls) == 2 and all(c["Psu-Ip-Address"] == "1.2.3.4" for c in calls)


def test_auto_import_skips_missing_month_and_bank_errors(client, db, monkeypatch):
    _setup(client, db)
    monkeypatch.setattr(enablebanking, "get_transactions", lambda *a: (_ for _ in ()).throw(Exception("HTTP 401")))
    assert bank_sync.auto_import(db, today=datetime.date(2026, 12, 15)) == []     # décembre pas créé
    report = bank_sync.auto_import(db, today=datetime.date(2026, 10, 15))
    assert len(report) == 1 and "HTTP 401" in report[0]["error"]


def test_categorizing_one_categorizes_same_merchant(client, db):
    token, g, (oct_,) = _setup(client, db)
    a = _tx(db, oct_, "a", "EPICERIE CENTREFR DEMOVILLE")
    _tx(db, oct_, "b", "EPICERIE CENTRE99DEMOVILLE")
    _tx(db, oct_, "c", "MEUBLES DEMO   FR 99DEMOVILLE")
    _tx(db, oct_, "d", "EPICERIE CENTREFR DEMOVILLE", category="Autre")     # choix déjà fait : on n'y touche pas
    r = client.patch(f"/api/bank/transactions/{a.id}", json={"category": "Alimentation"}, headers=headers(token))
    assert r.status_code == 200 and r.json()["also_categorized"] == 1
    got = {t.saltedge_id: t.category for t in db.query(models.BankTransaction)}
    assert got == {"a": "Alimentation", "b": "Alimentation", "c": None, "d": "Autre"}


def test_search_finds_charges_and_transactions(client, db):
    token, g, (oct_,) = _setup(client, db)
    db.add(models.Charge(month_id=oct_.id, label="Électricité", amount=138.0, category="Maison")); db.commit()
    _tx(db, oct_, "a", "PRLV SEPA Energie clients", category="Maison")
    r = client.get("/api/search", params={"q": "electricite"}, headers=headers(token)).json()
    assert [c["label"] for c in r["charges"]] == ["Électricité"] and r["transactions"] == []
    r = client.get("/api/search", params={"q": "maison"}, headers=headers(token)).json()
    assert len(r["charges"]) == 1 and len(r["transactions"]) == 1 and r["transactions"][0]["month_label"] == "Octobre 2026"
    assert client.get("/api/search", params={"q": "e"}, headers=headers(token)).json() == {"charges": [], "transactions": []}


def test_search_stays_in_own_group(client, db):
    token, g, (oct_,) = _setup(client, db)
    other = models.Group(name="Autres", invite_code="ZZZZ", user1_id=999); db.add(other); db.commit()
    om = models.Month(group_id=other.id, label="Octobre 2026", year=2026, month=10); db.add(om); db.commit()
    db.add(models.Charge(month_id=om.id, label="Loyer secret", amount=900.0, category="Maison")); db.commit()
    assert client.get("/api/search", params={"q": "loyer"}, headers=headers(token)).json()["charges"] == []


def test_paypal_never_gets_a_guessed_category(client, db, monkeypatch):
    token, g, (oct_,) = _setup(client, db)
    a = _tx(db, oct_, "pp1", "PRLV SEPA PayPal (Europe", category="Autre")
    b = _tx(db, oct_, "pp2", "PRLV SEPA PayPal (Europe")
    monkeypatch.setattr(enablebanking, "get_transactions", lambda acc, f, t=None, h=None: [_eb("pp3", "PRLV SEPA PayPal (Europe", 50)])
    bank_sync.auto_import(db, today=datetime.date(2026, 10, 20))
    c = _tx(db, oct_, "epicerie", "EPICERIE CENTREFR DEMOVILLE")
    client.patch(f"/api/bank/transactions/{a.id}", json={"category": "Maison"}, headers=headers(token))
    got = {t.saltedge_id: t.category for t in db.query(models.BankTransaction)}
    assert got["pp2"] is None and got["pp3"] is None and got["epicerie"] is None
