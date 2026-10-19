"""Воркер конвейера: забирает задачи из таблицы jobs и выполняет шаги обработки заявок.

Запуск: python -m app.worker. Можно поднять несколько реплик — в Postgres задачи
забираются через SELECT ... FOR UPDATE SKIP LOCKED, поэтому одна задача не выполнится дважды.
"""

import logging
import time
from datetime import timedelta

from sqlalchemy import select

from . import pipeline
from .config import get_settings
from .db import SessionLocal, engine, init_db
from .models import Job, utcnow

log = logging.getLogger("worker")
MAX_ATTEMPTS = 3
HANDLERS = {"PROCESS": pipeline.process_application, "DISBURSE": pipeline.disburse_application}


def run_job(job_id: int) -> None:
    with SessionLocal() as db:
        job = db.get(Job, job_id)
        try:
            HANDLERS[job.kind](db, job.application_id)
            job = db.get(Job, job_id)
            job.status = "DONE"
        except Exception as e:  # noqa: BLE001 — любая ошибка шага не должна убивать воркер
            db.rollback()
            job = db.get(Job, job_id)
            job.attempts += 1
            job.last_error = repr(e)[:2000]
            job.status = "FAILED" if job.attempts >= MAX_ATTEMPTS else "PENDING"
            job.run_after = utcnow() + timedelta(seconds=5 * job.attempts)
            log.exception("job %s failed (attempt %s)", job_id, job.attempts)
        db.commit()


def claim_next() -> int | None:
    with SessionLocal() as db:
        q = select(Job).where(Job.status == "PENDING", Job.run_after <= utcnow()).order_by(Job.id).limit(1)
        if engine.dialect.name == "postgresql":
            q = q.with_for_update(skip_locked=True)
        job = db.scalars(q).first()
        if job is None:
            return None
        job.status = "RUNNING"
        db.commit()
        return job.id


def run_pending() -> int:
    """Выполнить все готовые задачи (используется и в тестах)."""
    n = 0
    while (job_id := claim_next()) is not None:
        run_job(job_id)
        n += 1
    return n


def main() -> None:
    logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","lvl":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}')
    init_db()
    log.info("worker started")
    interval = get_settings().worker_poll_interval_s
    while True:
        try:
            if run_pending() == 0:
                time.sleep(interval)
        except Exception:  # noqa: BLE001
            log.exception("worker loop error")
            time.sleep(interval * 3)


if __name__ == "__main__":
    main()
