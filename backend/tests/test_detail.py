"""Libellé bancaire complet (2026-10-20) : les lignes après la première (motif, détail d'une échéance),
la vraie date d'achat et la carte utilisée, d'après une vraie lecture Enable Banking d'octobre."""
from app import bank_sync, models
from .conftest import headers
from .test_lot1 import app_client, _couple  # noqa: F401  (fixture partagée)

ACCOUNT = models.BankAccount(id=1, name="M DUPONT ET MME MARTIN")


def _eb(*lines):
    return {"entry_reference": "x", "transaction_amount": {"amount": "10", "currency": "EUR"},
            "credit_debit_indicator": "DBIT", "status": "BOOK", "booking_date": "2026-10-19",
            "remittance_information": list(lines)}


def test_detail_keeps_what_speaks_and_drops_references():
    p = lambda *l: bank_sync.parse_transaction(_eb(*l), ACCOUNT)["detail"]
    assert p("PRLV SEPA SYNDIC DEMO", "Provision charges 01/10/2026", "A1234B000001234C000000123") == "Provision charges 01/10/2026"
    assert p("PRLV SEPA Box Internet", "Box Fibre 1234567890", "12345678") == "Box Fibre"
    assert p("PRLV SEPA PayPal (Europe", "1234567890123 PAYPAL", "5EE2225BC234W") is None
    assert p("PRLV SEPA Energie clients", "DUPONT               JEAN", "AB1234567890123456") is None


def test_loan_instalment_is_spelled_out():
    p = lambda *l: bank_sync.parse_transaction(_eb(*l), ACCOUNT)["detail"]
    assert p("ECHEANCE PRET", "DONT CAP    321,09 ASS.   45,67E", "INT.   123,45 COM.    0,00E") == \
        "Capital 321,09 € · assurance 45,67 € · intérêts 123,45 €"
    assert p("ECHEANCE PRET", "DONT CAP      0,00 ASS.   98,76E", "INT.     0,00 COM.    0,00E") == "Assurance 98,76 €"


def test_card_purchase_date_and_card():
    tx = bank_sync.parse_transaction(_eb("171026 CB****1111", "EPICERIE CENTREFR DEMOVILLE", "140,05EUR 1 EURO = 1,000000"), ACCOUNT)
    assert (tx["description"], tx["is_card"], tx["card_last4"], tx["purchase_date"], tx["detail"]) == \
        ("EPICERIE CENTREFR DEMOVILLE", True, "1111", "2026-10-17", None)


def test_card_owner_shown_from_settings(app_client, db):
    t1, t2, g, oct_ = _couple(app_client, db)
    db.get(models.User, g.user1_id).card_digits = "4242"
    db.get(models.User, g.user2_id).card_digits = "1111"
    db.add(models.BankTransaction(month_id=oct_.id, saltedge_id="c1", date="2026-10-19", description="EPICERIE CENTREFR DEMOVILLE",
                                  amount=140.05, account_name="Compte joint", is_card=True, card_last4="1111", purchase_date="2026-10-17"))
    db.commit()
    tx = app_client.get(f"/api/bank/months/{oct_.id}/transactions", headers=headers(t1)).json()[0]
    assert (tx["card_owner"], tx["purchase_date"]) == ("lou", "2026-10-17")
