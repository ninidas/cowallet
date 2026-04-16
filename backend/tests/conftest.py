import os
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest"

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database import Base, get_db
from app.limiter import limiter
from fastapi import APIRouter
from app.routers import auth, users, groups, months, charges, budget, categories, payment_methods

TEST_DATABASE_URL = "sqlite:///:memory:"


def _make_app(session):
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    api = APIRouter(prefix="/api")
    api.include_router(auth.router)
    api.include_router(users.router)
    api.include_router(groups.router)
    api.include_router(months.router)
    api.include_router(charges.router)
    api.include_router(budget.router)
    api.include_router(categories.router)
    api.include_router(payment_methods.router)
    app.include_router(api)

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db
    return app


@pytest.fixture
def db():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    app = _make_app(db)
    with TestClient(app) as c:
        yield c


# ── Helpers ──────────────────────────────────────────────────────────────────

def register(client, username, password="password123"):
    r = client.post("/api/users/register", json={"username": username, "password": password})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def create_group(client, token, name="Mon budget"):
    r = client.post("/api/groups", json={"name": name}, headers=headers(token))
    assert r.status_code == 201, r.text
    return r.json()
