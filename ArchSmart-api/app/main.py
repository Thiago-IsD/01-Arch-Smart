from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Arch Smart API", version="1.0.0")

# CORS Configuration
# Usamos allow_origin_regex (em vez de allow_origins=["*"]) porque, com
# allow_credentials=True, a spec de CORS proíbe o coringa "*" no header
# Access-Control-Allow-Origin — nesse caso o navegador BLOQUEIA a resposta.
# Com o regex, o Starlette ecoa a origem específica da requisição, o que é
# válido com credenciais (necessário para o Web Clipper, que roda em uma
# origem chrome-extension:// dinâmica).
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
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
from app.api.endpoints import events
app.include_router(events.router, prefix="/api/events", tags=["events"])
from app.api.endpoints import dashboard
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
@app.get("/")
def read_root():
    return {"message": "Welcome to Arch Smart API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
