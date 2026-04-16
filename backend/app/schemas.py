from pydantic import BaseModel, field_validator
from typing import Optional, List


# --- Setup ---

class SetupRequest(BaseModel):
    user1_username: str
    user1_password: str
    user2_username: str
    user2_password: str
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
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    group_id: Optional[int] = None


# --- Groups ---

class GroupCreate(BaseModel):
    name: str = ""
    default_share: int = 50
    currency: str = "EUR"

    @field_validator("default_share")
    @classmethod
    def validate_share(cls, v: int) -> int:
        if not (1 <= v <= 99):
            raise ValueError("Split must be between 1 and 99")
        return v

class GroupJoin(BaseModel):
    invite_code: str

class GroupRename(BaseModel):
    name: str

class GroupCurrencyUpdate(BaseModel):
    currency: str

class GroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    default_share: int
    currency: str = "EUR"
    user1_id: int
    user1_username: str
    user2_id: Optional[int] = None
    user2_username: Optional[str] = None

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
    name: str
    icon: str = "📦"
    color: str = "#94a3b8"

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


# --- Payment Methods ---

class PaymentMethodOut(BaseModel):
    id: int
    name: str
    sort_order: int

    class Config:
        from_attributes = True

class PaymentMethodCreate(BaseModel):
    name: str


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
    label: str
    amount: float
    category: str
    payment_type: Optional[str] = None
    is_recurring: bool = False
    paid_by: Optional[int] = None
    installments_total: int = 1
    installments_left: int = 1
    note: Optional[str] = None

class ChargeUpdate(BaseModel):
    label: Optional[str] = None
    amount: Optional[float] = None
    actual_amount: Optional[float] = None
    category: Optional[str] = None
    payment_type: Optional[str] = None
    is_recurring: Optional[bool] = None
    paid_by: Optional[int] = None
    note: Optional[str] = None
    installments_total: Optional[int] = None
    installments_left: Optional[int] = None


class FixInstallmentsBody(BaseModel):
    installments_left: int

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

    class Config:
        from_attributes = True


# --- Months ---

class MonthCreate(BaseModel):
    year: int
    month: int
    user1_share: int = 50

    @field_validator("user1_share")
    @classmethod
    def validate_share(cls, v: int) -> int:
        if not (1 <= v <= 99):
            raise ValueError("Split must be between 1 and 99")
        return v

class BulkDeleteMonths(BaseModel):
    ids: List[int]

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
    prev_total: Optional[float] = None
    charges: List[ChargeOut]
    validated_by: Optional[int] = None

    class Config:
        from_attributes = True


# --- Budget entries ---

class BudgetEntryCreate(BaseModel):
    type: str   # "income" | "expense" | "investment"
    label: str
    amount: float
    category: Optional[str] = None
    sort_order: int = 0

class BudgetEntryUpdate(BaseModel):
    label: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
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
