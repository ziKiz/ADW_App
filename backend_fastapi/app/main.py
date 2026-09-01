from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import approvals, audit, auth, contacts, dictionaries, export, notices, organization, reports, service_schedule, service_tasks, users


app = FastAPI(title="ADW Live API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "backend": "fastapi", "mode": settings.app_mode}


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(approvals.router, prefix="/api/approvals", tags=["approvals"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(organization.router, prefix="/api/organization", tags=["organization"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
app.include_router(service_schedule.router, prefix="/api/service-schedule", tags=["service-schedule"])
app.include_router(notices.router, prefix="/api/notices", tags=["notices"])
app.include_router(service_tasks.router, prefix="/api/service-tasks", tags=["service-tasks"])
app.include_router(dictionaries.router, prefix="/api", tags=["dictionaries"])
