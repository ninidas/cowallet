"""Lots B et C (2026-10-20) : récurrente après coup, catégorie supprimée plus devinée, validation
annulable par l'un ou l'autre, budget vidé qui reste vide, suppression de compte complète, saisies bornées."""
from app import bank_sync, models
from .conftest import headers, register
from .test_lot1 import PW, app_client, _couple, _charge, _tx  # noqa: F401  (fixture partagée)


def _month(db, g, month):
    m = models.Month(group_id=g.id, label=f"Mois {month}", year=2026, month=month)
    db.add(m); db.commit()
    return m


def test_made_recurring_later_reaches_following_months(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    nov, dec = _month(db, g, 11), _month(db, g, 12)
    sep = _month(db, g, 9)
    c = _charge(db, oct_, 39.99, label="Internet")
    _charge(db, dec, 42.0, label="Internet")       # déjà saisie en décembre, à un autre montant
    r = app_client.put(f"/api/charges/{c.id}", headers=headers(t1), json={"is_recurring": True})
    assert r.status_code == 200 and r.json()["also_updated"] == 2
    rows = {ch.month_id: (ch.amount, ch.is_recurring) for ch in db.query(models.Charge).filter_by(label="Internet")}
    assert rows[nov.id] == (39.99, True)            # ajoutée en novembre
    assert rows[dec.id] == (42.0, True)             # décembre garde son montant, devient récurrente
    assert sep.id not in rows                       # rien avant le mois modifié


def test_deleted_category_is_no_longer_guessed(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    db.add(models.Category(group_id=g.id, name="Alimentation")); db.commit()
    _tx(db, oct_, "old", 30, category="Courses")    # catégorie supprimée depuis
    item = {"saltedge_id": "new", "date": "2026-10-20", "description": "SUPERMARCHE DEMO", "amount": 12,
            "account_name": "Compte joint"}
    bank_sync.add_transactions(db, g, oct_, [item])
    assert db.query(models.BankTransaction).filter_by(saltedge_id="new").one().category is None
    _tx(db, oct_, "old2", 30, category="Alimentation")
    bank_sync.add_transactions(db, g, oct_, [{**item, "saltedge_id": "new2"}])
    assert db.query(models.BankTransaction).filter_by(saltedge_id="new2").one().category == "Alimentation"


def test_either_partner_can_undo_validation(app_client, db):
    t1, t2, g, oct_ = _couple(app_client, db)
    assert app_client.post(f"/api/months/{oct_.id}/validate", headers=headers(t2)).json()["validated_by"] == g.user2_id
    assert app_client.post(f"/api/months/{oct_.id}/validate", headers=headers(t1)).json()["validated_by"] is None


def test_emptied_budget_stays_empty(client):
    t = register(client, "camille", PW)
    h = headers(t)
    assert client.get("/api/budget/seeded", headers=h).json() == {"seeded": False}
    e = client.post("/api/budget", headers=h, json={"type": "income", "label": "Salaire", "amount": 2500}).json()
    client.delete(f"/api/budget/{e['id']}", headers=h)
    assert client.get("/api/budget", headers=h).json() == []
    assert client.get("/api/budget/seeded", headers=h).json() == {"seeded": True}


def test_budget_rejects_unknown_type(client):
    t = register(client, "camille", PW)
    r = client.post("/api/budget", headers=headers(t), json={"type": "autre", "label": "x", "amount": 1})
    assert r.status_code == 422


def test_account_deletion_removes_personal_data(app_client, db):
    t1, t2, g, oct_ = _couple(app_client, db)
    u2 = g.user2_id
    conn = models.BankConnection(user_id=u2, saltedge_customer_id="s", status="active")
    db.add(conn); db.flush()
    db.add(models.BankAccount(connection_id=conn.id, saltedge_account_id="a", name="Compte"))
    db.add(models.BudgetEntry(user_id=u2, type="income", label="Salaire", amount=2000))
    db.add(models.PushSubscription(user_id=u2, endpoint="https://push", p256dh="k", auth="a"))
    db.add(models.AppConfig(key=f"bank_import_failing:{conn.id}", value="2026-10-20"))
    oct_.validated_by = u2
    db.commit()
    r = app_client.request("DELETE", "/api/users/me", headers=headers(t2), json={"password": PW})
    assert r.status_code == 204
    for model in (models.BankConnection, models.BankAccount, models.BudgetEntry, models.PushSubscription):
        assert db.query(model).count() == 0, model
    assert db.query(models.AppConfig).filter(models.AppConfig.key.like("bank_import_failing:%")).count() == 0
    db.refresh(oct_); db.refresh(g)
    assert oct_.validated_by is None and g.user2_id is None


def test_inputs_are_bounded(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    h = headers(t1)
    assert app_client.post("/api/months", headers=h, json={"year": 2026, "month": 13}).status_code == 422
    c = _charge(db, oct_, 10)
    assert app_client.put(f"/api/charges/{c.id}", headers=h, json={"amount": 12, "scope": "tous"}).status_code == 422
    r = app_client.post(f"/api/months/{oct_.id}/charges", headers=h,
                        json={"label": "x" * 5000, "amount": 1, "category": "Maison"})
    assert r.status_code == 422 and r.json()["detail"][0]["type"] == "string_too_long"


def test_login_error_is_translatable(client):
    register(client, "camille", PW)
    r = client.post("/api/auth/login", json={"username": "camille", "password": "mauvais-mot-de-passe"})
    assert r.status_code == 401 and r.json()["detail"] == "Invalid credentials"
