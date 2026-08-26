from __future__ import annotations

import json
from datetime import date, time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context, write_app_audit
from app.db import get_session
from app.security import can_access_report, get_current_user, is_elevated_user, normalize_role

router = APIRouter()


def parse_date_value(value: Any) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def parse_time_value(value: Any) -> time | None:
    if value in (None, ""):
        return None
    if isinstance(value, time):
        return value
    return time.fromisoformat(str(value))


def validate_report_time_order(requires_time_order: bool, time_start: time | None, time_end: time | None) -> None:
    if requires_time_order and time_start and time_end and time_end <= time_start:
        raise HTTPException(status_code=422, detail="Konec práce musí být po začátku.")


def is_timed_report(payload: dict[str, Any]) -> bool:
    return payload.get("report_kind") in (None, "work", "doctor") and payload.get("time_start") and payload.get("time_end")


async def ensure_no_time_overlap(
    session: AsyncSession,
    user_id: Any,
    report_date: date | None,
    time_start: time | None,
    time_end: time | None,
    *,
    exclude_report_id: int | None = None,
) -> None:
    if not user_id or not report_date or not time_start or not time_end:
        return
    params: dict[str, Any] = {
        "user_id": user_id,
        "date": report_date,
        "time_start": time_start,
        "time_end": time_end,
    }
    exclude_clause = ""
    if exclude_report_id is not None:
        exclude_clause = "AND id <> :exclude_report_id"
        params["exclude_report_id"] = exclude_report_id
    result = await session.execute(
        text(
            f"""
            SELECT id
            FROM reports
            WHERE archived_at IS NULL
              AND user_id = :user_id
              AND date = :date
              AND time_start IS NOT NULL
              AND time_end IS NOT NULL
              {exclude_clause}
              AND time_start < :time_end
              AND time_end > :time_start
            LIMIT 1
            """
        ),
        params,
    )
    if result.first():
        raise HTTPException(status_code=409, detail="V zadaném čase už existuje jiný výkaz.")


def report_select(where: str = "") -> str:
    return f"""
      SELECT r.id, r.report_number, r.report_kind, r.user_id, r.employee_name, r.service_center,
        r.date, r.time_start, r.time_end, r.break_hours, r.hours_worked, r.amount_ha,
        COALESCE(fe.fuel_liters, r.fuel_liters, 0) AS fuel_liters, fe.fuel_date, fe.fuel_note,
        r.notes, r.status, r.field_entries, r.attachments,
        t.tractor_name, f.field_name, w.name AS work_type,
        r.tractor_id, r.field_id, r.work_type_id
      FROM reports r
      LEFT JOIN (
        SELECT report_id, SUM(liters) AS fuel_liters, MIN(date) AS fuel_date, STRING_AGG(NULLIF(note, ''), '; ') AS fuel_note
        FROM fuel_entries
        WHERE archived_at IS NULL
        GROUP BY report_id
      ) fe ON fe.report_id = r.id
      LEFT JOIN tractors t ON r.tractor_id = t.id
      LEFT JOIN fields f ON r.field_id = f.id
      LEFT JOIN work_types w ON r.work_type_id = w.id
      WHERE r.archived_at IS NULL {where}
    """


def reports_scope_clause(user: dict[str, Any], params: dict[str, Any], *, allow_scoped_review: bool = True) -> str:
    if is_elevated_user(user):
        return ""
    if allow_scoped_review and normalize_role(user.get("role")) in {"schvalovatel", "specialista"}:
        scope = user.get("scope_department") or user.get("department_name")
        if scope:
            params["scope_center"] = scope
            params["current_user_id"] = user["id"]
            return " AND (r.user_id = :current_user_id OR r.service_center = :scope_center)"
    params["current_user_id"] = user["id"]
    return " AND r.user_id = :current_user_id"


def report_identity_for_create(payload: dict[str, Any], user: dict[str, Any]) -> tuple[Any, str]:
    if is_elevated_user(user):
        return payload.get("user_id") or user["id"], payload.get("employee_name") or user["full_name"]
    return user["id"], user["full_name"]


def report_identity_for_update(payload: dict[str, Any], user: dict[str, Any], current_report: dict[str, Any]) -> tuple[Any, str]:
    if is_elevated_user(user):
        return payload.get("user_id") or current_report.get("user_id"), payload.get("employee_name") or current_report.get("employee_name") or user["full_name"]
    return current_report.get("user_id"), current_report.get("employee_name") or user["full_name"]


