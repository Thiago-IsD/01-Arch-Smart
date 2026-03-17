from pydantic import BaseModel, field_validator
from typing import Optional
import uuid
from datetime import datetime


class EventCreate(BaseModel):
    title: str
    project_id: Optional[uuid.UUID] = None
    start_time: datetime
    end_time: datetime
    description: Optional[str] = None
    meet_link: Optional[str] = None

    @field_validator("end_time")
    @classmethod
    def end_must_be_after_start(cls, v, info):
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time deve ser maior que start_time")
        return v


class EventUpdate(BaseModel):
    title: Optional[str] = None
    project_id: Optional[uuid.UUID] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    meet_link: Optional[str] = None

    @field_validator("end_time")
    @classmethod
    def end_must_be_after_start(cls, v, info):
        if v is not None and "start_time" in info.data and info.data["start_time"] is not None:
            if v <= info.data["start_time"]:
                raise ValueError("end_time deve ser maior que start_time")
        return v


class EventResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    meet_link: Optional[str] = None
    google_event_id: Optional[str] = None
    created_at: datetime
    project_name: Optional[str] = None  # Populado via JOIN

    class Config:
        from_attributes = True
