from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.migrations import run_migrations
from app.routers import apps, auth, backups, deployments, files, settings as settings_router, system
from app.services.scheduler_service import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_directories()
    Base.metadata.create_all(bind=engine)
    run_migrations()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Nova Server Manager API",
    version="2.0.1",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=3600"
    else:
        response.headers["Cache-Control"] = "no-store"
    return response

app.include_router(auth.router)
app.include_router(apps.router)
app.include_router(deployments.router)
app.include_router(files.router)
app.include_router(backups.router)
app.include_router(settings_router.router)
app.include_router(system.router)

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/api/health")
def health():
    return {"ok": True, "service": "nova-server-manager", "version": "2.0.1"}


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    requested = static_dir / path
    if path and requested.is_file() and static_dir.resolve() in requested.resolve().parents:
        return FileResponse(requested)
    return FileResponse(static_dir / "index.html")
