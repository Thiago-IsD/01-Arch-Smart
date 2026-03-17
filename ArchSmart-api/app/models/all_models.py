import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, Integer, JSON, Date, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base

# Enums
class SubscriptionStatus(str, enum.Enum):
    BETA = "BETA"
    ACTIVE = "ACTIVE"
    CANCELED = "CANCELED"
    READ_ONLY = "READ_ONLY"

class ProductOriginType(str, enum.Enum):
    WEB_CLIPPER = "WEB_CLIPPER"
    SHOPPING_HUB = "SHOPPING_HUB"
    MANUAL = "MANUAL"
    # New values from the provided snippet, assuming they are additions/replacements
    CATALOG = "CATALOG" # Added from snippet

class ProductStateStatus(str, enum.Enum):
    CAPTURED = "CAPTURED"
    NORMALIZED = "NORMALIZED"
    INACTIVE = "INACTIVE"
    # New values from the provided snippet, assuming they are additions/replacements
    ACTIVE = "ACTIVE" # Added from snippet
    ARCHIVED = "ARCHIVED" # Added from snippet
    DELETED = "DELETED" # Added from snippet

class RuleType(str, enum.Enum): # Added RuleType enum
    FLOOR = "FLOOR"
    WALL = "WALL"
    CEILING = "CEILING"
    UNIT = "UNIT"

class PresentationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ACCEPTED = "ACCEPTED"
    REVISION_REQUESTED = "REVISION_REQUESTED"

# 1. CAMADA RAIZ — MULTI-TENANCY

class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    company_name = Column(String, nullable=True)  # Branding: Nome do escritório
    logo_url = Column(String, nullable=True)  # Branding: Caminho da logo
    is_active = Column(Boolean, default=True) # Soft delete
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="account")
    projects = relationship("Project", back_populates="account")
    products = relationship("Product", back_populates="account")
    financial_entries = relationship("FinancialEntry", back_populates="account")
    legal_acceptances = relationship("LegalAcceptance", back_populates="account")
    events = relationship("Event", back_populates="account")
    subscription = relationship("Subscription", back_populates="account", uselist=False)
    admin_logs = relationship("AdminLog", back_populates="account")
    leads = relationship("Lead", back_populates="account")
    clients = relationship("Client", back_populates="account")
    notifications = relationship("Notification", back_populates="account")

# 2. ACESSO, IDENTIDADE E ORIGEM

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    supabase_id = Column(String, unique=True, index=True, nullable=True)  # Link to Supabase Auth
    full_name = Column(String)
    role = Column(String, default="ARCHITECT")
    # hashed_password removed (managed by Supabase Auth)
    cpf = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="users")
    admin_logs = relationship("AdminLog", back_populates="user")

# VerificationToken removed

class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True) # 0..1 to 1
    name = Column(String)
    email = Column(String)
    phone = Column(String)
    origin = Column(String, default="SITE")
    active_projects = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="leads")
    legal_acceptances = relationship("LegalAcceptance", back_populates="lead")

class LegalAcceptance(Base):
    __tablename__ = "legal_acceptances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=True)
    document_version = Column(String, nullable=False)
    accepted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="legal_acceptances")
    lead = relationship("Lead", back_populates="legal_acceptances")

# 3. MONETIZAÇÃO E CONTROLE

class Plan(Base):
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    limits = Column(JSON) # Definition of limits
    
    # Relationships
    subscriptions = relationship("Subscription", back_populates="plan")

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.BETA, nullable=False)
    current_period_end = Column(DateTime)
    stripe_customer_id = Column(String)

    # Relationships
    account = relationship("Account", back_populates="subscription")
    plan = relationship("Plan", back_populates="subscriptions")
    project_slots = relationship("ProjectSlot", back_populates="subscription")

class ProjectSlot(Base):
    __tablename__ = "project_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)

    # Relationships
    subscription = relationship("Subscription", back_populates="project_slots")
    project = relationship("Project", back_populates="slot")

# 4. NÚCLEO 1 — BIBLIOTECA DE PRODUTOS

class ProductOrigin(Base):
    __tablename__ = "product_origins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    type = Column(Enum(ProductOriginType), nullable=False)

    # Relationships
    products = relationship("Product", back_populates="origin")

class ProductState(Base):
    __tablename__ = "product_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    status = Column(Enum(ProductStateStatus), nullable=False)

    # Relationships
    products = relationship("Product", back_populates="state")

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    origin_id = Column(UUID(as_uuid=True), ForeignKey("product_origins.id"), nullable=True)
    state_id = Column(UUID(as_uuid=True), ForeignKey("product_states.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    store = Column(String, nullable=True) # New field
    category = Column(String, nullable=True) # New field
    price = Column(Float, nullable=True) # New field
    dimensions = Column(JSON, nullable=True) # New field: {width, height, depth, unit}
    yield_factor = Column(Float, nullable=True) # New field: Rendimento de Cobertura (m2, ml, etc.)
    image_url = Column(String)
    source_url = Column(String, nullable=True) # Link to original store
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    account = relationship("Account", back_populates="products")
    origin = relationship("ProductOrigin", back_populates="products")
    state = relationship("ProductState", back_populates="products")
    item_options = relationship("ItemOption", back_populates="product")

# 5. NÚCLEO 2 — PROJETO & AMBIENTES

class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="ACTIVE")
    service_type = Column(String, nullable=True)
    service_value = Column(Float, nullable=True)
    payment_installments = Column(Integer, nullable=True)
    payment_method = Column(String, default="STANDARD")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="projects")
    client = relationship("Client", back_populates="projects")
    environments = relationship("Environment", back_populates="project")
    budget = relationship("Budget", back_populates="project", uselist=False)
    presentations = relationship("Presentation", back_populates="project")
    slot = relationship("ProjectSlot", back_populates="project", uselist=False)
    financial_entry = relationship("FinancialEntry", back_populates="project", uselist=False) # 0..1
    events = relationship("Event", back_populates="project") # 0..N

    @property
    def environments_count(self) -> int:
        return len(self.environments) if self.environments else 0

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String)
    phone = Column(String)

    # Relationships
    account = relationship("Account", back_populates="clients")
    projects = relationship("Project", back_populates="client")

