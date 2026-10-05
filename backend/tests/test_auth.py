from .conftest import register, headers


def test_register(client):
    r = client.post("/api/users/register", json={"username": "camille", "password": "password123"})
    assert r.status_code == 201
    data = r.json()
    assert data["username"] == "camille"
    assert "access_token" in data


def test_register_duplicate(client):
    client.post("/api/users/register", json={"username": "camille", "password": "password123"})
    r = client.post("/api/users/register", json={"username": "camille", "password": "autrepass1"})
    assert r.status_code == 409


def test_register_password_too_short(client):
    r = client.post("/api/users/register", json={"username": "camille", "password": "abc"})
    assert r.status_code == 400


def test_login(client):
    register(client, "camille")
    r = client.post("/api/auth/login", json={"username": "camille", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client):
    register(client, "camille")
    r = client.post("/api/auth/login", json={"username": "camille", "password": "mauvais"})
    assert r.status_code == 401


def test_protected_route_without_token(client):
    r = client.get("/api/groups/me")
    assert r.status_code == 403
