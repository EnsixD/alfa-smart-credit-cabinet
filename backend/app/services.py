"""Общие операции над заявкой: переходы статусов, события, уведомления, постановка задач в очередь."""

from datetime import date

from sqlalchemy.orm import Session

from . import state_machine as sm
from .models import Application, Event, Job, Notification, utcnow

DOC_TYPES = {
    "FIN_STATEMENTS": "Бухгалтерская отчётность за последний год",
    "BANK_STATEMENT": "Выписка по счёту в другом банке за 6 месяцев",
    "COLLATERAL_DOCS": "Документы на залоговое имущество",
    "TAX_RETURN": "Налоговая декларация",
    "OTHER": "Другой документ",
}

PURPOSES = {
    "cash_gap": "Закрыть кассовый разрыв",
    "working_capital": "Пополнить оборотные средства",
    "purchase": "Закупить товар или сырьё",
    "equipment": "Купить оборудование или транспорт",
    "real_estate": "Купить или отремонтировать помещение",
    "development": "Запустить новое направление",
}


def add_event(db: Session, app: Application, type_: str, actor: str, message: str = "", payload: dict | None = None,
              from_status: str | None = None, to_status: str | None = None) -> Event:
    ev = Event(application_id=app.id, type=type_, actor=actor, message=message, payload=payload or {},
               from_status=from_status, to_status=to_status)
    db.add(ev)
    return ev


def notify(db: Session, app: Application, text: str) -> None:
    db.add(Notification(company_id=app.company_id, application_id=app.id, text=text))


def transition(db: Session, app: Application, to: str, actor: str, message: str = "", payload: dict | None = None,
               notify_client: bool = True) -> None:
    sm.check_transition(app.status, to)
    src = app.status
    app.status = to
    app.version += 1
    app.updated_at = utcnow()
    if to in {sm.APPROVED, sm.COUNTER_OFFER, sm.REJECTED}:
        app.decided_at = utcnow()
    label = sm.LABELS[to][0]
    add_event(db, app, "STATUS", actor, message or label, payload, from_status=src, to_status=to)
    if notify_client and to not in {sm.SCORING, sm.DECISION, sm.SUBMITTED}:
        notify(db, app, f"Заявка {app.number}: {label}" + (f". {message}" if message and to != sm.ENRICHMENT else ""))


def enqueue(db: Session, app: Application, kind: str) -> Job:
    job = Job(application_id=app.id, kind=kind)
    db.add(job)
    return job


def next_number(db: Session) -> str:
    count = db.query(Application).count() + 1
    return f"CR-{date.today():%y%m}-{count:05d}"
