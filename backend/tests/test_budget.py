from .conftest import register, headers


def test_create_budget_entry(client):
    token = register(client, "nicolas")
    r = client.post("/budget", json={
        "type": "income", "label": "Salaire", "amount": 2500.0, "category": "Revenus"
    }, headers=headers(token))
    assert r.status_code == 201
    data = r.json()
    assert data["label"] == "Salaire"
    assert data["amount"] == 2500.0
    assert data["type"] == "income"


def test_get_budget_entries(client):
    token = register(client, "nicolas")
    client.post("/budget", json={"type": "income", "label": "Salaire", "amount": 2500.0}, headers=headers(token))
    client.post("/budget", json={"type": "expense", "label": "Loyer", "amount": 800.0}, headers=headers(token))
    r = client.get("/budget", headers=headers(token))
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_budget_isolation_between_users(client):
    """Les entrées de budget de nicolas ne sont pas visibles par melissa."""
    token1 = register(client, "nicolas")
    token2 = register(client, "melissa")
    client.post("/budget", json={"type": "income", "label": "Salaire", "amount": 3000.0}, headers=headers(token1))

    r = client.get("/budget", headers=headers(token2))
    assert r.status_code == 200
    assert len(r.json()) == 0


def test_update_budget_entry(client):
    token = register(client, "nicolas")
    r = client.post("/budget", json={"type": "income", "label": "Salaire", "amount": 2500.0}, headers=headers(token))
    entry_id = r.json()["id"]

    r = client.patch(f"/budget/{entry_id}", json={"amount": 3000.0}, headers=headers(token))
    assert r.status_code == 200
    assert r.json()["amount"] == 3000.0


def test_delete_budget_entry(client):
    token = register(client, "nicolas")
    r = client.post("/budget", json={"type": "income", "label": "Salaire", "amount": 2500.0}, headers=headers(token))
    entry_id = r.json()["id"]

    r = client.delete(f"/budget/{entry_id}", headers=headers(token))
    assert r.status_code == 204

    r = client.get("/budget", headers=headers(token))
    assert len(r.json()) == 0


def test_cannot_delete_other_users_entry(client):
    token1 = register(client, "nicolas")
    token2 = register(client, "melissa")
    r = client.post("/budget", json={"type": "income", "label": "Salaire", "amount": 2500.0}, headers=headers(token1))
    entry_id = r.json()["id"]

    r = client.delete(f"/budget/{entry_id}", headers=headers(token2))
    assert r.status_code == 404


def test_invalid_budget_type(client):
    token = register(client, "nicolas")
    r = client.post("/budget", json={"type": "invalid", "label": "Test", "amount": 100.0}, headers=headers(token))
    assert r.status_code == 400
