from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context
from app.db import get_session
from app.security import hash_password, require_roles

router = APIRouter()
ALLOWED_USER_ROLES = {"admin", "reditel", "schvalovatel", "specialista", "traktorista", "zamestnanec", "approved_viewer"}


def validate_user_payload(payload: dict, *, creating: bool) -> dict:
    username = str(payload.get("username") or "").strip().lower()
    full_name = str(payload.get("full_name") or "").strip()
    role = str(payload.get("role") or "zamestnanec").strip().lower()
    password = str(payload.get("password") or "")
    if not re.fullmatch(r"[a-z0-9._-]+", username):
        raise HTTPException(status_code=422, detail="Přihlašovací jméno smí obsahovat jen malá písmena, čísla, tečku, pomlčku a podtržítko.")
    if not full_name:
        raise HTTPException(status_code=422, detail="Jméno uživatele je povinné.")
    if role not in ALLOWED_USER_ROLES:
        raise HTTPException(status_code=422, detail="Neplatné oprávnění uživatele.")
    if creating and len(password) < 4:
        raise HTTPException(status_code=422, detail="Nový účet musí mít heslo alespoň o 4 znacích.")
    if password and len(password) < 4:
        raise HTTPException(status_code=422, detail="Nové heslo musí mít alespoň 4 znaky.")
    email = str(payload.get("email") or f"{username}@lesonice.local").strip().lower()
    center = str(payload.get("department_name") or "").strip() or None
    return {
        **payload,
        "username": username,
        "email": email,
        "full_name": full_name,
        "role": role,
        "department_name": center,
        "scope_department": str(payload.get("scope_department") or center or "").strip() or None,
        "password": password,
    }


async def manager_values(session: AsyncSession, manager_username: str | None) -> tuple[str | None, str | None]:
    username = str(manager_username or "").strip() or None
    if not username:
        return None, None
    manager_name = await session.scalar(
        text("SELECT full_name FROM users WHERE username = :username AND active = TRUE AND archived_at IS NULL"),
        {"username": username},
    )
    if manager_name is None:
        raise HTTPException(status_code=422, detail="Vybraný nadřízený nebyl nalezen.")
    return username, str(manager_name)


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
    payload = validate_user_payload(payload, creating=True)
    manager_username, manager_name = await manager_values(session, payload.get("manager_username"))
    approval_centers = [payload["scope_department"]] if payload["role"] in {"schvalovatel", "specialista"} and payload.get("scope_department") else []
    params = {
        **payload,
        "password_hash": hash_password(payload["password"]),
        "active": payload.get("active", True),
        "manager_username": manager_username,
        "manager_name": manager_name,
        "approval_centers": approval_centers,
        "default_field_group": "RSL" if payload.get("scope_department") == "Rostlinná výroba" else None,
        "actor": user["full_name"],
    }
    try:
        result = await session.execute(
            text(
                """
                INSERT INTO users(username, email, password_hash, role, full_name, active, position, department_name, scope_department, manager_username, manager_name, approval_centers, default_field_group, created_by, updated_by, last_change)
                VALUES (:username, :email, :password_hash, :role, :full_name, :active, :position, :department_name, :scope_department, :manager_username, :manager_name, :approval_centers, :default_field_group, :actor, :actor, 'Vytvoření uživatelského účtu')
                RETURNING id, username, email, role, full_name, active, position, department_name, scope_department, manager_username, manager_name, created_at, created_by, updated_at, updated_by, last_change
                """
            ),
            params,
        )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Přihlašovací jméno nebo e-mail už existuje.") from exc
    await session.commit()
    return dict(result.mappings().first())


@router.put("/{user_id}")
async def update_user(user_id: int, payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin", "reditel"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    payload = validate_user_payload(payload, creating=False)
    manager_username, manager_name = await manager_values(session, payload.get("manager_username"))
    approval_centers = [payload["scope_department"]] if payload["role"] in {"schvalovatel", "specialista"} and payload.get("scope_department") else []
    params = {
        **payload,
        "id": user_id,
        "active": payload.get("active", True),
        "manager_username": manager_username,
        "manager_name": manager_name,
        "approval_centers": approval_centers,
        "default_field_group": "RSL" if payload.get("scope_department") == "Rostlinná výroba" else None,
        "password_hash": hash_password(payload["password"]) if payload["password"] else None,
        "actor": user["full_name"],
    }
    try:
        result = await session.execute(
            text(
                """
                UPDATE users SET
                  username=:username, email=:email, role=:role, full_name=:full_name, active=:active,
                  position=:position, department_name=:department_name, scope_department=:scope_department,
                  manager_username=:manager_username, manager_name=:manager_name,
                  approval_centers=:approval_centers, default_field_group=:default_field_group,
                  password_hash=COALESCE(:password_hash, password_hash),
                  updated_by=:actor, last_change='Úprava uživatelského účtu'
                WHERE id=:id AND archived_at IS NULL
                RETURNING id, username, email, role, full_name, active, position, department_name, scope_department, manager_username, manager_name, created_at, created_by, updated_at, updated_by, last_change
                """
            ),
            params,
        )
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Přihlašovací jméno nebo e-mail už používá jiný účet.") from exc
    if result.mappings().first() is None:
        raise HTTPException(status_code=404, detail="Uživatel nebyl nalezen.")
    saved = await session.execute(
        text(
            """
            SELECT id, username, email, role, full_name, active, position, department_name,
              scope_department, manager_username, manager_name, created_at, created_by, updated_at, updated_by, last_change
            FROM users WHERE id = :id
            """
        ),
        {"id": user_id},
    )
    await session.commit()
    return dict(saved.mappings().first())