@router.get("")
@router.get("/")
async def list_reports(status: str | None = None, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    params: dict[str, Any] = {}
    where = ""
    if status:
        where += " AND r.status = :status"
        params["status"] = status
    where += reports_scope_clause(user, params)
    result = await session.execute(text(report_select(where) + " ORDER BY r.created_at DESC"), params)
    return [dict(row) for row in result.mappings().all()]


@router.get("/last-used")
async def get_last_used_report(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(
        text(
            """
            SELECT
              r.id AS report_id,
              r.service_center,
              r.tractor_id,
              t.tractor_name,
              r.work_type_id,
              w.name AS work_type,
              r.attachments,
              r.date
            FROM reports r
            LEFT JOIN tractors t ON r.tractor_id = t.id
            LEFT JOIN work_types w ON r.work_type_id = w.id
            WHERE r.archived_at IS NULL
              AND r.report_kind = 'work'
              AND r.user_id = :user_id
              AND r.work_type_id IS NOT NULL
              AND COALESCE(w.name, '') NOT IN ('Dovolená', 'Školení', 'Doktor')
            ORDER BY r.date DESC, r.created_at DESC
            LIMIT 1
            """
        ),
        {"user_id": user["id"]},
    )
    row = result.mappings().first()
    return dict(row) if row else None


@router.get("/{report_id}")
async def get_report(report_id: int, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(text(report_select(" AND r.id = :id")), {"id": report_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Výkaz nenalezen")
    if not can_access_report(row, user, allow_scoped_review=True):
        raise HTTPException(status_code=403, detail="Nemáte oprávnění k tomuto výkazu.")
    return dict(row)


@router.post("")
@router.post("/")
async def create_report(payload: dict[str, Any], request: Request, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    is_work = payload.get("report_kind") in (None, "work")
    report_date = parse_date_value(payload.get("date"))
    time_start = parse_time_value(payload.get("time_start"))
    time_end = parse_time_value(payload.get("time_end"))
    validate_report_time_order(is_work or is_timed_report(payload), time_start, time_end)
    report_user_id, employee_name = report_identity_for_create(payload, user)
    if is_timed_report(payload):
        await ensure_no_time_overlap(session, report_user_id, report_date, time_start, time_end)
    result = await session.execute(
        text(
            """
            INSERT INTO reports(
              report_number, report_kind, tractor_id, user_id, employee_name, service_center, field_id, field_entries,
              work_type_id, date, time_start, time_end, break_hours, hours_worked, amount_ha, fuel_liters,
              half_day_leave, attachments, notes, status, submitted_at, created_by, updated_by
            )
            VALUES (
              :report_number, :report_kind, :tractor_id, :user_id, :employee_name, :service_center, :field_id, CAST(:field_entries AS jsonb),
              :work_type_id, :date, :time_start, :time_end, :break_hours, :hours_worked, :amount_ha, 0,
              :half_day_leave, CAST(:attachments AS jsonb), :notes, 'pending', NOW(), :actor, :actor
            )
            RETURNING id
            """
        ),
        {
            "report_number": payload.get("report_number"),
            "report_kind": payload.get("report_kind") or "work",
            "tractor_id": payload.get("tractor_id") if is_work else None,
            "user_id": report_user_id,
            "employee_name": employee_name,
            "service_center": payload.get("service_center"),
            "field_id": payload.get("field_id") if is_work else None,
            "field_entries": json.dumps(payload.get("field_entries") or []),
            "work_type_id": payload.get("work_type_id"),
            "date": report_date,
            "time_start": time_start,
            "time_end": time_end,
            "break_hours": payload.get("break_hours") or 0,
            "hours_worked": payload.get("hours_worked") or 0,
            "amount_ha": payload.get("amount_ha") or 0,
            "half_day_leave": "Půldenní dovolená" in str(payload.get("notes") or ""),
            "attachments": json.dumps(payload.get("attachments") or []),
            "notes": payload.get("notes"),
            "actor": user["full_name"],
        },
    )
    report_id = result.scalar_one()
    fuel = payload.get("fuel_entry") or {}
    if float(fuel.get("liters") or 0) > 0:
        await session.execute(
            text(
                """
                INSERT INTO fuel_entries(report_id, date, tractor_id, user_id, liters, note)
                VALUES (:report_id, :date, :tractor_id, :user_id, :liters, :note)
                """
            ),
            {
                "report_id": report_id,
                "date": parse_date_value(fuel.get("date") or payload.get("date")),
                "tractor_id": fuel.get("tractor_id") or payload.get("tractor_id"),
                "user_id": report_user_id,
                "liters": fuel.get("liters") or 0,
                "note": fuel.get("note"),
            },
        )
    await write_app_audit(session, "reports", report_id, "submit", None, json.dumps(payload), user, request.headers.get("x-request-id"))
    await session.commit()
    return {"id": report_id}


@router.put("/{report_id}")
async def update_report(report_id: int, payload: dict[str, Any], request: Request, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    before_row = (await session.execute(text("SELECT * FROM reports WHERE id = :id AND archived_at IS NULL"), {"id": report_id})).mappings().first()
    if before_row is None:
        raise HTTPException(status_code=404, detail="Výkaz nenalezen")
    if not can_access_report(before_row, user, allow_scoped_review=True):
        raise HTTPException(status_code=403, detail="Nemáte oprávnění upravit tento výkaz.")
    is_work = payload.get("report_kind") in (None, "work")
    report_date = parse_date_value(payload.get("date"))
    time_start = parse_time_value(payload.get("time_start"))
    time_end = parse_time_value(payload.get("time_end"))
    validate_report_time_order(is_work or is_timed_report(payload), time_start, time_end)
    before_dict = dict(before_row)
    report_user_id, employee_name = report_identity_for_update(payload, user, before_dict)
    if is_timed_report(payload):
        await ensure_no_time_overlap(session, report_user_id, report_date, time_start, time_end, exclude_report_id=report_id)
    await session.execute(
        text(
            """
            UPDATE reports SET
              report_kind = :report_kind, tractor_id = :tractor_id, user_id = :user_id, employee_name = :employee_name,
              service_center = :service_center, field_id = :field_id, field_entries = CAST(:field_entries AS jsonb),
              work_type_id = :work_type_id, date = :date, time_start = :time_start, time_end = :time_end,
              break_hours = :break_hours, hours_worked = :hours_worked, amount_ha = :amount_ha,
              half_day_leave = :half_day_leave, attachments = CAST(:attachments AS jsonb), notes = :notes, updated_by = :actor
            WHERE id = :id
            """
        ),
        {
            "id": report_id,
            "report_kind": payload.get("report_kind") or "work",
            "tractor_id": payload.get("tractor_id") if is_work else None,
            "user_id": report_user_id,
            "employee_name": employee_name,
            "service_center": payload.get("service_center"),
            "field_id": payload.get("field_id") if is_work else None,
            "field_entries": json.dumps(payload.get("field_entries") or []),
            "work_type_id": payload.get("work_type_id"),
            "date": report_date,
            "time_start": time_start,
            "time_end": time_end,
            "break_hours": payload.get("break_hours") or 0,
            "hours_worked": payload.get("hours_worked") or 0,
            "amount_ha": payload.get("amount_ha") or 0,
            "half_day_leave": "Půldenní dovolená" in str(payload.get("notes") or ""),
            "attachments": json.dumps(payload.get("attachments") or []),
            "notes": payload.get("notes"),
            "actor": user["full_name"],
        },
    )
    await session.execute(text("DELETE FROM fuel_entries WHERE report_id = :id"), {"id": report_id})
    fuel = payload.get("fuel_entry") or {}
    if float(fuel.get("liters") or 0) > 0:
        await session.execute(
            text("INSERT INTO fuel_entries(report_id, date, tractor_id, user_id, liters, note) VALUES (:report_id, :date, :tractor_id, :user_id, :liters, :note)"),
            {"report_id": report_id, "date": parse_date_value(fuel.get("date") or payload.get("date")), "tractor_id": fuel.get("tractor_id") or payload.get("tractor_id"), "user_id": report_user_id, "liters": fuel.get("liters") or 0, "note": fuel.get("note")},
        )
    await write_app_audit(session, "reports", report_id, "save", json.dumps(before_dict, default=str), json.dumps(payload), user, request.headers.get("x-request-id"))
    await session.commit()
    return {"id": report_id, "message": "Výkaz byl uložen."}
