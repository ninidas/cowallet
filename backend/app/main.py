import os
import logging
logging.basicConfig(level=logging.INFO)
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine, get_db
from . import models
from .auth import get_current_user_optional
from .routers import auth, months, charges, setup, export, stats, settings, categories, payment_methods, users, groups, budget, push, bank
from .scheduler import create_scheduler

models.Base.metadata.create_all(bind=engine)

# ── Migrations SQLite ──────────────────────────────────────────────────────────
with engine.connect() as _conn:
    # Colonnes charges
    for _col, _type in [
        ("installments_total", "INTEGER NOT NULL DEFAULT 1"),
        ("installments_left",  "INTEGER NOT NULL DEFAULT 1"),
        ("note",               "TEXT"),
    ]:
        try:
            _conn.execute(text(f"ALTER TABLE charges ADD COLUMN {_col} {_type}"))
            _conn.commit()
        except Exception:
            pass

    # Colonne category sur budget_entries
    try:
        _conn.execute(text("ALTER TABLE budget_entries ADD COLUMN category TEXT"))
        _conn.commit()
    except Exception:
        pass

    # Colonne actual_amount sur charges
    try:
        _conn.execute(text("ALTER TABLE charges ADD COLUMN actual_amount REAL"))
        _conn.commit()
    except Exception:
        pass

    # Colonne validated_by sur months
    try:
        _conn.execute(text("ALTER TABLE months ADD COLUMN validated_by INTEGER REFERENCES users(id)"))
        _conn.commit()
    except Exception:
        pass

    # Génération VAPID keys si absentes
    _pub = _conn.execute(text("SELECT value FROM app_config WHERE key='vapid_public'")).fetchone()
    if not _pub:
        try:
            from py_vapid import Vapid
            from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, PrivateFormat, NoEncryption
            import base64
            _v = Vapid()
            _v.generate_keys()
            _pub_bytes = _v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
            _pub_key   = base64.urlsafe_b64encode(_pub_bytes).decode('utf-8').rstrip('=')
            _priv_key  = _v.private_key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption()).decode('utf-8')
            _conn.execute(text("INSERT INTO app_config (key, value) VALUES ('vapid_public', :v)"),  {"v": _pub_key})
            _conn.execute(text("INSERT INTO app_config (key, value) VALUES ('vapid_private', :v)"), {"v": _priv_key})
            _conn.commit()
        except Exception as _e:
            import logging; logging.getLogger(__name__).warning("VAPID key generation failed: %s", _e)

    # Migration : nouvelles colonnes group_id
    for _table in ["months", "categories", "payment_methods"]:
        try:
            _conn.execute(text(f"ALTER TABLE {_table} ADD COLUMN group_id INTEGER REFERENCES groups(id)"))
            _conn.commit()
        except Exception:
            pass

    # Migration : catégories lowercase → capitalisées
    _cat_remap = {
        "maison": "Maison", "voiture": "Voiture", "alimentation": "Alimentation",
        "divertissement": "Divertissement", "projet": "Projet", "voyage": "Voyage",
        "sante": "Santé", "epargne": "Épargne", "autre": "Autre",
    }
    for _old, _new in _cat_remap.items():
        try:
            _conn.execute(text("UPDATE charges SET category=:new WHERE category=:old"), {"new": _new, "old": _old})
            _conn.commit()
        except Exception:
            pass

    # Migration : supprimer le UNIQUE sur categories.name et payment_methods.name
    # (SQLite ne permet pas DROP CONSTRAINT, il faut recréer les tables)
    # Détection fiable : cherche dans le sql de la table ET dans les index séparés
    def _has_unique_on_name(table):
        tbl_sql = _conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=:t"
        ), {"t": table}).fetchone()
        has_inline = tbl_sql and "UNIQUE" in (tbl_sql[0] or "").upper()
        has_idx = _conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=:t AND name LIKE '%name%'"
        ), {"t": table}).fetchone()
        return bool(has_inline or has_idx)

    if _has_unique_on_name("categories"):
        _conn.execute(text("DROP TABLE IF EXISTS categories_new"))
        _conn.execute(text("""
            CREATE TABLE categories_new (
                id INTEGER PRIMARY KEY,
                group_id INTEGER REFERENCES groups(id),
                name VARCHAR NOT NULL,
                icon VARCHAR NOT NULL,
                color VARCHAR NOT NULL,
                sort_order INTEGER DEFAULT 0
            )
        """))
        _conn.execute(text("INSERT INTO categories_new SELECT id, group_id, name, icon, color, sort_order FROM categories"))
        _conn.execute(text("DROP TABLE categories"))
        _conn.execute(text("ALTER TABLE categories_new RENAME TO categories"))
        _conn.commit()

    if _has_unique_on_name("payment_methods"):
        _conn.execute(text("DROP TABLE IF EXISTS payment_methods_new"))
        _conn.execute(text("""
            CREATE TABLE payment_methods_new (
                id INTEGER PRIMARY KEY,
                group_id INTEGER REFERENCES groups(id),
                name VARCHAR NOT NULL,
                sort_order INTEGER DEFAULT 0
            )
        """))
        _conn.execute(text("INSERT INTO payment_methods_new SELECT id, group_id, name, sort_order FROM payment_methods"))
        _conn.execute(text("DROP TABLE payment_methods"))
        _conn.execute(text("ALTER TABLE payment_methods_new RENAME TO payment_methods"))
        _conn.commit()

    # Migration : remplacer le UNIQUE(year, month) par UNIQUE(group_id, year, month) sur months
    _months_sql = _conn.execute(text(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='months'"
    )).fetchone()
    _old_months_constraint = _months_sql and "group_id" not in (_months_sql[0] or "").lower() and "unique" in (_months_sql[0] or "").lower()
    # On cherche uniquement les index qui n'ont pas group_id ET dont le nom suggère un ancien UNIQUE sans group_id
    _months_idx = _conn.execute(text(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='months' AND name NOT LIKE 'sqlite_autoindex_%' AND name NOT LIKE 'ix_%' AND sql NOT LIKE '%group_id%'"
    )).fetchone()
    if _old_months_constraint or _months_idx:
        _conn.execute(text("DROP TABLE IF EXISTS months_new"))
        _conn.execute(text("""
            CREATE TABLE months_new (
                id INTEGER PRIMARY KEY,
                group_id INTEGER REFERENCES groups(id),
                label VARCHAR NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                user1_share INTEGER DEFAULT 50,
                user1_transferred BOOLEAN DEFAULT 0,
                user2_transferred BOOLEAN DEFAULT 0,
                validated_by INTEGER REFERENCES users(id),
                UNIQUE (group_id, year, month)
            )
        """))
        _conn.execute(text("""
            INSERT INTO months_new
            SELECT id, group_id, label, year, month, user1_share,
                   user1_transferred, user2_transferred,
                   CASE WHEN typeof(validated_by) != 'null' THEN validated_by ELSE NULL END
            FROM months
        """))
        _conn.execute(text("DROP TABLE months"))
        _conn.execute(text("ALTER TABLE months_new RENAME TO months"))
        _conn.commit()

    # Migration : table bank_transactions
    try:
        _conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bank_transactions (
                id INTEGER PRIMARY KEY,
                month_id INTEGER NOT NULL REFERENCES months(id),
                saltedge_id VARCHAR NOT NULL UNIQUE,
                date VARCHAR NOT NULL,
                description VARCHAR NOT NULL,
                amount REAL NOT NULL,
                category VARCHAR,
                account_name VARCHAR,
                is_card BOOLEAN NOT NULL DEFAULT 0
            )
        """))
        _conn.commit()
    except Exception:
        pass

    # Migration : colonne is_card sur bank_transactions
    try:
        _conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN is_card BOOLEAN NOT NULL DEFAULT 0"))
        _conn.commit()
    except Exception:
        pass

    # Migration : tables bank_connections et bank_accounts
    try:
        _conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bank_connections (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                saltedge_customer_id VARCHAR NOT NULL,
                saltedge_connection_id VARCHAR,
                provider_name VARCHAR,
                provider_code VARCHAR,
                status VARCHAR DEFAULT 'pending'
            )
        """))
        _conn.commit()
    except Exception:
        pass
    try:
        _conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bank_accounts (
                id INTEGER PRIMARY KEY,
                connection_id INTEGER NOT NULL REFERENCES bank_connections(id),
                saltedge_account_id VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                nature VARCHAR,
                currency VARCHAR DEFAULT 'EUR',
                enabled BOOLEAN DEFAULT 1
            )
        """))
        _conn.commit()
    except Exception:
        pass

    # Migration : auto-créer un groupe pour les installations existantes (2 users, pas de groupe)
    import secrets as _secrets
    _users = _conn.execute(text("SELECT id FROM users ORDER BY id")).fetchall()
    _groups = _conn.execute(text("SELECT id FROM groups")).fetchall()
    if len(_users) >= 1 and len(_groups) == 0:
        _share_cfg = _conn.execute(text("SELECT value FROM app_config WHERE key='default_user1_share'")).fetchone()
        _share = int(_share_cfg[0]) if _share_cfg else 50
        _code = _secrets.token_hex(4).upper()
        _u1 = _users[0][0]
        _u2 = _users[1][0] if len(_users) >= 2 else None
        _conn.execute(text(
            "INSERT INTO groups (name, invite_code, default_share, user1_id, user2_id) VALUES (:n, :c, :s, :u1, :u2)"
        ), {"n": "Notre budget", "c": _code, "s": _share, "u1": _u1, "u2": _u2})
        _conn.commit()
        _gid = _conn.execute(text("SELECT id FROM groups WHERE invite_code=:c"), {"c": _code}).fetchone()[0]
        # Rattacher les données existantes au groupe
        _conn.execute(text("UPDATE months SET group_id=:g WHERE group_id IS NULL"), {"g": _gid})
        _conn.execute(text("UPDATE categories SET group_id=:g WHERE group_id IS NULL"), {"g": _gid})
        _conn.execute(text("UPDATE payment_methods SET group_id=:g WHERE group_id IS NULL"), {"g": _gid})
        _conn.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = create_scheduler()
    scheduler.start()
    yield
    scheduler.shutdown()

app = FastAPI(title="CoWallet", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(setup.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(months.router)
app.include_router(charges.router)
app.include_router(export.router)
app.include_router(stats.router)
app.include_router(settings.router)
app.include_router(categories.router)
app.include_router(payment_methods.router)
app.include_router(budget.router)
app.include_router(push.router)
app.include_router(bank.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/config")
def get_config(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user_optional)):
    """Configuration exposée au frontend — groupe si authentifié, sinon infos minimales."""
    if current_user:
        group = db.query(models.Group).filter(
            (models.Group.user1_id == current_user.id) |
            (models.Group.user2_id == current_user.id)
        ).first()
        if group:
            return {
                "setup_needed":        False,
                "has_group":           True,
                "group_id":            group.id,
                "group_name":          group.name if group.name != "Notre budget" else None,
                "invite_code":         group.invite_code if group.user2_id is None else None,
                "user1_username":      group.user1.username,
                "user2_username":      group.user2.username if group.user2 else None,
                "default_user1_share": group.default_share,
            }
    return {
        "setup_needed": False,
        "has_group":    False,
    }
