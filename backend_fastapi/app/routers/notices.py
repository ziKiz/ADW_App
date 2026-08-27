import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context, write_app_audit
from app.db import get_session
from app.security import get_current_user, require_roles

router = APIRouter()


@router.get("")
@router.get("/")
async def list_notices(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(text("SELECT id, title, message, author, created_at FROM notices WHERE archived_at IS NULL ORDER BY created_at DESC"))
    return [dict(row) for row in result.mappings().all()]


@router.post("")
@router.post("/")
async def create_notice(payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    result = await session.execute(
        text("INSERT INTO notices(title, message, author, created_by) VALUES (:title, :message, :author, :created_by) RETURNING id, title, message, author, created_at"),
        {"title": payload.get("title"), "message": payload.get("message"), "author": payload.get("author") or user["full_name"], "created_by": user["id"]},
    )
    await session.commit()
    return dict(result.mappings().first())


@router.post("/{notice_id}/archive")
async def archive_notice(notice_id: int, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    before = (await session.execute(text("SELECT to_jsonb(notices.*) FROM notices WHERE id = :id"), {"id": notice_id})).scalar_one_or_none()
    await session.execute(
        text("UPDATE notices SET archived_at = NOW(), archived_by = :archived_by WHERE id = :id AND archived_at IS NULL"),
        {"archived_by": user["full_name"], "id": notice_id},
    )
    await write_app_audit(
        session,
        "notices",
        notice_id,
        "archive",
        json.dumps(before),
        json.dumps({"archived_by": user["full_name"]}),
        user,
        request.headers.get("x-request-id"),
    )
    await session.commit()
    return {"message": "Informace byla archivována."}
