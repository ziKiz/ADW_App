from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_audit_context(session: AsyncSession, user: dict[str, Any] | None, request_id: str | None = None) -> None:
    actor_id = str(user.get("id")) if user else ""
    actor_name = str(user.get("full_name") or user.get("username") or "Systém") if user else "Systém"
    await session.execute(text("SELECT set_config('adw.actor_id', :actor_id, true)"), {"actor_id": actor_id})
    await session.execute(text("SELECT set_config('adw.actor_name', :actor_name, true)"), {"actor_name": actor_name})
    await session.execute(text("SELECT set_config('adw.request_id', :request_id, true)"), {"request_id": request_id or ""})


async def write_app_audit(
    session: AsyncSession,
    collection: str,
    record_id: int,
    action: str,
    before: Any,
    after: Any,
    user: dict[str, Any] | None,
    request_id: str | None = None,
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO audit_log
              (collection, record_id, action, changed_by, changed_by_id, request_id, before_data, after_data)
            VALUES
              (:collection, :record_id, :action, :changed_by, :changed_by_id, :request_id, CAST(:before_data AS jsonb), CAST(:after_data AS jsonb))
            """
        ),
        {
            "collection": collection,
            "record_id": record_id,
            "action": action,
            "changed_by": (user or {}).get("full_name") or (user or {}).get("username") or "Systém",
            "changed_by_id": str((user or {}).get("id") or ""),
            "request_id": request_id,
            "before_data": before,
            "after_data": after,
        },
    )
