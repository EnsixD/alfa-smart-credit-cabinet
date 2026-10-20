"""Очистка тестовых данных: удаляет заявки и всё, что с ними связано.

Аккаунты, компании, продукты и новости остаются.
Запуск: docker compose exec api python -m app.reset_data
"""
from sqlalchemy import text

from .db import SessionLocal

TABLES = [
    "application_events",
    "checks",
    "tasks",
    "documents",
    "messages",
    "notifications",
    "jobs",
    "loans",
    "applications",
]


def reset() -> None:
    with SessionLocal() as db:
        before = {t: db.execute(text(f"SELECT count(*) FROM {t}")).scalar() for t in TABLES}
        if db.bind.dialect.name == "postgresql":
            db.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY"))
        else:
            for t in TABLES:
                db.execute(text(f"DELETE FROM {t}"))
        db.commit()
    for t, n in before.items():
        print(f"{t}: удалено {n}")


if __name__ == "__main__":
    reset()
