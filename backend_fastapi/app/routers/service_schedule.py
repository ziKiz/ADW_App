from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.security import get_current_user

router = APIRouter()


@router.get("")
@router.get("/")
async def list_service_schedule(from_date: date | None = None, days: int = 8, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    start = from_date or date.today()
    end = start + timedelta(days=max(1, min(days, 31)) - 1)
    result = await session.execute(
        text(
            """
            SELECT date, workshop, bps_service, bps_feeding
            FROM service_schedule
            WHERE date BETWEEN :start AND :end
            ORDER BY date
            """
        ),
        {"start": start, "end": end},
    )
    return [dict(row) for row in result.mappings().all()]
