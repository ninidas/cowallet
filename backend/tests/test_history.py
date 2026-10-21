"""Historique par catégorie (2026-10-22) : le réel de chaque commerçant, regroupé comme pour deviner la catégorie."""
from app import models
from app.bank_sync import merchant_group
from app.routers import stats
from .conftest import headers
from .test_lot1 import app_client, _couple  # noqa: F401  (fixture partagée)


def test_merchant_group_keeps_one_line_per_shop():
    # Même magasin, ville écrite autrement : une seule ligne, nommée comme sur le relevé
    assert merchant_group("EPICERIE CENTREFR DEMOVILLE")[:2] == merchant_group("EPICERIE CENTRE99DEMOVILLE")[:2] == ("EPICERIE CENTRE", "EPICERIE CENTRE")
    assert merchant_group("PRLV SEPA Energie Plus")[1:] == ("Energie Plus", "debit")
    assert merchant_group("PRLV SEPA PayPal (Europe")[1:] == ("PayPal", "debit")
    assert merchant_group("VIR MME ALEX MARTIN")[1:] == ("VIR MME ALEX MARTIN", "transfer")
    # Un virement par motif : le dentiste et la lampe ne sont pas le même « commerçant »
    dent, lamp = merchant_group("VIR M SAM DUPONT", detail="Rembours dentiste"), merchant_group("VIR M SAM DUPONT", detail="Rembours lampe")
    assert dent[1:] == ("Rembours dentiste", "transfer") and dent[0] != lamp[0]
    assert merchant_group("ECHEANCE PRET")[1:] == ("ECHEANCE PRET", "other")
    # Pas un paiement par carte : le libellé entier, même s'il ressemble à « commerçant + ville »
    assert merchant_group("COTIS PACK SERENITE", is_card=False)[1:] == ("COTIS PACK SERENITE", "other")
    assert merchant_group("COTIS PACK SERENITE", is_card=True)[1:] == ("COTIS PACK SERE", "card")


def _tx(db, m, sid, desc, amount, category=None, card=False):
    db.add(models.BankTransaction(month_id=m.id, saltedge_id=sid, date="2026-10-05", description=desc,
                                  amount=amount, category=category, account_name="Compte joint", is_card=card))
    db.commit()


def test_stats_give_each_merchant_per_month_and_category(app_client, db):
    t1, _, g, oct_ = _couple(app_client, db)
    _tx(db, oct_, "a", "EPICERIE CENTREFR DEMOVILLE", 40, "Alimentation", card=True)
    _tx(db, oct_, "b", "EPICERIE CENTRE99DEMOVILLE", 60.5, "Alimentation", card=True)
    _tx(db, oct_, "c", "BOULANGERIE DU COFR DEMOVILLE", 9.2, "Alimentation", card=True)
    _tx(db, oct_, "d", "PRLV SEPA PayPal (Europe", 25)
    from fastapi import APIRouter
    api = APIRouter(prefix="/api"); api.include_router(stats.router); app_client.app.include_router(api)
    s = app_client.get("/api/stats", headers=headers(t1)).json()
    rows = [(r["month"], r["category"], r["merchant"], r["kind"], r["total"], r["count"]) for r in s["by_merchant"]]
    assert rows == [
        ("Octobre 2026", "Alimentation", "EPICERIE CENTRE", "card", 100.5, 2),
        ("Octobre 2026", stats.UNCATEGORIZED, "PayPal", "debit", 25, 1),
        ("Octobre 2026", "Alimentation", "BOULANGERIE DU", "card", 9.2, 1),
    ]
    assert "by_label" not in s
