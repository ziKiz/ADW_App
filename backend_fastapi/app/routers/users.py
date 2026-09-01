from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context
from app.db import get_session
from app.security import get_current_user, hash_password, require_roles

router = APIRouter()


@router.get("/approvers")
async def list_approvers(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(
        text(
            """
            SELECT id, full_name, COALESCE(scope_department, department_name) AS department_name,
              CASE
                WHEN username = :manager_username THEN TRUE
                WHEN :manager_username = '' AND id = :current_user_id THEN TRUE
                ELSE FALSE
              END AS is_primary
            FROM users
            WHERE archived_at IS NULL
              AND active = TRUE
              AND role IN ('admin', 'reditel', 'schvalovatel', 'specialista')
            ORDER BY
              CASE
                WHEN username = :manager_username THEN 0
                WHEN :manager_username = '' AND id = :current_user_id THEN 0
                ELSE 1
              END,
              full_name,
              id
            """
        ),
        {"manager_username": user.get("manager_username") or "", "current_user_id": user.get("id")},
    )
    return [dict(row) for row in result.mappings().all()]


@router.get("")
@router.get("/")
async def list_users(session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    result = await session.execute(
        text(
            """
            SELECT id, username, email, role, full_name, active, position, department_name,
              scope_department, manager_username, manager_name, created_at, created_by, updated_at, updated_by, last_change
            FROM users
            WHERE archived_at IS NULL
            ORDER BY full_name, username
            """
        )
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("")
@router.post("/")
async def create_user(payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    params = {
        **payload,
        "password_hash": hash_password(payload.get("password") or "demo"),
        "active": payload.get("active", True),
        "manager_username": payload.get("manager_username"),
        "manager_name": payload.get("manager_name"),
        "actor": user["full_name"],
    }
    result = await session.execute(
        text(
            """
            INSERT INTO users(username, email, password_hash, role, full_name, active, position, department_name, scope_department, manager_username, manager_name, created_by, updated_by, last_change)
            VALUES (:username, :email, :password_hash, :role, :full_name, :active, :position, :department_name, :scope_department, :manager_username, :manager_name, :actor, :actor, 'Vytvoření záznamu')
            RETURNING id, username, email, role, full_name, active, position, department_name, scope_department, manager_username, manager_name, created_at, created_by, updated_at, updated_by, last_change
            """
        ),
        params,
    )
    await session.commit()
    return dict(result.mappings().first())


@router.put("/{user_id}")
async def update_user(user_id: int, payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    params = {
        **payload,
        "id": user_id,
        "active": payload.get("active", True),
        "manager_username": payload.get("manager_username"),
        "manager_name": payload.get("manager_name"),
        "actor": user["full_name"],
    }
    result = await session.execute(
        text(
            """
            UPDATE users SET
              username=:username, email=:email, role=:role, full_name=:full_name, active=:active,
              position=:position, department_name=:department_name, scope_department=:scope_department,
              manager_username=:manager_username, manager_name=:manager_name,
              updated_by=:actor, last_change='Úprava záznamu'
            WHERE id=:id
            RETURNING id, username, email, role, full_name, active, position, department_name, scope_department, manager_username, manager_name, created_at, created_by, updated_at, updated_by, last_change
            """
        ),
        params,
    )
    await session.commit()
    return dict(result.mappings().first())
