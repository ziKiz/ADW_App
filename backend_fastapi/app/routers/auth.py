from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.security import create_access_token, verify_password

router = APIRouter()


class LoginInput(BaseModel):
    login: str | None = None
    email: str | None = None
    password: str


@router.post("/login")
async def login(payload: LoginInput, session: AsyncSession = Depends(get_session)):
    login_name = (payload.login or payload.email or "").strip()
    if not login_name:
        raise HTTPException(status_code=401, detail="Neplatné přihlašovací údaje")
    result = await session.execute(
        text(
            """
            SELECT id, username, email, password_hash, role, full_name, department_name, scope_department, manager_username, manager_name
            FROM users
            WHERE (username = :login OR email = :login) AND active = TRUE AND archived_at IS NULL
            """
        ),
        {"login": login_name},
    )
    user = result.mappings().first()
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Neplatné přihlašovací údaje")
    data = {key: user[key] for key in user.keys() if key != "password_hash"}
    data["access_token"] = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    data["token_type"] = "bearer"
    return data
