"""Bloc 4 (2026-10-20) : paiement en plusieurs fois réparti au centime près."""
import pytest

from app import models
from app.routers.charges import split_installments
from .conftest import headers
from .test_lot1 import app_client, _couple  # noqa: F401  (fixture partagée)


@pytest.mark.parametrize("total,n,expected", [
    (100, 3, (33.34, 33.33)),
    (658.0, 3, (219.34, 219.33)),     # vol de Prague, comme PayPal l'a prélevé
    (175, 4, (43.75, 43.75)),
    (0.05, 3, (0.03, 0.01)),
])
def test_split_installments(total, n, expected):
    first, rest = split_installments(total, n)
    assert (first, rest) == expected and round(first + rest * (n - 1), 2) == total


def test_installments_add_up_to_the_total(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    nov = models.Month(group_id=g.id, label="Novembre 2026", year=2026, month=11)
    dec = models.Month(group_id=g.id, label="Décembre 2026", year=2026, month=12)
    db.add_all([nov, dec]); db.commit()
    r = app_client.post(f"/api/months/{oct_.id}/charges", headers=headers(t1), json={
        "label": "Canapé", "amount": 33.33, "category": "Maison",
        "installments_total": 3, "installments_left": 3, "total_amount": 100})
    assert r.status_code == 201 and r.json()["amount"] == 33.34
    amounts = [c.amount for c in db.query(models.Charge).filter_by(label="Canapé").order_by(models.Charge.month_id)]
    assert amounts == [33.34, 33.33, 33.33] and round(sum(amounts), 2) == 100
