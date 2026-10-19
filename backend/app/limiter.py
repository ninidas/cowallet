from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def client_ip(request: Request) -> str:
    """Adresse du visiteur. L'app est derrière Cloudflare puis SWAG : sans cela, toutes les requêtes
    semblent venir de SWAG et la limite de connexion serait commune à tout le monde."""
    ip = request.headers.get("cf-connecting-ip")
    if not ip:
        ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return ip or get_remote_address(request)


limiter = Limiter(key_func=client_ip)
