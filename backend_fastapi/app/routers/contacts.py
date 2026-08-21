from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.security import get_current_user

router = APIRouter()


@router.get("")
@router.get("/")
async def list_contacts(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(
        text(
            """
            SELECT id, section, contact_group AS "group", full_name, position, mobile, phone_extension
            FROM contacts
            WHERE archived_at IS NULL
            ORDER BY
              CASE section
                WHEN 'Vedení společnosti' THEN 1
                WHEN 'Pracovní' THEN 2
                ELSE 99
              END,
              CASE contact_group
                WHEN 'Vedení' THEN 1
                WHEN 'Ekonomické oddělení' THEN 2
                WHEN 'Správa majetku' THEN 3
                WHEN 'Rostlinná výroba' THEN 4
                WHEN 'Živočišná výroba' THEN 5
                WHEN 'Mechanizace' THEN 6
                WHEN 'Stavební skupina' THEN 7
                WHEN 'BPS' THEN 8
                WHEN 'Mlékárna' THEN 9
                WHEN 'Vrátnice' THEN 10
                WHEN 'Jídelna' THEN 11
                ELSE 99
              END,
              full_name
            """
        )
    )
    return [dict(row) for row in result.mappings().all()]
