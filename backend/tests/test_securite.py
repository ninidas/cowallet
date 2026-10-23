"""Correctifs de sécurité de la v1.1.1 (2026-10-24) : jetons liés au compte, règle des mots de passe,
inscriptions et invitations, adresses de notification, retour de la banque, export CSV."""
import time

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient
from jose import jwt
from pywebpush import WebPushException
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import auth as auth_module, enablebanking, models
from app.database import get_db
from app.limiter import limiter
from app.routers import auth, bank, export, groups, push, settings, setup, users
from .conftest import register, headers, create_group

PW = "mot-de-passe-de-test"


@pytest.fixture
def sclient(db):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    api = APIRouter(prefix="/api")
    for r in (auth, users, groups, settings, setup, push, bank, export):
        api.include_router(r.router)
    app.include_router(api)

    def override():
        yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c


def _uid(db, username):
    return db.query(models.User).filter_by(username=username).first().id


# ── Jetons ────────────────────────────────────────────────────────────────────

def test_old_token_of_a_deleted_account_does_not_open_the_next_one(sclient, db):
    old = register(sclient, "ancien", PW)
    uid = _uid(db, "ancien")
    assert sclient.request("DELETE", "/api/users/me", json={"password": PW}, headers=headers(old)).status_code == 204
    new = register(sclient, "nouveau", PW)
    assert _uid(db, "nouveau") == uid                     # SQLite redonne le même numéro
    assert sclient.get("/api/groups/me", headers=headers(old)).status_code == 401
    assert sclient.get("/api/groups/me", headers=headers(new)).status_code == 404   # connecté, pas de couple


def test_password_change_logs_out_the_other_devices(sclient):
    token = register(sclient, "camille", PW)
    create_group(sclient, token)
    r = sclient.patch("/api/settings", json={"current_password": PW, "new_password": "un-autre-mot-de-passe"},
                      headers=headers(token))
    assert r.status_code == 200, r.text
    assert sclient.get("/api/groups/me", headers=headers(token)).status_code == 401
    assert sclient.get("/api/groups/me", headers=headers(r.json()["access_token"])).status_code == 200


def _legacy_token(user):
    return jwt.encode({"sub": str(user.id), "username": user.username, "exp": int(time.time()) + 3600},
                      auth_module._get_secret_key(), algorithm=auth_module.ALGORITHM)


def test_tokens_from_before_the_update_work_until_the_password_changes(sclient, db):
    register(sclient, "camille", PW)
    register(sclient, "lou", PW)
    camille = db.query(models.User).filter_by(username="camille").first()
    camille.session_key = "legacy-0123"
    db.commit()
    legacy = _legacy_token(camille)
    create_group(sclient, legacy)                          # personne n'est déconnecté par la mise à jour
    # Un jeton sans clé ne vaut rien pour un compte créé après la mise à jour
    lou = db.query(models.User).filter_by(username="lou").first()
    assert sclient.get("/api/groups/me", headers=headers(_legacy_token(lou))).status_code == 401
    r = sclient.patch("/api/settings", json={"current_password": PW, "new_password": "un-autre-mot-de-passe"},
                      headers=headers(legacy))
    assert r.status_code == 200
    assert sclient.get("/api/groups/me", headers=headers(legacy)).status_code == 401


# ── Mots de passe, inscriptions ───────────────────────────────────────────────

def test_setup_applies_the_password_rule(sclient):
    body = {"user1_username": "camille", "user1_password": PW, "user2_username": "lou", "user2_password": PW}
    assert sclient.post("/api/setup", json={**body, "user2_password": "court"}).status_code == 400
    assert sclient.post("/api/setup", json={**body, "user1_username": "  "}).status_code == 400
    assert sclient.post("/api/setup", json={**body, "user1_password": "é" * 40}).status_code == 400   # > 72 octets
    assert sclient.post("/api/setup", json=body).status_code == 201


def test_registration_stops_at_two_accounts_per_couple(sclient, monkeypatch):
    monkeypatch.setenv("MAX_GROUPS", "1")
    register(sclient, "camille", PW)
    register(sclient, "lou", PW)
    assert sclient.post("/api/users/register", json={"username": "sam", "password": PW}).status_code == 403
    # Fermé avant de dire si l'identifiant existe : rien n'apprend qui a un compte
    assert sclient.post("/api/users/register", json={"username": "camille", "password": PW}).status_code == 403


