import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

BANK_ROLES = {"UNDERWRITER", "APPROVER", "ADMIN"}
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"pbkdf2${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    _, salt, digest = stored.split("$")
    calc = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return hmac.compare_digest(calc.hex(), digest)


def create_token(user: User) -> str:
    s = get_settings()
    payload = {"sub": str(user.id), "role": user.role, "exp": datetime.now(timezone.utc) + timedelta(minutes=s.jwt_ttl_minutes)}
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def _user_from_token(token: str | None, db: Session) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Требуется авторизация")
    try:
        data = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Сессия истекла, войдите снова") from None
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Пользователь не найден")
    return user


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)) -> User:
    return _user_from_token(cred.credentials if cred else None, db)


def user_from_query_token(token: str = Query(...), db: Session = Depends(get_db)) -> User:
    """EventSource не умеет передавать заголовки, поэтому для SSE токен идёт в query."""
    return _user_from_token(token, db)


def require_client(user: User = Depends(current_user)) -> User:
    if user.role != "CLIENT" or user.company_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только клиенту")
    return user


def require_bank(user: User = Depends(current_user)) -> User:
    if user.role not in BANK_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только сотрудникам банка")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступно только администратору")
    return user
