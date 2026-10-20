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


def _months(db, g, *ym):
    ms = [models.Month(group_id=g.id, label=f"{m}/{y}", year=y, month=m) for (y, m) in ym]
    db.add_all(ms); db.commit()
    return ms


def test_recurring_price_change_applies_to_following_months(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    sep, nov, dec = _months(db, g, (2026, 9), (2026, 11), (2026, 12))
    ids = {}
    for m in (sep, oct_, nov, dec):
        c = models.Charge(month_id=m.id, label="Internet", amount=39.99, category="Maison", is_recurring=True)
        db.add(c); db.commit(); ids[m.id] = c.id
    other = models.Charge(month_id=dec.id, label="Internet", amount=10, category="Maison", actual_amount=9.5)
    db.add(other); db.commit()        # pas récurrente : pas la même dépense
    r = app_client.put(f"/api/charges/{ids[nov.id]}", headers=headers(t1),
                       json={"label": "Internet", "amount": 44.99, "category": "Maison", "scope": "following"})
    assert r.status_code == 200 and r.json()["also_updated"] == 1
    got = {m.label: db.get(models.Charge, ids[m.id]).amount for m in (sep, oct_, nov, dec)}
    assert got == {"9/2026": 39.99, "Octobre 2026": 39.99, "11/2026": 44.99, "12/2026": 44.99}
    assert db.get(models.Charge, other.id).amount == 10
    assert app_client.sent == []      # aucun des mois touchés n'est réglé


def test_typo_fixed_on_every_installment_with_one_notification(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)      # octobre réglé par les deux
    aug, sep, nov, jan = _months(db, g, (2026, 8), (2026, 9), (2026, 11), (2027, 1))
    for m in (aug, sep):
        m.user1_transferred = m.user2_transferred = True
    plan = {}
    for m, left in ((aug, 4), (sep, 3), (oct_, 2), (nov, 1)):
        c = models.Charge(month_id=m.id, label="Lave-linge", amount=212.40, category="Maison",
                          installments_total=4, installments_left=left, actual_amount=212.40 if m is aug else None)
        db.add(c); db.commit(); plan[m.id] = c.id
    new_fridge = models.Charge(month_id=jan.id, label="Lave-linge", amount=99, category="Maison", installments_total=4, installments_left=4)
    db.add(new_fridge); db.commit()   # un autre achat du même nom
    r = app_client.put(f"/api/charges/{plan[oct_.id]}", headers=headers(t1),
                       json={"label": "Lave-linge", "amount": 232.39, "category": "Maison", "scope": "all"})
    assert r.json()["also_updated"] == 3
    assert [db.get(models.Charge, plan[m.id]).amount for m in (aug, sep, oct_, nov)] == [232.39] * 4
    assert db.get(models.Charge, plan[aug.id]).actual_amount == 212.40     # le réel reste propre au mois
    assert db.get(models.Charge, new_fridge.id).amount == 99
    # Une seule notification ; part de Lou sur les mois réglés (sept., oct. ; août a un réel saisi qui ne change pas)
    assert len(app_client.sent) == 1 and "sur 4 mois" in app_client.sent[0] and "+20" in app_client.sent[0]
