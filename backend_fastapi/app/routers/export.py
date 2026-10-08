from __future__ import annotations

from datetime import date
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.security import require_roles

router = APIRouter()

HEADERS = ["Číslo výkazu", "Uživatel", "Zaměstnanec", "Druh výkazu", "Datum", "Od", "Do", "Pauza", "Hodiny", "Počet ha", "Kód stroje", "Traktor práce", "Pole", "Typ práce", "Středisko", "Poznámka"]
EXPORT_ROLES = ("admin", "reditel", "approved_viewer")


def cell(value) -> str:
    text_value = str(value or "")
    if isinstance(value, str) and text_value.startswith(("=", "+", "-", "@", "\t", "\r")):
        text_value = f"'{text_value}"
    return f'"{text_value.replace(chr(34), chr(34) + chr(34))}"'


def export_period(year: int | None, month: int | None) -> tuple[date | None, date | None]:
    if month is not None and year is None:
        raise HTTPException(status_code=422, detail="Pro výběr měsíce je potřeba zvolit rok.")
    if year is None:
        return None, None
    start = date(year, month or 1, 1)
    if month is None:
        return start, date(year + 1, 1, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def export_filename(year: int | None, month: int | None, center: str) -> str:
    period = str(year) if year else "vse"
    if year and month:
        period = f"{year}_{month:02d}"
    normalized_center = unicodedata.normalize("NFKD", center).encode("ascii", "ignore").decode("ascii")
    center_slug = re.sub(r"[^a-z0-9]+", "_", normalized_center.casefold()).strip("_") or "vse"
    return f"adw_schvalene_{period}_{center_slug}.csv"


@router.get("/csv")
async def export_csv(
    center: str = "all",
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    session: AsyncSession = Depends(get_session),
    _user=Depends(require_roles(*EXPORT_ROLES)),
):
    date_from, date_to = export_period(year, month)
    where = "WHERE r.status = 'approved' AND r.archived_at IS NULL"
    params = {}
    if center != "all":
        where += " AND r.service_center = :center"
        params["center"] = center
    if date_from is not None and date_to is not None:
        where += " AND r.date >= :date_from AND r.date < :date_to"
        params.update({"date_from": date_from, "date_to": date_to})
    result = await session.execute(
        text(
            f"""
            SELECT r.report_number, u.username, r.employee_name, r.report_kind, r.date, r.time_start, r.time_end, r.break_hours, r.hours_worked, r.amount_ha,
              t.tractor_code, t.tractor_name, f.field_name, w.name AS work_type, r.service_center, r.notes
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN tractors t ON r.tractor_id = t.id
            LEFT JOIN fields f ON r.field_id = f.id
            LEFT JOIN work_types w ON r.work_type_id = w.id
            {where}
            ORDER BY r.date DESC
            """
        ),
        params,
    )
    rows = [HEADERS]
    for row in result.mappings().all():
        rows.append([
            row["report_number"], row["username"], row["employee_name"], row["report_kind"], str(row["date"])[:10], row["time_start"], row["time_end"], row["break_hours"],
            row["hours_worked"], row["amount_ha"], row["tractor_code"], row["tractor_name"], row["field_name"], row["work_type"],
            row["service_center"], str(row["notes"] or "").replace("\n", " "),
        ])
    csv = "\ufeff" + "\r\n".join(",".join(cell(item) for item in row) for row in rows)
    filename = export_filename(year, month, center)
    return Response(csv, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
