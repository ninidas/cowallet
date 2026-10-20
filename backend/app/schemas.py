from pydantic import BaseModel, Field, field_validator
from typing import Annotated, Literal, Optional, List

# Bornes des saisies : un texte de plusieurs Mo ou un mois 13 est refusé proprement (422), pas en erreur 500
Username = Annotated[str, Field(max_length=50)]
Password = Annotated[str, Field(max_length=128)]
Name     = Annotated[str, Field(max_length=60)]
Label    = Annotated[str, Field(max_length=120)]
Note     = Annotated[str, Field(max_length=1000)]
Amount   = Annotated[float, Field(ge=-10_000_000, le=10_000_000)]
Count    = Annotated[int, Field(ge=1, le=600)]


# --- Setup ---

class SetupRequest(BaseModel):
    user1_username: Username
    user1_password: Password
    user2_username: Username
    user2_password: Password
    default_user1_share: int = 50

    @field_validator("default_user1_share")
    @classmethod
    def validate_share(cls, v: int) -> int:
        if not (1 <= v <= 99):
            raise ValueError("Split must be between 1 and 99")
        return v

class SetupStatus(BaseModel):
    needed: bool


# --- Auth / Register ---

class RegisterRequest(BaseModel):
    username: Username
    password: Password

class LoginRequest(BaseModel):
    username: Annotated[str, Field(max_length=200)]
    password: Annotated[str, Field(max_length=200)]

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    display_name: Optional[str] = None
    group_id: Optional[int] = None


# --- Groups ---

class GroupCreate(BaseModel):
    name: Name = ""
    default_share: int = 50
    currency: Annotated[str, Field(max_length=8)] = "EUR"

    @field_validator("default_share")
    @classmethod
    def validate_share(cls, v: int) -> int:
        if not (1 <= v <= 99):
            raise ValueError("Split must be between 1 and 99")
        return v

class GroupJoin(BaseModel):
    invite_code: Annotated[str, Field(max_length=64)]

class GroupRename(BaseModel):
    name: Name

class GroupCurrencyUpdate(BaseModel):
    currency: Annotated[str, Field(max_length=8)]

class GroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    default_share: int
    currency: str = "EUR"
    user1_id: int
    user1_username: str
    user1_login: Optional[str] = None
    user2_id: Optional[int] = None
    user2_username: Optional[str] = None
    user2_login: Optional[str] = None

    class Config:
        from_attributes = True


# --- Categories ---

class CategoryOut(BaseModel):
    id: int
    name: str
    icon: str
    color: str
    sort_order: int

    class Config:
        from_attributes = True

class CategoryCreate(BaseModel):
    name: Name
    icon: Annotated[str, Field(max_length=16)] = "📦"
    color: Annotated[str, Field(max_length=16)] = "#94a3b8"

class CategoryUpdate(BaseModel):
    name: Optional[Name] = None
    icon: Optional[Annotated[str, Field(max_length=16)]] = None
    color: Optional[Annotated[str, Field(max_length=16)]] = None
    sort_order: Optional[int] = None


# --- Payment Methods ---

class PaymentMethodOut(BaseModel):
    id: int
    name: str
    sort_order: int

    class Config:
        from_attributes = True

class PaymentMethodCreate(BaseModel):
    name: Name


# --- Charge suggestions ---

class ChargeSuggestion(BaseModel):
    label: str
    category: str
    amount: float
    payment_type: Optional[str] = None

    class Config:
        from_attributes = True


# --- Charges ---

class ChargeCreate(BaseModel):
    label: Label
    amount: Amount
    category: Name
    payment_type: Optional[Name] = None
    is_recurring: bool = False
    paid_by: Optional[int] = None
    installments_total: Count = 1
    installments_left: Count = 1
    note: Optional[Note] = None
    # Paiement en plusieurs fois : montant total, réparti au centime près (le reste sur la 1re échéance)
    total_amount: Optional[Amount] = None

