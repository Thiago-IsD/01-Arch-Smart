import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, Integer, JSON, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    office_name = Column(String)
    role = Column(String, default="ARCHITECT")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    subscription = relationship("Subscription", back_populates="user", uselist=False)
    projects = relationship("Project", back_populates="user")
    library_items = relationship("LibraryItem", back_populates="user")
    ai_logs = relationship("AIUsageLog", back_populates="user")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    stripe_customer_id = Column(String)
    current_period_end = Column(DateTime)

    # Relationships
    user = relationship("User", back_populates="subscription")

class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    client_name = Column(String)
    status = Column(String, default="PLANNING")
    total_area_m2 = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="projects")
    environments = relationship("Environment", back_populates="project", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="project", cascade="all, delete-orphan")

class Environment(Base):
    __tablename__ = "environments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    area_m2 = Column(Float)
    waste_margin = Column(Float, default=10.00)

    # Relationships
    project = relationship("Project", back_populates="environments")
    items = relationship("ProjectItem", back_populates="environment", cascade="all, delete-orphan")

class LibraryItem(Base):
    __tablename__ = "library_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id")) # Nullable if system items exist, but spec says user_idFK(users)
    title = Column(String, nullable=False)
    category = Column(String)
    provider = Column(String)
    unit_price = Column(Float)
    yield_per_unit = Column(Float)
    image_url = Column(String)
    source_url = Column(String)
    raw_ai_data = Column(JSON)

    # Relationships
    user = relationship("User", back_populates="library_items")
    project_items = relationship("ProjectItem", back_populates="library_item")

class ProjectItem(Base):
    __tablename__ = "project_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id", ondelete="CASCADE"), nullable=False)
    library_item_id = Column(UUID(as_uuid=True), ForeignKey("library_items.id"), nullable=False)
    calculated_quantity = Column(Float)
    status = Column(String, default="PENDING")

    # Relationships
    environment = relationship("Environment", back_populates="items")
    library_item = relationship("LibraryItem", back_populates="project_items")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False) # INCOME/EXPENSE
    description = Column(String)
    value_estimated = Column(Float)
    value_realized = Column(Float)
    due_date = Column(Date)
    paid_at = Column(DateTime)
    category = Column(String)

    # Relationships
    project = relationship("Project", back_populates="transactions")

class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_count = Column(Integer)
    model_name = Column(String)
    cost_usd = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="ai_logs")
