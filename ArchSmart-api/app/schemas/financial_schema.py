from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
import uuid
from datetime import date, datetime

class FinancialEntryBase(BaseModel):
    description: str
    amount: float
    type: str = Field(..., description="INCOME or EXPENSE")
    status: str = Field(..., description="PREDICTED or REALIZED")
    due_date: date
    category: Optional[str] = None
    project_id: Optional[uuid.UUID] = None

class FinancialEntryCreate(FinancialEntryBase):
    recurrence: str = Field("UNIQUE", description="UNIQUE, RECURRING or INSTALLMENT")
    installments: Optional[int] = Field(1, description="Number of installments if recurrence is INSTALLMENT")

class FinancialEntryUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    category: Optional[str] = None
    type: Optional[str] = None
    apply_to: Optional[str] = Field("SINGLE", description="SINGLE, NEXT or ALL (for recurring/installments)")

class FinancialEntryResponse(FinancialEntryBase):
    id: uuid.UUID
    account_id: uuid.UUID
    group_id: Optional[str] = None
    installment_number: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    project_name: Optional[str] = None # Will be populated if joined with Project

    model_config = ConfigDict(from_attributes=True)

class FinancialSummaryResponse(BaseModel):
    balance: float
    total_income: float
    total_expense: float
