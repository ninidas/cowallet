from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)


class AppConfig(Base):
    """Stockage clé/valeur pour la configuration applicative."""
    __tablename__ = "app_config"

    key   = Column(String, primary_key=True)
    value = Column(String, nullable=False)


class Group(Base):
    __tablename__ = "groups"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False, default="Notre budget")
    invite_code   = Column(String, unique=True, nullable=False)
    default_share = Column(Integer, default=50)
    user1_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    user2_id      = Column(Integer, ForeignKey("users.id"), nullable=True)

    user1           = relationship("User", foreign_keys=[user1_id])
    user2           = relationship("User", foreign_keys=[user2_id])
    months          = relationship("Month", back_populates="group", cascade="all, delete-orphan")
    categories      = relationship("Category", back_populates="group", cascade="all, delete-orphan")
    payment_methods = relationship("PaymentMethod", back_populates="group", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id         = Column(Integer, primary_key=True, index=True)
    group_id   = Column(Integer, ForeignKey("groups.id"), nullable=True)
    name       = Column(String, nullable=False)
    icon       = Column(String, nullable=False, default="📦")
    color      = Column(String, nullable=False, default="#94a3b8")
    sort_order = Column(Integer, default=0)

    group = relationship("Group", back_populates="categories")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id         = Column(Integer, primary_key=True, index=True)
    group_id   = Column(Integer, ForeignKey("groups.id"), nullable=True)
    name       = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)

    group = relationship("Group", back_populates="payment_methods")


class Month(Base):
    __tablename__ = "months"
    __table_args__ = (UniqueConstraint("group_id", "year", "month", name="uq_group_year_month"),)

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    label = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    user1_share = Column(Integer, default=50)
    user1_transferred = Column(Boolean, default=False)
    user2_transferred = Column(Boolean, default=False)
    validated_by      = Column(Integer, ForeignKey("users.id"), nullable=True)

    group   = relationship("Group", back_populates="months")
    charges = relationship("Charge", back_populates="month", cascade="all, delete-orphan")


class Charge(Base):
    __tablename__ = "charges"

    id                 = Column(Integer, primary_key=True, index=True)
    month_id           = Column(Integer, ForeignKey("months.id"), nullable=False)
    label              = Column(String, nullable=False)
    amount             = Column(Float, nullable=False)
    actual_amount      = Column(Float, nullable=True)
    category           = Column(String, nullable=False)
    payment_type       = Column(String, nullable=True)
    is_recurring       = Column(Boolean, default=False)
    paid_by            = Column(Integer, ForeignKey("users.id"), nullable=True)
    installments_total = Column(Integer, default=1, nullable=False, server_default="1")
    installments_left  = Column(Integer, default=1, nullable=False, server_default="1")
    note               = Column(String, nullable=True)

    month        = relationship("Month", back_populates="charges")
    paid_by_user = relationship("User", foreign_keys=[paid_by])


class BudgetEntry(Base):
    """Entrée de budget personnel (revenus, dépenses perso, investissements)."""
    __tablename__ = "budget_entries"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    type       = Column(String, nullable=False)   # "income" | "expense" | "investment"
    label      = Column(String, nullable=False)
    amount     = Column(Float, nullable=False)
    category   = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)

    user = relationship("User", foreign_keys=[user_id])


class PushSubscription(Base):
    """Subscription Web Push d'un utilisateur sur un appareil."""
    __tablename__ = "push_subscriptions"

    id       = Column(Integer, primary_key=True, index=True)
    user_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    endpoint = Column(String, nullable=False, unique=True)
    p256dh   = Column(String, nullable=False)
    auth     = Column(String, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