def test_group_creation_respects_max_groups(sclient, monkeypatch):
    monkeypatch.setenv("MAX_GROUPS", "1")
    a = register(sclient, "camille", PW)
    b = register(sclient, "lou", PW)
    create_group(sclient, a)
    assert sclient.post("/api/groups", json={"name": "Autre"}, headers=headers(b)).status_code == 403


def test_invite_code_is_long_and_changes_once_used(sclient, db):
    a = register(sclient, "camille", PW)
    b = register(sclient, "lou", PW)
    c = register(sclient, "sam", PW)
    create_group(sclient, a)
    group = db.query(models.Group).first()
    first = group.invite_code
    assert len(first) == 24
    assert sclient.post("/api/groups/join", json={"invite_code": first.lower()}, headers=headers(b)).status_code == 200
    db.refresh(group)
    assert group.invite_code != first
    # Le partenaire part : la place se libère avec un nouveau code, l'ancien lien ne rouvre pas le couple
    assert sclient.request("DELETE", "/api/users/me", json={"password": PW}, headers=headers(b)).status_code == 204
    db.refresh(group)
    assert sclient.post("/api/groups/join", json={"invite_code": first}, headers=headers(c)).status_code == 404
    assert sclient.post("/api/groups/join", json={"invite_code": group.invite_code}, headers=headers(c)).status_code == 200


# ── Notifications ─────────────────────────────────────────────────────────────

