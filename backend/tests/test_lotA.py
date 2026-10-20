"""Lot A (2026-10-20) : échéances recopiées au bon montant, avance supérieure à sa part,
prévu et réel comptés pareil partout, transactions sans catégorie dans l'Historique."""
from app import models
from app.routers import stats
from .conftest import headers
from .test_lot1 import app_client, _couple, _charge, _tx  # noqa: F401  (fixture partagée)


def test_months_created_later_get_the_following_installment(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    app_client.post(f"/api/months/{oct_.id}/charges", headers=headers(t1), json={
        "label": "Canapé", "amount": 33.33, "category": "Maison",
        "installments_total": 3, "installments_left": 3, "total_amount": 100})
    for month in (11, 12):      # novembre et décembre créés après coup, comme d'habitude
        assert app_client.post("/api/months", headers=headers(t1), json={"year": 2026, "month": month, "user1_share": 50}).status_code == 201
    amounts = [c.amount for c in db.query(models.Charge).filter_by(label="Canapé").order_by(models.Charge.month_id)]
    assert amounts == [33.34, 33.33, 33.33] and round(sum(amounts), 2) == 100


def test_advance_above_share_is_owed_back(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    _charge(db, oct_, 900, label="Vacances", paid_by=1)
    _charge(db, oct_, 100, label="Courses")
    m = app_client.get(f"/api/months/{oct_.id}", headers=headers(t1)).json()
    assert (m["user1_to_transfer"], m["user1_to_receive"], m["user2_to_transfer"], m["user2_to_receive"]) == (0, 400, 500, 0)


def test_previous_month_compared_with_the_same_rule(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    sep = models.Month(group_id=g.id, label="Septembre 2026", year=2026, month=9); db.add(sep); db.commit()
    _charge(db, sep, 100, actual=130)
    _charge(db, oct_, 130)
    assert app_client.get(f"/api/months/{oct_.id}", headers=headers(t1)).json()["prev_total"] == 130


def test_history_counts_uncategorized_and_planned_is_planned(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    _charge(db, oct_, 600, actual=650, label="Courses", category="Alimentation")
    _tx(db, oct_, "a", 701.07, category="Alimentation")
    _tx(db, oct_, "b", 183.2)
    from fastapi import APIRouter
    api = APIRouter(prefix="/api"); api.include_router(stats.router); app_client.app.include_router(api)
    s = app_client.get("/api/stats", headers=headers(t1)).json()
    rows = {r["category"]: (r["budget"], r["actual"]) for r in s["by_category"]}
    assert rows == {"Alimentation": (600, 701.07), stats.UNCATEGORIZED: (0, 183.2)}
    assert s["by_month_actual"][0][stats.UNCATEGORIZED] == 183.2 and s["by_month"][0]["Alimentation"] == 600
