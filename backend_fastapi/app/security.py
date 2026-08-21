from __future__ import annotations

from datetime import datetime, timedelta, timezone
from collections.abc import Mapping
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
ALGORITHM = "HS256"
ELEVATED_ROLES = {"admin", "reditel"}
SCOPED_REVIEW_ROLES = {"schvalovatel", "specialista"}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def normalize_role(role: Any) -> str:
    return str(role or "").casefold()


def is_elevated_user(user: Mapping[str, Any]) -> bool:
    return normalize_role(user.get("role")) in ELEVATED_ROLES


def user_scope_center(user: Mapping[str, Any]) -> str | None:
    center = user.get("scope_department") or user.get("department_name")
    return str(center).strip() if center else None


def can_access_report(report: Mapping[str, Any], user: Mapping[str, Any], *, allow_scoped_review: bool = False) -> bool:
    if is_elevated_user(user):
        return True
    if report.get("user_id") == user.get("id"):
        return True
    if allow_scoped_review and normalize_role(user.get("role")) in SCOPED_REVIEW_ROLES:
        return bool(report.get("service_center") and report.get("service_center") == user_scope_center(user))
    return False


def create_access_token(payload: dict[str, Any]) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes)
    data = {**payload, "exp": expires}
    return jwt.encode(data, settings.jwt_secret, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chybí přihlášení.")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Neplatné přihlášení.")

    result = await session.execute(
        text(
            """
            SELECT id, username, email, role, full_name, active, department_name, scope_department
            FROM users
            WHERE id = :id AND active = TRUE AND archived_at IS NULL
            """
        ),
        {"id": user_id},
    )
    user = result.mappings().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Uživatel nenalezen.")
    user_dict = dict(user)
    request.state.user = user_dict
    return user_dict


def require_roles(*roles: str):
    allowed = set(roles)

    async def dependency(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if user["role"] not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nemáte oprávnění k této akci.")
        return user

    return dependency
