from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.security import require_roles

router = APIRouter()


@router.get("")
@router.get("/")
async def list_audit(
    limit: int = 50,
    collection: str | None = None,
    user_id: str | None = None,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_roles("admin", "reditel")),
):
    safe_limit = min(max(limit, 1), 500)
    where = []
    params = {"limit": safe_limit}
    if collection:
        where.append("collection = :collection")
        params["collection"] = collection
    if user_id:
        where.append("changed_by_id = :user_id")
        params["user_id"] = user_id
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    result = await session.execute(
        text(
            f"""
            SELECT id, collection, record_id, action, changed_at, changed_by, changed_by_id, request_id, before_data, after_data
            FROM audit_log
            {clause}
            ORDER BY changed_at DESC
            LIMIT :limit
            """
        ),
        params,
    )
    return [dict(row) for row in result.mappings().all()]
