from collections import Counter
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import credit, integrations
from .. import state_machine as sm
from ..db import get_db
from ..models import Application, Document, Message, Product, Task, User
from ..security import require_bank
from ..services import DOC_TYPES, add_event, transition
from ..views import application_view

router = APIRouter(prefix="/api/bank", tags=["bank"])


def _get(db: Session, app_id: int) -> Application:
    app = db.get(Application, app_id)
    if not app or app.status == sm.DRAFT:
        raise HTTPException(404, "Заявка не найдена")
    return app


@router.get("/applications", summary="Очередь заявок с фильтрами")
def queue(status: str | None = None, product: str | None = None, q: str | None = None, mine: bool = False,
          user: User = Depends(require_bank), db: Session = Depends(get_db)):
    query = db.query(Application).filter(Application.status != sm.DRAFT)
    if status == "ACTION":
        allowed = [sm.MANUAL_REVIEW] + ([sm.ESCALATED] if user.role in ("APPROVER", "ADMIN") else [])
        query = query.filter(Application.status.in_(allowed))
    elif status:
        query = query.filter(Application.status.in_(status.split(",")))
    if product:
        query = query.filter(Application.product_code == product)
    if mine:
        query = query.filter(Application.assigned_to == user.id)
    apps = query.order_by(Application.updated_at.desc()).all()
    if q:
        ql = q.lower()
        apps = [a for a in apps if ql in a.number.lower() or ql in a.company.name.lower() or ql in a.company.inn]
    return [application_view(a, bank=True, short=True) for a in apps]


@router.get("/applications/{app_id}", summary="Полная карточка заявки для андеррайтера")
def detail(app_id: int, user: User = Depends(require_bank), db: Session = Depends(get_db)):
    return application_view(_get(db, app_id), bank=True)


@router.get("/applications/{app_id}/documents/{doc_id}")
def download(app_id: int, doc_id: int, user: User = Depends(require_bank), db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if not doc or doc.application_id != app_id:
        raise HTTPException(404)
    return Response(doc.data, media_type=doc.content_type,
                    headers={"Content-Disposition": f'attachment; filename="doc-{doc.id}"'})


@router.post("/applications/{app_id}/assign", summary="Взять заявку в работу")
def assign(app_id: int, user: User = Depends(require_bank), db: Session = Depends(get_db)):
    app = _get(db, app_id)
    app.assigned_to = user.id
    add_event(db, app, "ACTION", user.full_name, "Взял заявку в работу")
    db.commit()
    return application_view(app, bank=True)


class TaskIn(BaseModel):
    kind: Literal["DOCUMENT", "INFO"]
    doc_type: str | None = None
    title: str = Field(min_length=1, max_length=255)
    description: str = ""


class DecisionIn(BaseModel):
    action: Literal["approve", "reject", "counter", "request_info", "escalate"]
    comment: str = Field(min_length=3, max_length=4000, description="Обязательный комментарий для аудита")
    amount: float | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, gt=0, le=120)
    rate: float | None = Field(default=None, gt=0, lt=100)
    product_code: str | None = None
    tasks: list[TaskIn] = []


@router.post("/applications/{app_id}/decision", summary="Решение специалиста: одобрить / отказать / контрпредложение / запросить данные / эскалировать")
def decide(app_id: int, body: DecisionIn, user: User = Depends(require_bank), db: Session = Depends(get_db)):
    app = _get(db, app_id)
    if app.status == sm.ESCALATED and user.role not in ("APPROVER", "ADMIN"):
        raise HTTPException(403, "Решение по эскалированной заявке принимает руководитель")
    if app.status not in sm.BANK_REVIEW:
        raise HTTPException(409, "Заявка не ожидает решения специалиста")
    rs = credit.load_ruleset()
    actor = f"{user.full_name} ({user.position})"
    base = app.decision or {}

    def offer_from_body(default_reason: str) -> dict:
        p = db.get(Product, body.product_code or (app.offer or {}).get("product_code") or app.product_code)
        if not p:
            raise HTTPException(422, "Неизвестный продукт")
        amount = body.amount or (app.offer or {}).get("amount") or app.amount
        term = body.term_months or (app.offer or {}).get("term_months") or app.term_months
        rate = body.rate or (app.offer or {}).get("rate") or p.base_rate
        if not (p.min_amount <= amount <= p.max_amount and p.min_term <= term <= p.max_term):
            raise HTTPException(422, "Параметры вне лимитов продукта")
        return credit.make_offer(credit.ProductTerms(p.code, p.name, p.min_amount, p.max_amount, p.min_term, p.max_term,
                                                     p.base_rate, p.auto_limit, p.collateral_required,
                                                     p.min_business_age_months),
                                 amount, term, rate, rs["policy"]["offer_valid_days"])

    if body.action == "approve":
        offer = offer_from_body("")
        if user.role == "UNDERWRITER" and offer["amount"] > rs["policy"]["underwriter_limit"]:
            raise HTTPException(403, "Сумма выше ваших полномочий — эскалируйте заявку руководителю")
        changed = offer["amount"] != app.amount or offer["term_months"] != app.term_months or offer["product_code"] != app.product_code
        app.offer = offer
        app.decision = base | {"outcome": "COUNTER_OFFER" if changed else "APPROVED", "by": actor, "comment": body.comment,
                               "reasons": [body.comment]}
        transition(db, app, sm.COUNTER_OFFER if changed else sm.APPROVED, actor, body.comment)
    elif body.action == "counter":
        app.offer = offer_from_body("")
        app.decision = base | {"outcome": "COUNTER_OFFER", "by": actor, "comment": body.comment, "reasons": [body.comment]}
        transition(db, app, sm.COUNTER_OFFER, actor, body.comment)
    elif body.action == "reject":
        app.offer = None
        app.decision = base | {"outcome": "REJECTED", "by": actor, "comment": body.comment, "reasons": [body.comment]}
        transition(db, app, sm.REJECTED, actor, body.comment)
    elif body.action == "escalate":
        if app.status == sm.ESCALATED:
            raise HTTPException(409, "Заявка уже на согласовании")
        transition(db, app, sm.ESCALATED, actor, body.comment)
    elif body.action == "request_info":
        if not body.tasks:
            raise HTTPException(422, "Добавьте хотя бы один запрос клиенту")
        for t in body.tasks:
            if t.kind == "DOCUMENT" and t.doc_type not in DOC_TYPES:
                raise HTTPException(422, "Неизвестный тип документа")
            db.add(Task(application_id=app.id, kind=t.kind, doc_type=t.doc_type, title=t.title,
                        description=t.description, created_by=actor))
        transition(db, app, sm.NEEDS_INFO, actor, body.comment)
    app.assigned_to = app.assigned_to or user.id
    db.commit()
    return application_view(app, bank=True)


class BankMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.post("/applications/{app_id}/messages")
def message(app_id: int, body: BankMessageIn, user: User = Depends(require_bank), db: Session = Depends(get_db)):
    from ..services import notify
    app = _get(db, app_id)
    db.add(Message(application_id=app.id, author_role="BANK", author_name=f"{user.full_name}, {user.position}", text=body.text))
    add_event(db, app, "MESSAGE", user.full_name, "Сообщение от банка")
    notify(db, app, f"Заявка {app.number}: новое сообщение от банка")
    db.commit()
    return application_view(app, bank=True)


@router.get("/metrics", summary="Воронка конвейера и ключевые показатели")
def metrics(user: User = Depends(require_bank), db: Session = Depends(get_db)):
    apps = db.query(Application).filter(Application.status != sm.DRAFT).all()
    by_status = Counter(a.status for a in apps)
    decided = [a for a in apps if a.decided_at and a.submitted_at]
    auto = [a for a in decided if (a.decision or {}).get("by") == "Кредитный конвейер" and a.status != sm.REJECTED]
    tt = sorted((a.decided_at - a.submitted_at).total_seconds() for a in decided if a.decided_at >= a.submitted_at) if decided else []
    funnel = [
        ("Подано", len(apps)),
        ("Прошли проверку данных", sum(1 for a in apps if any(e.to_status == sm.ENRICHMENT for e in a.events))),
        ("Получили решение", len(decided)),
        ("Одобрено / предложение", sum(1 for a in apps if any(e.to_status in (sm.APPROVED, sm.COUNTER_OFFER) for e in a.events))),
        ("Подписано", sum(1 for a in apps if any(e.to_status == sm.DISBURSING for e in a.events))),
        ("Выдано", by_status.get(sm.DISBURSED, 0)),
    ]
    return {
        "funnel": [{"stage": s, "count": c} for s, c in funnel],
        "by_status": [{"status": s, "title": sm.LABELS[s][0], "count": c} for s, c in by_status.most_common()],
        "auto_decision_share": round(len(auto) / len(decided), 2) if decided else 0,
        "median_time_to_decision_s": tt[len(tt) // 2] if tt else None,
        "in_queue": by_status.get(sm.MANUAL_REVIEW, 0) + by_status.get(sm.ESCALATED, 0),
        "issued_amount": sum((a.offer or {}).get("amount", 0) for a in apps if a.status == sm.DISBURSED),
    }


@router.get("/ruleset", summary="Действующие правила скоринга и кредитной политики")
def ruleset(user: User = Depends(require_bank)):
    return credit.load_ruleset()


@router.get("/integrations", summary="Состояние смоделированных интеграций")
def get_faults(user: User = Depends(require_bank)):
    try:
        return integrations.faults()
    except integrations.IntegrationUnavailable:
        raise HTTPException(503, "mock-gateway недоступен") from None


class FaultIn(BaseModel):
    service: Literal["EGRUL", "FNS", "BKI", "PAYMENTS"]
    mode: Literal["ok", "down", "slow"]


@router.post("/integrations", summary="Симулировать сбой интеграции (для демонстрации отказоустойчивости)")
def set_fault(body: FaultIn, user: User = Depends(require_bank)):
    return integrations.set_fault(body.service, body.mode)
