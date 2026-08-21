from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.security import require_roles

router = APIRouter()

HEADERS = ["Číslo výkazu", "Datum", "Od", "Do", "Pauza", "Hodiny", "Počet ha", "Tankování PHM (l)", "Datum tankování", "Stroj tankování", "Traktor práce", "Pole", "Typ práce", "Středisko", "Poznámka"]


def cell(value) -> str:
    return f'"{str(value or "").replace(chr(34), chr(34) + chr(34))}"'


@router.get("/csv")
async def export_csv(status: str = "approved", center: str = "all", session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    where = "WHERE r.status = :status AND r.archived_at IS NULL"
    params = {"status": status}
    if center != "all":
        where += " AND r.service_center = :center"
        params["center"] = center
    result = await session.execute(
        text(
            f"""
            SELECT r.report_number, r.date, r.time_start, r.time_end, r.break_hours, r.hours_worked, r.amount_ha,
              COALESCE(fe.fuel_liters, r.fuel_liters, 0) AS fuel_liters, fe.fuel_date, ft.tractor_name AS fuel_tractor_name,
              t.tractor_name, f.field_name, w.name AS work_type, r.service_center, r.notes
            FROM reports r
            LEFT JOIN (
              SELECT report_id, SUM(liters) AS fuel_liters, MIN(date) AS fuel_date, MIN(tractor_id) AS fuel_tractor_id
              FROM fuel_entries WHERE archived_at IS NULL GROUP BY report_id
            ) fe ON fe.report_id = r.id
            LEFT JOIN tractors ft ON fe.fuel_tractor_id = ft.id
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
            row["report_number"], str(row["date"])[:10], row["time_start"], row["time_end"], row["break_hours"],
            row["hours_worked"], row["amount_ha"], row["fuel_liters"], str(row["fuel_date"] or "")[:10],
            row["fuel_tractor_name"] or row["tractor_name"], row["tractor_name"], row["field_name"], row["work_type"],
            row["service_center"], str(row["notes"] or "").replace("\n", " "),
        ])
    csv = "\ufeff" + "\r\n".join(",".join(cell(item) for item in row) for row in rows)
    return Response(csv, media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="adw_reports.csv"'})