class Environment(Base):
    __tablename__ = "environments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=True) # Ex: Interna/Seca
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="environments")
    dna = relationship("EnvironmentDNA", back_populates="environment", uselist=False, cascade="all, delete-orphan")
    budget_items = relationship("BudgetItem", back_populates="environment")
    presentation_environments = relationship("PresentationEnvironment", back_populates="environment")

class EnvironmentDNA(Base):
    __tablename__ = "environment_dnas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id", ondelete="CASCADE"), nullable=False, unique=True)
    floor_area = Column(Float, default=0.0)
    wall_area = Column(Float, default=0.0)
    ceiling_area = Column(Float, default=0.0)
    is_complete = Column(Boolean, default=False)

    # Relationships
    environment = relationship("Environment", back_populates="dna")

# 6. NÚCLEO 3 — ORÇAMENTO INTELIGENTE

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    total_value = Column(Float)

    # Relationships
    project = relationship("Project", back_populates="budget")
    items = relationship("BudgetItem", back_populates="budget")

class BudgetItem(Base):
    __tablename__ = "budget_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id", ondelete="CASCADE"), nullable=True)
    rule_type = Column(Enum(RuleType), nullable=False)
    manual_quantity = Column(Integer, nullable=True)
    loss_factor = Column(Float, default=10.0) # Perdimento padrão de 10%
    
    # Relationships
    budget = relationship("Budget", back_populates="items")
    environment = relationship("Environment", back_populates="budget_items")
    options = relationship("ItemOption", back_populates="budget_item", cascade="all, delete-orphan")

class ItemOption(Base):
    __tablename__ = "item_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_item_id = Column(UUID(as_uuid=True), ForeignKey("budget_items.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    is_selected = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    budget_item = relationship("BudgetItem", back_populates="options")
    product = relationship("Product", back_populates="item_options")

# 7. NÚCLEO 4 — APRESENTAÇÃO

class Presentation(Base):
    __tablename__ = "presentations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(PresentationStatus), default=PresentationStatus.DRAFT, nullable=False)
    branding_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="presentations")
    environments = relationship("PresentationEnvironment", back_populates="presentation", cascade="all, delete-orphan")
    acceptance = relationship("PresentationAcceptance", back_populates="presentation", uselist=False, cascade="all, delete-orphan")
    comments = relationship("PresentationComment", back_populates="presentation", cascade="all, delete-orphan")

class PresentationEnvironment(Base):
    __tablename__ = "presentation_environments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id = Column(UUID(as_uuid=True), ForeignKey("presentations.id"), nullable=False)
    environment_id = Column(UUID(as_uuid=True), ForeignKey("environments.id"), nullable=False)
    is_visible = Column(Boolean, default=True)
    # Campos de detalhamento (Feature 6.1.C)
    title = Column(String, nullable=True)
    subtitle = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    image_urls = Column(JSON, default=list)

    # Relationships
    presentation = relationship("Presentation", back_populates="environments")
    environment = relationship("Environment", back_populates="presentation_environments")

class PresentationAcceptance(Base):
    __tablename__ = "presentation_acceptances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id = Column(UUID(as_uuid=True), ForeignKey("presentations.id"), nullable=False)
    accepted = Column(Boolean, default=False)
    feedback = Column(Text, nullable=True)
    client_ip = Column(String, nullable=True)
    accepted_at = Column(DateTime, default=datetime.utcnow)
    selected_options_snapshot = Column(JSON, nullable=True)

    # Relationships
    presentation = relationship("Presentation", back_populates="acceptance")

class PresentationComment(Base):
    __tablename__ = "presentation_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    presentation_id = Column(UUID(as_uuid=True), ForeignKey("presentations.id"), nullable=False)
    author_type = Column(String, nullable=False) # 'CLIENT' | 'ARCHITECT'
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    presentation = relationship("Presentation", back_populates="comments")

# 8. SUPORTE (FINANCEIRO, AGENDA, ADMIN)

class FinancialEntry(Base):
    __tablename__ = "financial_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    description = Column(String)
    category = Column(String)
    amount = Column(Float)
    type = Column(String) # INCOME, EXPENSE
    status = Column(String, default="PREDICTED") # PREDICTED, REALIZED
    due_date = Column(Date)
    group_id = Column(String, index=True, nullable=True) # ID to group recurring/installment entries
    installment_number = Column(Integer, nullable=True) # Indicates which installment this is
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="financial_entries")
    project = relationship("Project", back_populates="financial_entry")

class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    meet_link = Column(String, nullable=True)
    google_event_id = Column(String, nullable=True)  # Preparação para Google Calendar OAuth
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="events")
    project = relationship("Project", back_populates="events")

class AdminLog(Base):
    __tablename__ = "admin_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="admin_logs")
    account = relationship("Account", back_populates="admin_logs")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="notifications")

# RAG / Knowledge Base
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    # pgvector não está disponível no ambiente local (ex: ao rodar alembic migrations).
    # O servidor de produção/desenvolvimento tem o pacote instalado.
    from sqlalchemy import Text as Vector  # type: ignore[assignment]

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True) # Using Integer/BigSerial as per SQL definition
    content = Column(Text)
    metadata_ = Column("metadata", JSON) # 'metadata' is reserved in SQLAlchemy Base, using alias or explicit name
    embedding = Column(Vector(1536))
