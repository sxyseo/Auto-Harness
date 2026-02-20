"""
Auto Claude API — FastAPI Application
======================================

Main FastAPI application with CORS middleware, Socket.IO integration,
and lifespan events. Serves as the backend for the Next.js web frontend.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

import socketio
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_auth
from .routes.agents import router as agents_router
from .routes.changelog import router as changelog_router
from .routes.context import router as context_router
from .routes.env import router as env_router
from .routes.github import router as github_router
from .routes.gitlab import router as gitlab_router
from .routes.health import router as health_router
from .routes.ideation import router as ideation_router
from .routes.insights import router as insights_router
from .routes.projects import router as projects_router
from .routes.roadmap import router as roadmap_router
from .routes.settings import router as settings_router
from .routes.tasks import router as tasks_router
from .routes.terminal import router as terminal_router
from .shared import API_TOKEN
from .websocket.agent_ns import register_agent_namespace
from .websocket.events_ns import register_events_namespace
from .websocket.terminal_ns import get_terminal_service, register_terminal_namespace

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CORS origins — read from env var or fall back to localhost dev servers
# ---------------------------------------------------------------------------
_cors_origins_raw = os.environ.get("CORS_ALLOWED_ORIGINS", "")
CORS_ORIGINS: list[str] = (
    [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]
    if _cors_origins_raw
    else ["http://localhost:3000", "http://localhost:3001"]
)

# ---------------------------------------------------------------------------
# Socket.IO async server for real-time communication
# ---------------------------------------------------------------------------
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=CORS_ORIGINS,
)

# Register Socket.IO namespaces
register_terminal_namespace(sio)
register_agent_namespace(sio)
register_events_namespace(sio)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    # Startup — log the API token so the frontend process can pick it up
    logger.info("AUTO_CLAUDE_API_TOKEN=%s", API_TOKEN)
    yield
    # Shutdown — kill all PTY sessions
    await get_terminal_service().kill_all()


fastapi_app = FastAPI(
    title="Auto Claude API",
    description="Backend API for the Auto Claude web frontend",
    lifespan=lifespan,
)

# CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routes
# ---------------------------------------------------------------------------

# Health endpoint is public (no auth required)
fastapi_app.include_router(health_router)

# All other routes require authentication
_auth_dep = [Depends(require_auth)]

fastapi_app.include_router(projects_router, dependencies=_auth_dep)
fastapi_app.include_router(tasks_router, dependencies=_auth_dep)
fastapi_app.include_router(settings_router, dependencies=_auth_dep)
fastapi_app.include_router(env_router, dependencies=_auth_dep)
fastapi_app.include_router(agents_router, dependencies=_auth_dep)
fastapi_app.include_router(terminal_router, dependencies=_auth_dep)
fastapi_app.include_router(github_router, dependencies=_auth_dep)
fastapi_app.include_router(gitlab_router, dependencies=_auth_dep)
fastapi_app.include_router(roadmap_router, dependencies=_auth_dep)
fastapi_app.include_router(ideation_router, dependencies=_auth_dep)
fastapi_app.include_router(insights_router, dependencies=_auth_dep)
fastapi_app.include_router(changelog_router, dependencies=_auth_dep)
fastapi_app.include_router(context_router, dependencies=_auth_dep)

# ---------------------------------------------------------------------------
# Mount Socket.IO as ASGI sub-application
# ---------------------------------------------------------------------------
# Export as ``app`` so ``uvicorn api.main:app`` works out of the box.
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
