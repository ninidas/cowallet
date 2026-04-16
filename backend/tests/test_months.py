from .conftest import register, headers, create_group


def test_create_month(client):
    token = register(client, "nicolas")
    create_group(client, token)
    r = client.post("/api/months",json={"year": 2025, "month": 1}, headers=headers(token))
    assert r.status_code == 201
    data = r.json()
    assert data["year"] == 2025
    assert data["month"] == 1
    assert data["total"] == 0.0


def test_prev_total_isolation_between_groups(client):
    """
    Groupe 1 (nicolas) a janvier 2025 avec une charge de 500€.
    Groupe 2 (melissa) a aussi janvier 2025 avec une charge de 200€.
    Quand nicolas crée février, prev_total doit être 500€ (pas 700€).
    """
    # Groupe 1 — nicolas
    token1 = register(client, "nicolas")
    create_group(client, token1, "Budget Nicolas")
    r = client.post("/api/months",json={"year": 2025, "month": 1}, headers=headers(token1))
    month1_id = r.json()["id"]
    client.post(f"/api/months/{month1_id}/charges",
        json={"label": "Loyer", "amount": 500.0, "category": "Maison"},
        headers=headers(token1))

    # Groupe 2 — melissa (groupe séparé)
    token2 = register(client, "melissa")
    create_group(client, token2, "Budget Melissa")
    r = client.post("/api/months",json={"year": 2025, "month": 1}, headers=headers(token2))
    month2_id = r.json()["id"]
    client.post(f"/api/months/{month2_id}/charges",
        json={"label": "Courses", "amount": 200.0, "category": "Alimentation"},
        headers=headers(token2))

    # Nicolas crée février — prev_total doit être 500€ uniquement
    r = client.post("/api/months",json={"year": 2025, "month": 2}, headers=headers(token1))
    assert r.status_code == 201
    detail = client.get(f"/api/months/{r.json()['id']}", headers=headers(token1)).json()
    assert detail["prev_total"] == 500.0, f"prev_total attendu 500.0, obtenu {detail['prev_total']}"


def test_two_groups_can_share_same_year_month(client):
    """Deux groupes distincts peuvent avoir le même mois sans conflit UNIQUE."""
    token1 = register(client, "nicolas")
    create_group(client, token1)
    r1 = client.post("/api/months", json={"year": 2025, "month": 5}, headers=headers(token1))
    assert r1.status_code == 201

    token2 = register(client, "melissa")
    create_group(client, token2)
    r2 = client.post("/api/months", json={"year": 2025, "month": 5}, headers=headers(token2))
    assert r2.status_code == 201


def test_duplicate_month_in_same_group(client):
    """Un même groupe ne peut pas avoir deux fois le même mois."""
    token = register(client, "nicolas")
    create_group(client, token)
    client.post("/api/months", json={"year": 2025, "month": 3}, headers=headers(token))
    r = client.post("/api/months",json={"year": 2025, "month": 3}, headers=headers(token))
    assert r.status_code == 400
