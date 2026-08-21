import json
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context, write_app_audit
from app.db import get_session
from app.security import require_roles

router = APIRouter()


@router.post("/{report_id}")
async def approve_report(report_id: int, payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel", "schvalovatel", "specialista"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    before = (await session.execute(text("SELECT to_jsonb(reports.*) FROM reports WHERE id = :id"), {"id": report_id})).scalar_one_or_none()
    status = payload.get("status") or "approved"
    await session.execute(text("UPDATE reports SET status = :status, updated_by = :actor WHERE id = :id"), {"status": status, "actor": user["full_name"], "id": report_id})
    await session.execute(
        text("INSERT INTO approvals(report_id, approver_id, status, comment) VALUES (:report_id, :approver_id, :status, :comment)"),
        {"report_id": report_id, "approver_id": user["id"], "status": status, "comment": payload.get("comment")},
    )
    await write_app_audit(session, "reports", report_id, "approval", json.dumps(before), json.dumps(payload), user, request.headers.get("x-request-id"))
    await session.commit()
    return {"message": "Výkaz byl aktualizován", "status": status}

