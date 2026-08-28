from __future__ import annotations

import asyncio
import json
from datetime import date, time
from pathlib import Path
from typing import Any

from sqlalchemy import text

from app.db import SessionLocal
from app.security import hash_password

ROOT = Path(__file__).resolve().parents[2]
DEMO_DATA = ROOT / "frontend" / "public" / "demo-data"


def load_json(name: str, fallback: Any) -> Any:
    path = DEMO_DATA / name
    if not path.exists():
      return fallback
    return json.loads(path.read_text("utf-8"))


def parse_date(value: Any) -> date | None:
    if not value:
        return None
    return date.fromisoformat(str(value)[:10])


def parse_time(value: Any) -> time | None:
    if not value:
        return None
    return time.fromisoformat(str(value)[:8])


async def seed() -> None:
    users = load_json("users.json", [])
    fields = load_json("fields.json", [])
    tractors = load_json("tractors.json", [])
    attachments = load_json("attachments.json", [])
    work_types = load_json("work-types.json", [])
    reports = load_json("reports.json", [])
    fuel_entries = load_json("fuel-entries.json", [])
    services = load_json("service-schedule.json", [])

    async with SessionLocal() as session:
        await session.execute(text("SELECT set_config('adw.actor_name', 'Seed demo dat', true)"))

        for department in ["Ředitelství", "Rostlinná výroba", "Živočišná výroba", "Mechanizace", "BPS", "Stavební skupina", "Mini mlékárna"]:
            await session.execute(
                text(
                    """
                    INSERT INTO departments(name, code, created_by, updated_by)
                    VALUES (:name, :code, 'Seed demo dat', 'Seed demo dat')
                    ON CONFLICT (name) DO NOTHING
                    """
                ),
                {"name": department, "code": department.upper().replace(" ", "_")},
            )

        password_hash = hash_password("demo")
        for user in users:
            await session.execute(
                text(
                    """
                    INSERT INTO users(id, username, email, password_hash, role, full_name, department_name, scope_department, position, active, created_by, updated_by, last_change)
                    VALUES (:id, :username, :email, :password_hash, :role, :full_name, :department_name, :scope_department, :position, :active, 'Seed demo dat', 'Seed demo dat', 'Import demo účtu')
                    ON CONFLICT (id) DO UPDATE SET
                      username = EXCLUDED.username,
                      email = EXCLUDED.email,
                      role = EXCLUDED.role,
                      full_name = EXCLUDED.full_name,
                      department_name = EXCLUDED.department_name,
                      scope_department = EXCLUDED.scope_department,
                      position = EXCLUDED.position,
                      active = EXCLUDED.active,
                      updated_by = 'Seed demo dat',
                      last_change = 'Aktualizace demo účtu'
                    """
                ),
                {
                    "id": user.get("id"),
                    "username": user.get("username"),
                    "email": user.get("email"),
                    "password_hash": password_hash,
                    "role": user.get("role", "zamestnanec"),
                    "full_name": user.get("full_name") or user.get("username"),
                    "department_name": user.get("department_name"),
                    "scope_department": user.get("scope_department"),
                    "position": user.get("position"),
                    "active": user.get("active", True),
                },
            )

        for field in fields:
            await session.execute(
                text(
                    """
                    INSERT INTO fields(id, field_code, field_name, quadrant, area, culture, crop, erosion, created_by, updated_by, last_change)
                    VALUES (:id, :field_code, :field_name, :quadrant, :area, :culture, :crop, :erosion, 'Seed demo dat', 'Seed demo dat', 'Import pozemku')
                    ON CONFLICT (id) DO UPDATE SET
                      field_code = EXCLUDED.field_code,
                      field_name = EXCLUDED.field_name,
                      quadrant = EXCLUDED.quadrant,
                      area = EXCLUDED.area,
                      culture = EXCLUDED.culture,
                      crop = EXCLUDED.crop,
                      erosion = EXCLUDED.erosion,
                      updated_by = 'Seed demo dat'
                    """
                ),
                {
                    "id": field.get("id"),
                    "field_code": field.get("field_code") or str(field.get("id")),
                    "field_name": field.get("field_name") or field.get("name") or f"Pozemek {field.get('id')}",
                    "quadrant": field.get("quadrant"),
                    "area": field.get("area"),
                    "culture": field.get("culture"),
                    "crop": field.get("crop"),
                    "erosion": field.get("erosion"),
                },
            )

        for tractor in tractors:
            await session.execute(
                text(
                    """
                    INSERT INTO tractors(id, tractor_code, tractor_name, service_centers, vehicle_type, status, created_by, updated_by, last_change)
                    VALUES (:id, :tractor_code, :tractor_name, :service_centers, :vehicle_type, :status, 'Seed demo dat', 'Seed demo dat', 'Import stroje')
                    ON CONFLICT (id) DO UPDATE SET
                      tractor_code = EXCLUDED.tractor_code,
                      tractor_name = EXCLUDED.tractor_name,
                      service_centers = EXCLUDED.service_centers,
                      vehicle_type = EXCLUDED.vehicle_type,
                      status = EXCLUDED.status,
                      updated_by = 'Seed demo dat'
                    """
                ),
                {
                    "id": tractor.get("id"),
                    "tractor_code": tractor.get("tractor_code") or tractor.get("code") or str(tractor.get("id")),
                    "tractor_name": tractor.get("tractor_name") or tractor.get("name") or f"Stroj {tractor.get('id')}",
                    "service_centers": tractor.get("service_centers") or [],
                    "vehicle_type": tractor.get("vehicle_type") or "traktor",
                    "status": tractor.get("status") or "active",
                },
            )

        for work_type in work_types:
            await session.execute(
                text(
                    """
                    INSERT INTO work_types(id, name, description, created_by, updated_by, last_change)
                    VALUES (:id, :name, :description, 'Seed demo dat', 'Seed demo dat', 'Import činnosti')
                    ON CONFLICT (id) DO UPDATE SET
                      name = EXCLUDED.name,
                      description = EXCLUDED.description,
                      updated_by = 'Seed demo dat'
                    """
                ),
                {"id": work_type.get("id"), "name": work_type.get("name"), "description": work_type.get("description")},
            )

        for attachment in attachments:
            await session.execute(
                text(
                    """
                    INSERT INTO attachments(id, attachment_code, attachment_name, license_plate, status, created_by, updated_by, last_change)
                    VALUES (:id, :attachment_code, :attachment_name, :license_plate, :status, 'Seed demo dat', 'Seed demo dat', 'Import přípojného zařízení')
                    ON CONFLICT (id) DO UPDATE SET
                      attachment_code = EXCLUDED.attachment_code,
                      attachment_name = EXCLUDED.attachment_name,
                      license_plate = EXCLUDED.license_plate,
                      status = EXCLUDED.status,
                      archived_at = NULL,
                      archived_by = NULL,
                      updated_by = 'Seed demo dat',
                      last_change = 'Aktualizace přípojného zařízení'
                    """
                ),
                {
                    "id": attachment.get("id"),
                    "attachment_code": attachment.get("attachment_code") or None,
                    "attachment_name": attachment.get("attachment_name"),
                    "license_plate": attachment.get("license_plate") or None,
                    "status": attachment.get("status") or "active",
                },
            )
        await session.execute(text("SELECT setval('attachments_id_seq', COALESCE((SELECT MAX(id) FROM attachments), 1), true)"))

        for report in reports:
            await session.execute(
                text(
                    """
                    INSERT INTO reports(
                      id, report_number, report_kind, tractor_id, user_id, employee_name, service_center,
                      field_id, field_entries, work_type_id, date, time_start, time_end, break_hours,
                      hours_worked, amount_ha, fuel_liters, half_day_leave, attachments, notes, status, created_by, updated_by
                    )
                    VALUES (
                      :id, :report_number, :report_kind, :tractor_id, :user_id, :employee_name, :service_center,
                      :field_id, CAST(:field_entries AS jsonb), :work_type_id, :date, :time_start, :time_end, :break_hours,
                      :hours_worked, :amount_ha, :fuel_liters, :half_day_leave, CAST(:attachments AS jsonb), :notes, :status, 'Seed demo dat', 'Seed demo dat'
                    )
                    ON CONFLICT (id) DO NOTHING
                    """
                ),
                {
                    "id": report.get("id"),
                    "report_number": report.get("report_number"),
                    "report_kind": report.get("report_kind") or "work",
                    "tractor_id": report.get("tractor_id"),
                    "user_id": report.get("user_id"),
                    "employee_name": report.get("employee_name"),
                    "service_center": report.get("service_center") or extract_center(report.get("notes")),
                    "field_id": report.get("field_id"),
                    "field_entries": json.dumps(report.get("field_entries") or []),
                    "work_type_id": report.get("work_type_id"),
                    "date": parse_date(report.get("date")),
                    "time_start": parse_time(report.get("time_start")),
                    "time_end": parse_time(report.get("time_end")),
                    "break_hours": report.get("break_hours") or 0,
                    "hours_worked": report.get("hours_worked") or 0,
                    "amount_ha": report.get("amount_ha") or 0,
                    "fuel_liters": report.get("fuel_liters") or 0,
                    "half_day_leave": "Půldenní dovolená" in str(report.get("notes") or ""),
                    "attachments": json.dumps(report.get("attachments") or []),
                    "notes": report.get("notes"),
                    "status": report.get("status") or "pending",
                },
            )

        for entry in fuel_entries:
            await session.execute(
                text(
                    """
                    INSERT INTO fuel_entries(id, report_id, date, tractor_id, user_id, liters, note)
                    VALUES (:id, :report_id, :date, :tractor_id, :user_id, :liters, :note)
                    ON CONFLICT (id) DO NOTHING
                    """
                ),
                {
                    "id": entry.get("id"),
                    "report_id": entry.get("report_id"),
                    "date": parse_date(entry.get("date")),
                    "tractor_id": entry.get("tractor_id"),
                    "user_id": entry.get("user_id"),
                    "liters": entry.get("liters") or 0,
                    "note": entry.get("note"),
                },
            )

        for service in services:
            await session.execute(
                text(
                    """
                    INSERT INTO service_schedule(date, workshop, bps_service, bps_feeding)
                    VALUES (:date, CAST(:workshop AS jsonb), CAST(:bps_service AS jsonb), CAST(:bps_feeding AS jsonb))
                    ON CONFLICT (date) DO UPDATE SET
                      workshop = EXCLUDED.workshop,
                      bps_service = EXCLUDED.bps_service,
                      bps_feeding = EXCLUDED.bps_feeding
                    """
                ),
                {
                    "date": parse_date(service.get("date")),
                    "workshop": json.dumps(service.get("workshop")),
                    "bps_service": json.dumps(service.get("bps_service")),
                    "bps_feeding": json.dumps(service.get("bps_feeding")),
                },
            )

        await seed_contacts(session)
        await seed_panels(session)
        await session.commit()


