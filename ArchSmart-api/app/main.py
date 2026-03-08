from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Arch Smart API", version="1.0.0")

# CORS Configuration
origins = ["*"]  # Update this with specific origins in production

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import leads, auth, users, account
app.include_router(leads.router, prefix="/api", tags=["leads"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(account.router, prefix="/api/account", tags=["account"])
from app.api.routers import product_router
app.include_router(product_router.router, prefix="/api/products", tags=["products"])
from app.api.endpoints import projects, presentations
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(presentations.router, prefix="/api", tags=["presentations"])
from app.api.routers import environments_router
app.include_router(environments_router.router, prefix="/api", tags=["environments"])
from app.api.routers import budgets_router
app.include_router(budgets_router.router, prefix="/api", tags=["budgets"])
from app.api.endpoints import public as public_endpoint
app.include_router(public_endpoint.router, prefix="/public", tags=["public"])

from app.api.endpoints import notifications
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
from app.api.endpoints import financial
app.include_router(financial.router, prefix="/api/financial", tags=["financial"])
@app.get("/")
def read_root():
    return {"message": "Welcome to Arch Smart API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