class ChargeUpdate(BaseModel):
    label: Optional[Label] = None
    amount: Optional[Amount] = None
    actual_amount: Optional[Amount] = None
    category: Optional[Name] = None
    payment_type: Optional[Name] = None
    is_recurring: Optional[bool] = None
    paid_by: Optional[int] = None
    note: Optional[Note] = None
    installments_total: Optional[Count] = None
    installments_left: Optional[Count] = None
    # Dépense récurrente ou en plusieurs fois : "this" (ce mois), "following" (et les suivants), "all" (tous les mois)
    scope: Literal["this", "following", "all"] = "this"


class FixInstallmentsBody(BaseModel):
    installments_left: Count

class ChargeOut(BaseModel):
    id: int
    month_id: int
    label: str
    amount: float
    actual_amount: Optional[float] = None
    category: str
    payment_type: Optional[str]
    is_recurring: bool
    paid_by: Optional[int]
    installments_total: int = 1
    installments_left: int = 1
    note: Optional[str] = None
    delta: Optional[float] = None
    also_updated: int = 0    # autres mois modifiés en même temps (scope)

    class Config:
        from_attributes = True


# --- Months ---

class MonthCreate(BaseModel):
    year: Annotated[int, Field(ge=2000, le=2100)]
    month: Annotated[int, Field(ge=1, le=12)]
    user1_share: int = 50

    @field_validator("user1_share")
    @classmethod
    def validate_share(cls, v: int) -> int:
        if not (1 <= v <= 99):
            raise ValueError("Split must be between 1 and 99")
        return v

class BulkDeleteMonths(BaseModel):
    ids: Annotated[List[int], Field(max_length=1000)]

class TransferUpdate(BaseModel):
    user1_transferred: Optional[bool] = None
    user2_transferred: Optional[bool] = None

class ShareUpdate(BaseModel):
    user1_share: int

    @field_validator("user1_share")
    @classmethod
    def validate_share(cls, v: int) -> int:
        if not (1 <= v <= 99):
            raise ValueError("Split must be between 1 and 99")
        return v

class MonthSummary(BaseModel):
    id: int
    label: str
    year: int
    month: int
    user1_share: int
    user2_share: int
    user1_transferred: bool
    user2_transferred: bool
    total: float
    user1_due: float
    user2_due: float
    validated_by: Optional[int] = None
    uncategorized: int = 0   # transactions bancaires sans catégorie
    planned: float = 0       # somme des dépenses prévues
    spent: Optional[float] = None   # somme des transactions importées, None s'il n'y en a pas
    spent_from: Optional[str] = None  # première et dernière date des transactions : un mois importé
    spent_to: Optional[str] = None    # en partie (du 4 au 15 mai) ne doit pas passer pour complet

    class Config:
        from_attributes = True

class MonthDetail(BaseModel):
    id: int
    label: str
    year: int
    month: int
    user1_share: int
    user2_share: int
    user1_transferred: bool
    user2_transferred: bool
    total: float
    user1_due: float
    user2_due: float
    user1_to_transfer: float
    user2_to_transfer: float
    user1_to_receive: float = 0
    user2_to_receive: float = 0
    prev_total: Optional[float] = None
    charges: List[ChargeOut]
    validated_by: Optional[int] = None
    uncategorized: int = 0

    class Config:
        from_attributes = True


# --- Budget entries ---

class BudgetEntryCreate(BaseModel):
    type: Literal["income", "expense", "investment", "shared"]
    label: Label
    amount: Amount
    category: Optional[Name] = None
    sort_order: int = 0

class BudgetEntryUpdate(BaseModel):
    label: Optional[Label] = None
    amount: Optional[Amount] = None
    category: Optional[Name] = None
    sort_order: Optional[int] = None

class BudgetEntryOut(BaseModel):
    id: int
    type: str
    label: str
    amount: float
    category: Optional[str] = None
    sort_order: int

    class Config:
        from_attributes = True
