from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import set_audit_context
from app.db import get_session
from app.security import get_current_user, require_roles

router = APIRouter()


@router.get("/fields")
async def fields(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(text("SELECT id, field_code, field_name, quadrant, area, culture, crop, erosion, created_at, created_by, updated_at, updated_by, last_change FROM fields WHERE archived_at IS NULL ORDER BY field_name, field_code"))
    return [dict(row) for row in result.mappings().all()]


@router.get("/tractors")
async def tractors(service_center: str | None = None, session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    if service_center:
        result = await session.execute(
            text("SELECT id, tractor_code, tractor_name, service_centers, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change FROM tractors WHERE archived_at IS NULL AND status = 'active' AND (:elevated OR service_centers @> ARRAY[:center]::text[]) ORDER BY tractor_name, tractor_code"),
            {"center": service_center, "elevated": user["role"] in ["admin", "reditel"]},
        )
    else:
        result = await session.execute(text("SELECT id, tractor_code, tractor_name, service_centers, vehicle_type, status, created_at, created_by, updated_at, updated_by, last_change FROM tractors WHERE archived_at IS NULL AND status = 'active' ORDER BY tractor_name, tractor_code"))
    return [dict(row) for row in result.mappings().all()]


@router.get("/work-types")
async def work_types(session: AsyncSession = Depends(get_session), user=Depends(get_current_user)):
    result = await session.execute(text("SELECT id, name, description, created_at, created_by, updated_at, updated_by, last_change FROM work_types WHERE archived_at IS NULL ORDER BY id"))
    return [dict(row) for row in result.mappings().all()]


@router.post("/{collection}")
async def create_dictionary(collection: str, payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    if collection == "fields":
        result = await session.execute(
            text("INSERT INTO fields(field_code, field_name, area, culture, crop, created_by, updated_by, last_change) VALUES (:field_code, :field_name, :area, :culture, :crop, :actor, :actor, 'Vytvoření záznamu') RETURNING *"),
            {**payload, "actor": user["full_name"]},
        )
    elif collection == "tractors":
        result = await session.execute(
            text("INSERT INTO tractors(tractor_code, tractor_name, service_centers, vehicle_type, status, created_by, updated_by, last_change) VALUES (:tractor_code, :tractor_name, :service_centers, :vehicle_type, :status, :actor, :actor, 'Vytvoření záznamu') RETURNING *"),
            {**payload, "service_centers": payload.get("service_centers") or [], "status": payload.get("status") or "active", "actor": user["full_name"]},
        )
    else:
        result = await session.execute(
            text("INSERT INTO work_types(name, description, created_by, updated_by, last_change) VALUES (:name, :description, :actor, :actor, 'Vytvoření záznamu') RETURNING *"),
            {**payload, "actor": user["full_name"]},
        )
    await session.commit()
    return dict(result.mappings().first())


@router.put("/{collection}/{item_id}")
async def update_dictionary(collection: str, item_id: int, payload: dict, request: Request, session: AsyncSession = Depends(get_session), user=Depends(require_roles("admin"))):
    await set_audit_context(session, user, request.headers.get("x-request-id"))
    table = {"fields": "fields", "tractors": "tractors", "work-types": "work_types"}.get(collection, collection)
    if table == "fields":
        result = await session.execute(text("UPDATE fields SET field_code=:field_code, field_name=:field_name, area=:area, culture=:culture, crop=:crop, updated_by=:actor, last_change='Úprava záznamu' WHERE id=:id RETURNING *"), {**payload, "id": item_id, "actor": user["full_name"]})
    elif table == "tractors":
        result = await session.execute(text("UPDATE tractors SET tractor_code=:tractor_code, tractor_name=:tractor_name, service_centers=:service_centers, vehicle_type=:vehicle_type, status=:status, updated_by=:actor, last_change='Úprava záznamu' WHERE id=:id RETURNING *"), {**payload, "service_centers": payload.get("service_centers") or [], "id": item_id, "actor": user["full_name"]})
    else:
        result = await session.execute(text("UPDATE work_types SET name=:name, description=:description, updated_by=:actor, last_change='Úprava záznamu' WHERE id=:id RETURNING *"), {**payload, "id": item_id, "actor": user["full_name"]})
    await session.commit()
    return dict(result.mappings().first())