def _sub(endpoint, p256dh="cle-publique", auth="secret"):
    return {"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}}


@pytest.mark.parametrize("endpoint", [
    "http://127.0.0.1:8000/api/v2/app/shutdown",
    "https://127.0.0.1/x",
    "https://192.168.1.10/x",
    "https://[::1]/x",
    "https://cowallet:8000/x",
    "https://evil.example/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://user@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "http://fcm.googleapis.com/x",
])
def test_push_only_to_browser_push_services(sclient, endpoint):
    token = register(sclient, "camille", PW)
    assert sclient.post("/api/push/subscribe", json=_sub(endpoint), headers=headers(token)).status_code == 400


def test_push_accepts_the_real_services(sclient):
    token = register(sclient, "camille", PW)
    for ep in ("https://fcm.googleapis.com/fcm/send/abc", "https://web.push.apple.com/QH1",
               "https://updates.push.services.mozilla.com/wpush/v2/x", "https://wns2-par02p.notify.windows.com/w/?token=x"):
        assert sclient.post("/api/push/subscribe", json=_sub(ep), headers=headers(token)).status_code == 201, ep


def test_push_subscription_cannot_be_taken_without_its_keys(sclient, db):
    a = register(sclient, "camille", PW)
    b = register(sclient, "lou", PW)
    ep = "https://fcm.googleapis.com/fcm/send/appareil"
    assert sclient.post("/api/push/subscribe", json=_sub(ep), headers=headers(a)).status_code == 201
    assert sclient.post("/api/push/subscribe", json=_sub(ep, auth="autre"), headers=headers(b)).status_code == 409
    assert db.query(models.PushSubscription).one().user_id == _uid(db, "camille")
    # Même appareil, l'autre personne s'y connecte : mêmes clés, l'abonnement passe à son compte
    assert sclient.post("/api/push/subscribe", json=_sub(ep), headers=headers(b)).status_code == 201
    db.expire_all()
    assert db.query(models.PushSubscription).one().user_id == _uid(db, "lou")


def test_push_subscriptions_are_capped(sclient, db):
    token = register(sclient, "camille", PW)
    for i in range(13):
        sclient.post("/api/push/subscribe", json=_sub(f"https://fcm.googleapis.com/fcm/send/{i}"), headers=headers(token))
    eps = [s.endpoint for s in db.query(models.PushSubscription).all()]
    assert len(eps) == push.MAX_SUBSCRIPTIONS_PER_USER
    assert "https://fcm.googleapis.com/fcm/send/12" in eps and "https://fcm.googleapis.com/fcm/send/0" not in eps


def test_expired_or_unsafe_subscriptions_are_forgotten(db, monkeypatch):
    user = models.User(username="camille", password_hash="x")
    db.add(user); db.commit()
    db.add_all([models.PushSubscription(user_id=user.id, endpoint="https://fcm.googleapis.com/fcm/send/vieux", p256dh="k", auth="a"),
                models.PushSubscription(user_id=user.id, endpoint="http://172.19.0.1:8080/x", p256dh="k", auth="a")])
    db.commit()
    monkeypatch.setattr(push, "get_vapid_keys", lambda db: ("pub", "priv"))
    import py_vapid
    monkeypatch.setattr(py_vapid.Vapid, "from_pem", staticmethod(lambda pem: object()))
    called = []

    class Gone:
        status_code = 410
        def __bool__(self): return False     # comme une vraie réponse 4xx de requests

    def gone(**kw):
        called.append(kw["subscription_info"]["endpoint"])
        assert kw["requests_session"].max_redirects == 0
        raise WebPushException("expiré", response=Gone())
    monkeypatch.setattr(push, "webpush", gone)
    push.send_notification(db, user.id, "titre", "corps")
    assert called == ["https://fcm.googleapis.com/fcm/send/vieux"]     # l'adresse interne n'est jamais contactée
    assert db.query(models.PushSubscription).count() == 0


# ── Banque ────────────────────────────────────────────────────────────────────

@pytest.fixture
def bank_flow(sclient, monkeypatch):
    monkeypatch.setattr(enablebanking, "is_configured", lambda: True)
    started = {}
    monkeypatch.setattr(enablebanking, "start_auth",
                        lambda name, country, url, state: started.update(url=url, state=state) or {"url": "https://banque", "auth_code": ""})
    monkeypatch.setattr(enablebanking, "create_session",
                        lambda code: {"session_id": "s1", "accounts": [{"uid": "a1", "name": "Compte joint"}]})
    token = register(sclient, "camille", PW)
    return sclient, token, started


def test_bank_return_url_must_be_this_instance(bank_flow):
    client, token, started = bank_flow
    for bad in ("https://evil.example/bank/callback", "http://testserver/ailleurs", "http://testserver/bank/callback?x=1"):
        r = client.post("/api/bank/connect", json={"return_to": bad, "aspsp_name": "Banque Demo"}, headers=headers(token))
        assert r.status_code == 400, bad
    r = client.post("/api/bank/connect", json={"return_to": "http://testserver/bank/callback", "aspsp_name": "Banque Demo"},
                    headers=headers(token))
    assert r.status_code == 200 and started["url"] == "http://testserver/bank/callback"


def test_bank_finish_requires_the_state_of_this_flow(bank_flow, db):
    client, token, started = bank_flow
    client.post("/api/bank/connect", json={"return_to": "http://testserver/bank/callback", "aspsp_name": "Banque Demo"},
                headers=headers(token))
    state = started["state"]
    assert len(state) >= 40
    for wrong in ("", "autre"):
        r = client.post("/api/bank/finish", json={"auth_code": "code-d-un-autre", "state": wrong}, headers=headers(token))
        assert r.status_code == 400
    conn = db.query(models.BankConnection).one()
    good = conn.oauth_state
    conn.oauth_state = f"{state}|{int(time.time()) - 31 * 60}"   # parcours abandonné il y a plus de 30 min
    db.commit()
    assert client.post("/api/bank/finish", json={"auth_code": "c", "state": state}, headers=headers(token)).status_code == 400
    conn.oauth_state = good
    db.commit()
    r = client.post("/api/bank/finish", json={"auth_code": "c", "state": state}, headers=headers(token))
    assert r.status_code == 200, r.text
    db.refresh(conn)
    assert conn.status == "active" and conn.oauth_state is None


# ── Export CSV ────────────────────────────────────────────────────────────────

def test_csv_export_neutralizes_formulas(sclient, db):
    token = register(sclient, "camille", PW)
    create_group(sclient, token)
    group = db.query(models.Group).first()
    m = models.Month(group_id=group.id, label="Octobre 2026", year=2026, month=10, user1_share=50)
    db.add(m); db.commit()
    db.add(models.Charge(month_id=m.id, label='=HYPERLINK("https://evil.example","x")', amount=10, category="@SUM(1)"))
    db.commit()
    text = sclient.get("/api/export/csv", headers=headers(token)).text
    assert "'=HYPERLINK" in text and "'@SUM(1)" in text
    assert ";=HYPERLINK" not in text