def extract_center(notes: str | None) -> str:
    if not notes:
        return "Rostlinná výroba"
    marker = "Středisko:"
    if marker not in notes:
        return "Rostlinná výroba"
    return notes.split(marker, 1)[1].splitlines()[0].strip() or "Rostlinná výroba"


async def seed_contacts(session) -> None:
    contacts = load_json("contacts.json", [])
    await session.execute(text("DELETE FROM contacts"))
    for contact in contacts:
        await session.execute(
            text(
                """
                INSERT INTO contacts(id, section, contact_group, full_name, position, mobile, phone_extension)
                VALUES (:id, :section, :contact_group, :full_name, :position, :mobile, :phone_extension)
                """
            ),
            {
                "id": contact.get("id"),
                "section": contact.get("section"),
                "contact_group": contact.get("group"),
                "full_name": contact.get("name"),
                "position": contact.get("title"),
                "mobile": contact.get("phone"),
                "phone_extension": contact.get("phone_extension") or None,
            },
        )
    await session.execute(text("SELECT setval('contacts_id_seq', COALESCE((SELECT MAX(id) FROM contacts), 1), true)"))


async def seed_panels(session) -> None:
    await session.execute(
        text(
            """
            INSERT INTO notices(title, message, author)
            SELECT 'Pozor na termíny výkazů', 'Prosíme doplňovat výkazy průběžně každý pracovní den.', 'Vedení'
            WHERE NOT EXISTS (SELECT 1 FROM notices)
            """
        )
    )
    await session.execute(
        text(
            """
            INSERT INTO machine_service_tasks(machine, description, created_by)
            SELECT 'FENDT VARIO 724', 'Kontrola před sezónou a výměna filtrů.', 'Mechanizace'
            WHERE NOT EXISTS (SELECT 1 FROM machine_service_tasks)
            """
        )
    )


if __name__ == "__main__":
    asyncio.run(seed())
