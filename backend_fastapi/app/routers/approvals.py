import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context, write_app_audit
from app.db import get_session
from app.security import can_access_report, is_elevated_user, require_roles

router = APIRouter()
ALLOWED_APPROVAL_STATUSES = {"approved", "rejected"}


def validate_approval_status(status: str) -> str:
    if status not in ALLOWED_APPROVAL_STATUSES:
        raise HTTPException(status_code=422, detail="Neplatný stav schválení.")
    return status


def approval_action_for_user(report: dict, user: dict, requested_status: str) -> str:
    user_id = int(user["id"])
    primary_id = int(report["primary_approver_id"]) if report.get("primary_approver_id") is not None else None
    task_id = int(report["task_approver_id"]) if report.get("task_approver_id") is not None else None
    separate_task_approval = task_id is not None and task_id != primary_id

    if separate_task_approval and user_id == task_id and report.get("task_approval_status") == "pending":
        return "task" if requested_status == "approved" else "task_rejection_forbidden"
    if user_id == primary_id and report.get("primary_approval_status") == "pending":
        if requested_status == "approved" and separate_task_approval and report.get("task_approval_status") != "approved":
            return "waiting_for_task"
        return "primary"
    if is_elevated_user(user):
        if requested_status == "rejected" and report.get("primary_approval_status") == "pending":
            return "override_primary"
        if separate_task_approval and report.get("task_approval_status") == "pending":
            return "override_task"
        if report.get("primary_approval_status") == "pending":
            if requested_status == "approved" and separate_task_approval and report.get("task_approval_status") != "approved":
                return "waiting_for_task"
            return "override_primary"
    return "none"


@router.post("/{report_id}")
async def approve_report(report_id: int, payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel", "schvalovatel", "specialista"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    report = (await session.execute(text("SELECT * FROM reports WHERE id = :id AND archived_at IS NULL FOR UPDATE"), {"id": report_id})).mappings().first()
    if report is None:
        raise HTTPException(status_code=404, detail="Výkaz nenalezen")
    if not can_access_report(report, user, allow_scoped_review=True):
        raise HTTPException(status_code=403, detail="Nemáte oprávnění schválit tento výkaz.")
    if report["status"] != "pending":
        raise HTTPException(status_code=409, detail="Schvalovat lze pouze výkaz ve stavu ke schválení.")
    status = validate_approval_status(payload.get("status") or "approved")
    action = approval_action_for_user(dict(report), user, status)
    if action == "task_rejection_forbidden":
        raise HTTPException(status_code=422, detail="Vedoucí činnosti práci pouze potvrzuje. Finální zamítnutí provádí hlavní vedoucí.")
    if action == "waiting_for_task":
        raise HTTPException(status_code=409, detail="Finální schválení čeká na vedoucího činnosti.")
    if action == "none":
        raise HTTPException(status_code=409, detail="Tuto část výkazu už nemůžete schválit nebo vám není přiřazena.")

    approval_role = "task" if action in {"task", "override_task"} else "primary"
    if approval_role == "task":
        await session.execute(
            text(
                """
                UPDATE reports SET
                  task_approval_status = :status,
                  task_approved_at = NOW(),
                  task_approved_by = :actor,
                  status = 'pending',
                  updated_by = :actor
                WHERE id = :id
                """
            ),
            {"status": status, "actor": user["full_name"], "id": report_id},
        )
    else:
        await session.execute(
            text(
                """
                UPDATE reports SET
                  primary_approval_status = :status,
                  primary_approved_at = NOW(),
                  primary_approved_by = :actor,
                  status = :status,
                  updated_by = :actor
                WHERE id = :id
                """
            ),
            {"status": status, "actor": user["full_name"], "id": report_id},
        )
    await session.execute(
        text("INSERT INTO approvals(report_id, approver_id, status, comment, approval_role) VALUES (:report_id, :approver_id, :status, :comment, :approval_role)"),
        {"report_id": report_id, "approver_id": user["id"], "status": status, "comment": payload.get("comment"), "approval_role": approval_role},
    )
    await write_app_audit(session, "reports", report_id, "approval", json.dumps(dict(report), default=str), json.dumps(payload), user, request.headers.get("x-request-id"))
    await session.commit()
    message = "Činnost byla potvrzena a čeká na finální schválení." if approval_role == "task" and status == "approved" else "Výkaz byl finálně schválen." if status == "approved" else "Výkaz byl zamítnut."
    return {"message": message, "status": "pending" if approval_role == "task" and status == "approved" else status, "approval_role": approval_role}
