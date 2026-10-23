import ipaddress
import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

# Proxys dont on croit l'en-tête X-Forwarded-For : par défaut les adresses privées (reverse proxy sur la
# même machine ou le même réseau). Une requête qui arrive directement d'Internet n'est jamais crue sur parole.
_TRUSTED = [ipaddress.ip_network(n.strip(), strict=False) for n in os.getenv(
    "TRUSTED_PROXIES", "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1/128,fc00::/7"
).split(",") if n.strip()]


def _trusted(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in _TRUSTED)


def client_ip(request: Request) -> str:
    """Adresse du visiteur. L'app est derrière Cloudflare puis SWAG : sans cela, toutes les requêtes
    semblent venir de SWAG et la limite de connexion serait commune à tout le monde.
    On remonte X-Forwarded-For depuis la droite (ce qu'ont ajouté nos propres proxys) jusqu'à la première
    adresse qui n'est pas un proxy de confiance : ce que le visiteur a pu écrire lui-même à gauche est
    ignoré. CF-Connecting-IP n'est plus lu : n'importe quel client pouvait l'envoyer."""
    peer = get_remote_address(request)
    if not _trusted(peer):
        return peer
    hops = [h.strip() for h in (request.headers.get("x-forwarded-for") or "").split(",") if h.strip()]
    for hop in reversed(hops):
        if not _trusted(hop):
            return hop
    return hops[0] if hops else peer


limiter = Limiter(key_func=client_ip)
