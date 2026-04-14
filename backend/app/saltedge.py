"""Client Salt Edge Bank Account Data API v5."""
import os
import datetime
import httpx

BASE_URL = "https://www.saltedge.com/api/v6"
APP_ID   = os.getenv("SALTEDGE_APP_ID", "")
SECRET   = os.getenv("SALTEDGE_SECRET", "")


def is_configured() -> bool:
    return bool(APP_ID and SECRET)


def _headers() -> dict:
    return {
        "App-id":       APP_ID,
        "Secret":       SECRET,
        "Content-Type": "application/json",
        "Accept":       "application/json",
    }


def create_customer(identifier: str) -> dict:
    """Crée un customer Salt Edge. Retourne le data du customer."""
    resp = httpx.post(
        f"{BASE_URL}/customers",
        headers=_headers(),
        json={"data": {"identifier": identifier}},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["data"]


def get_customer_by_identifier(identifier: str) -> dict | None:
    """Récupère un customer existant en listant tous les customers et filtrant par identifier."""
    resp = httpx.get(
        f"{BASE_URL}/customers",
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    customers = resp.json().get("data", [])
    return next((c for c in customers if c.get("identifier") == identifier), None)


def create_connect_session(customer_id: str, return_to: str) -> dict:
    """Crée une session de connexion. Retourne le data avec connect_url."""
    from_date = (datetime.date.today() - datetime.timedelta(days=90)).isoformat()
    resp = httpx.post(
        f"{BASE_URL}/connect_sessions",
        headers=_headers(),
        json={
            "data": {
                "customer_id": customer_id,
                "consent": {
                    "scopes":    ["account_details", "transactions_details"],
                    "from_date": from_date,
                },
                "attempt": {
                    "return_to":    return_to,
                    "fetch_scopes": ["accounts", "transactions"],
                },
            }
        },
        timeout=15,
    )
    if not resp.is_success:
        raise Exception(f"HTTP {resp.status_code} — {resp.text}")
    return resp.json()["data"]


def get_connections(customer_id: str) -> list:
    """Liste toutes les connexions d'un customer."""
    resp = httpx.get(
        f"{BASE_URL}/connections",
        headers=_headers(),
        params={"customer_id": customer_id},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["data"]


def get_connection(connection_id: str) -> dict:
    """Récupère une connexion par son ID."""
    resp = httpx.get(
        f"{BASE_URL}/connections/{connection_id}",
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["data"]


def get_accounts(connection_id: str) -> list:
    """Liste les comptes d'une connexion."""
    resp = httpx.get(
        f"{BASE_URL}/accounts",
        headers=_headers(),
        params={"connection_id": connection_id},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["data"]


def get_transactions(connection_id: str, account_id: str, from_date: str) -> list:
    """Récupère les transactions d'un compte. Gère la pagination automatiquement."""
    transactions = []
    params = {
        "connection_id": connection_id,
        "account_id":    account_id,
        "from_date":     from_date,
    }
    while True:
        resp = httpx.get(
            f"{BASE_URL}/transactions",
            headers=_headers(),
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        body  = resp.json()
        transactions.extend(body["data"])
        # Pagination : next_id présent dans meta si d'autres pages existent
        next_id = body.get("meta", {}).get("next_id")
        if not next_id:
            break
        params["from_id"] = next_id
    return transactions


def delete_connection(connection_id: str) -> dict:
    """Supprime une connexion côté Salt Edge."""
    resp = httpx.delete(
        f"{BASE_URL}/connections/{connection_id}",
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["data"]
