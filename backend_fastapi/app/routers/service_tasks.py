from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context
from app.db import get_session
from app.security import get_current_user, require_roles

router = APIRouter()


@router.get("")
@router.get("/")
async def list_service_tasks(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(text("SELECT id, machine, description, created_by, created_at, archived_at, archived_by FROM machine_service_tasks WHERE archived_at IS NULL ORDER BY created_at DESC"))
    return [dict(row) for row in result.mappings().all()]


@router.post("")
@router.post("/")
async def create_service_task(payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "schvalovatel"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    result = await session.execute(
        text("INSERT INTO machine_service_tasks(machine, description, created_by) VALUES (:machine, :description, :created_by) RETURNING id, machine, description, created_by, created_at"),
        {"machine": payload.get("machine"), "description": payload.get("description"), "created_by": user["full_name"]},
    )
    await session.commit()
    return dict(result.mappings().first())


@router.post("/{task_id}/archive")
async def archive_service_task(task_id: int, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "schvalovatel"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    await session.execute(
        text("UPDATE machine_service_tasks SET archived_at = NOW(), archived_by = :archived_by WHERE id = :id"),
        {"archived_by": user["full_name"], "id": task_id},
    )
    await session.commit()
    return {"message": "Servis byl archivován."}

