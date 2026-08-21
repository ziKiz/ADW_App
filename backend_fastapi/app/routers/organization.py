from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.security import require_roles

router = APIRouter()

ROLE_DEFINITIONS = [
    {"role_code": "ADMIN", "role": "admin", "role_name": "Administrátor systému"},
    {"role_code": "DIRECTOR", "role": "reditel", "role_name": "Ředitel společnosti"},
    {"role_code": "DEPT_MANAGER", "role": "schvalovatel", "role_name": "Vedoucí střediska"},
    {"role_code": "SPECIALIST", "role": "specialista", "role_name": "Odborná role"},
    {"role_code": "HELIOS_CONTROL", "role": "helios", "role_name": "Mzdová a personální kontrola"},
    {"role_code": "EMPLOYEE", "role": "zamestnanec", "role_name": "Zaměstnanec"},
    {"role_code": "TRACTOR_OPERATOR", "role": "traktorista", "role_name": "Traktorista"},
]

ROLE_NAME_BY_ROLE = {item["role"]: item["role_name"] for item in ROLE_DEFINITIONS}
ROLE_CODE_BY_ROLE = {item["role"]: item["role_code"] for item in ROLE_DEFINITIONS}


async def list_departments(session: AsyncSession) -> list[dict]:
    result = await session.execute(
        text(
            """
            SELECT id AS department_id, name, code, parent_id AS parent_department_id, description
            FROM departments
            WHERE archived_at IS NULL
            ORDER BY id
            """
        )
    )
    return [dict(row) for row in result.mappings().all()]


async def list_employees(session: AsyncSession) -> list[dict]:
    result = await session.execute(
        text(
            """
            SELECT id AS employee_id, full_name, position, department_name AS home_department,
              department_name, scope_department, active AS is_active
            FROM users
            WHERE archived_at IS NULL
            ORDER BY full_name, username
            """
        )
    )
    return [dict(row) for row in result.mappings().all()]


async def list_user_roles(session: AsyncSession) -> list[dict]:
    result = await session.execute(
        text(
            """
            SELECT id AS employee_id, role, scope_department
            FROM users
            WHERE archived_at IS NULL
            ORDER BY id
            """
        )
    )
    return [
        {
            "user_role_id": index + 1,
            "employee_id": row["employee_id"],
            "role_code": ROLE_CODE_BY_ROLE.get(row["role"], row["role"]),
            "scope_department": row["scope_department"],
        }
        for index, row in enumerate(result.mappings().all())
    ]


@router.get("")
@router.get("/")
async def organization(session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    return {
        "departments": await list_departments(session),
        "employees": await list_employees(session),
        "roles": ROLE_DEFINITIONS,
        "permissions": [],
        "role_permissions": [],
        "user_roles": await list_user_roles(session),
    }


@router.get("/departments")
async def departments(session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    return await list_departments(session)


@router.get("/employees")
async def employees(session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    return await list_employees(session)


@router.get("/roles")
async def roles(user=Depends(require_roles("admin", "reditel"))):
    return ROLE_DEFINITIONS


@router.get("/permissions")
async def permissions(user=Depends(require_roles("admin", "reditel"))):
    return []


@router.get("/user-roles")
async def user_roles(session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    return await list_user_roles(session)
