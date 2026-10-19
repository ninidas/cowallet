"""Client Enable Banking API v2."""
import os
import time
import datetime
import httpx
from jose import jwt as jose_jwt

BASE_URL = "https://api.enablebanking.com"
APP_ID           = os.getenv("ENABLEBANKING_APP_ID", "")
PRIVATE_KEY_PATH = os.getenv("ENABLEBANKING_PRIVATE_KEY_PATH", "")


def is_configured() -> bool:
    return bool(APP_ID and PRIVATE_KEY_PATH and os.path.exists(PRIVATE_KEY_PATH))


def _make_jwt() -> str:
    now = int(time.time())
    with open(PRIVATE_KEY_PATH, "r") as f:
        private_key = f.read()
    return jose_jwt.encode(
        {"iss": "enablebanking.com", "aud": "api.enablebanking.com", "iat": now, "exp": now + 300},
        private_key,
        algorithm="RS256",
        headers={"kid": APP_ID},
    )


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_make_jwt()}",
        "Content-Type":  "application/json",
        "Accept":        "application/json",
    }


def get_aspsps(country: str = "FR") -> list:
    """Liste les banques disponibles pour un pays donné."""
    resp = httpx.get(
        f"{BASE_URL}/aspsps",
        headers=_headers(),
        params={"country": country},
        timeout=15,
    )
    if not resp.is_success:
        raise Exception(f"HTTP {resp.status_code} — {resp.text}")
    data = resp.json()
    return data if isinstance(data, list) else data.get("aspsps", data.get("data", []))


DEFAULT_CONSENT_DAYS = 90


def _max_consent_seconds(aspsp_name: str, aspsp_country: str) -> int:
    """Durée d'accès maximale acceptée par la banque (180 jours pour la plupart), 90 jours à défaut."""
    try:
        for a in get_aspsps(aspsp_country):
            if a.get("name") == aspsp_name and a.get("maximum_consent_validity"):
                return int(a["maximum_consent_validity"])
    except Exception:
        pass
    return DEFAULT_CONSENT_DAYS * 86400


def start_auth(aspsp_name: str, aspsp_country: str, redirect_url: str) -> dict:
    """Démarre le flux d'authentification. Retourne {url, auth_code}.
    L'accès est demandé pour la durée maximale permise par la banque (une heure de marge),
    au lieu de 90 jours fixes : moins de reconnexions."""
    seconds = _max_consent_seconds(aspsp_name, aspsp_country)
    until = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=seconds) - datetime.timedelta(hours=1)
    valid_until = until.strftime("%Y-%m-%dT%H:%M:%SZ")
    body = {
        "access": {
            "valid_until": valid_until,
        },
        "aspsp": {
            "name":    aspsp_name,
            "country": aspsp_country,
        },
        "state":        os.urandom(8).hex(),
        "redirect_url": redirect_url,
        "psu_type":     "personal",
    }
    resp = httpx.post(f"{BASE_URL}/auth", headers=_headers(), json=body, timeout=15)
    if not resp.is_success:
        raise Exception(f"HTTP {resp.status_code} — {resp.text}")
    return resp.json()


def create_session(auth_code: str) -> dict:
    """Active la session après authentification de l'utilisateur."""
    resp = httpx.post(
        f"{BASE_URL}/sessions",
        headers=_headers(),
        json={"code": auth_code},
        timeout=15,
    )
    if not resp.is_success:
        raise Exception(f"HTTP {resp.status_code} — {resp.text}")
    return resp.json()


def get_session(session_id: str) -> dict:
    """État d'une session : status (AUTHORIZED, CLOSED…) et access.valid_until."""
    resp = httpx.get(f"{BASE_URL}/sessions/{session_id}", headers=_headers(), timeout=15)
    if not resp.is_success:
        raise Exception(f"HTTP {resp.status_code} — {resp.text}")
    return resp.json()


_consent_cache: dict = {}


def consent_info(session_id: str, max_age: int = 600) -> dict | None:
    """{"valid_until": date, "expired": bool} pour une session, None si Enable Banking ne répond pas.
    Mis en cache 10 minutes : l'écran des réglages et le rappel quotidien le consultent."""
    if not session_id:
        return None
    hit = _consent_cache.get(session_id)
    if hit and time.time() - hit[0] < max_age:
        return hit[1]
    try:
        s = get_session(session_id)
    except Exception:
        return None
    raw = ((s.get("access") or {}).get("valid_until") or "")[:10]
    try:
        valid_until = datetime.date.fromisoformat(raw)
    except ValueError:
        valid_until = None
    closed = s.get("status") not in (None, "AUTHORIZED")
    expired = closed or (valid_until is not None and valid_until <= datetime.date.today())
    info = {"valid_until": valid_until, "expired": expired}
    _consent_cache[session_id] = (time.time(), info)
    return info


def get_accounts(session_id: str) -> list:
    """Liste les comptes d'une session."""
    resp = httpx.get(
        f"{BASE_URL}/accounts",
        headers=_headers(),
        params={"session_id": session_id},
        timeout=15,
    )
    if not resp.is_success:
        raise Exception(f"HTTP {resp.status_code} — {resp.text}")
    data = resp.json()
    return data if isinstance(data, list) else data.get("accounts", data.get("data", []))


def get_transactions(account_id: str, date_from: str, date_to: str = None) -> list:
    """Récupère les transactions d'un compte entre deux dates."""
    params = {"date_from": date_from}
    if date_to:
        params["date_to"] = date_to
    resp = httpx.get(
        f"{BASE_URL}/accounts/{account_id}/transactions",
        headers=_headers(),
        params=params,
        timeout=30,
    )
    if not resp.is_success:
        raise Exception(f"HTTP {resp.status_code} — {resp.text}")
    data = resp.json()
    return data if isinstance(data, list) else data.get("transactions", data.get("data", []))
