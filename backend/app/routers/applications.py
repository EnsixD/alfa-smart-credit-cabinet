import asyncio
import json
import random
import re

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import state_machine as sm
from ..config import get_settings
from ..db import SessionLocal, get_db
from ..models import Application, Document, Event, Message, Product, Task, User, utcnow
from ..security import BANK_ROLES, require_client, user_from_query_token
from ..services import DOC_TYPES, PURPOSES, add_event, enqueue, next_number, transition
from ..views import application_view

router = APIRouter(prefix="/api/applications", tags=["applications"])
EDITABLE = {sm.DRAFT, sm.NEEDS_INFO}


def _own(db: Session, app_id: int, user: User) -> Application:
    app = db.get(Application, app_id)
    if not app or app.company_id != user.company_id:
        raise HTTPException(404, "Заявка не найдена")
    return app


def _run_inline(app: Application, kind: str) -> None:
    """Режим без воркера (тесты / локальный запуск): выполнить задачу сразу."""
    if get_settings().inline_pipeline:
        from ..worker import run_pending
        run_pending()


class ApplicationIn(BaseModel):
    product_code: str | None = None
    amount: float | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, gt=0, le=120)
    purpose: str | None = None
    purpose_text: str | None = None
    financials: dict | None = None
    collateral: dict | None = None
    contact: dict | None = None
    consents: dict | None = None
    version: int | None = Field(default=None, description="Для оптимистичной блокировки")


def _apply(app: Application, body: ApplicationIn, db: Session) -> None:
    data = body.model_dump(exclude_unset=True, exclude={"version"})
    if "product_code" in data and data["product_code"] and not db.get(Product, data["product_code"]):
        raise HTTPException(422, "Неизвестный продукт")
    if "purpose" in data and data["purpose"] and data["purpose"] not in PURPOSES:
        raise HTTPException(422, "Неизвестная цель")
    for k, v in data.items():
        setattr(app, k, v)


@router.get("", summary="Заявки компании клиента")
def list_apps(user: User = Depends(require_client), db: Session = Depends(get_db)):
    apps = db.query(Application).filter(Application.company_id == user.company_id).order_by(Application.id.desc()).all()
    return [application_view(a, short=True) for a in apps]


@router.post("", status_code=201, summary="Создать черновик заявки")
def create(body: ApplicationIn, user: User = Depends(require_client), db: Session = Depends(get_db)):
    c = user.company
    app = Application(number=next_number(db), company_id=c.id, created_by=user.id,
                      financials={"annual_revenue": c.annual_revenue, "annual_expenses": c.annual_expenses,
                                  "monthly_debt_payments": c.monthly_debt_payments},
                      contact={"name": user.full_name, "position": user.position})
    _apply(app, body, db)
    db.add(app)
    db.flush()
    add_event(db, app, "STATUS", user.full_name, "Черновик создан", to_status=sm.DRAFT)
    db.commit()
    return application_view(app)


@router.get("/{app_id}")
def get_app(app_id: int, user: User = Depends(require_client), db: Session = Depends(get_db)):
    return application_view(_own(db, app_id, user))


@router.patch("/{app_id}", summary="Автосохранение черновика / исправление данных по запросу банка")
def update(app_id: int, body: ApplicationIn, user: User = Depends(require_client), db: Session = Depends(get_db)):
    app = _own(db, app_id, user)
    if app.status not in EDITABLE:
        raise HTTPException(409, "Заявку нельзя изменить в текущем статусе")
    if body.version is not None and body.version != app.version:
        raise HTTPException(409, "Заявка изменилась в другой вкладке — обновите страницу")
    _apply(app, body, db)
    app.version += 1
    db.commit()
    return application_view(app)


@router.post("/{app_id}/submit", summary="Отправить заявку в банк (идемпотентно по Idempotency-Key)")
def submit(app_id: int, user: User = Depends(require_client), db: Session = Depends(get_db),
           idempotency_key: str | None = Header(default=None)):
    app = _own(db, app_id, user)
    if idempotency_key and app.idempotency_key == idempotency_key:
        return application_view(app)
    if app.status not in EDITABLE:
        raise HTTPException(409, "Заявка уже отправлена")
    if not app.product_code or not app.amount or not app.term_months:
        raise HTTPException(422, "Выберите продукт, сумму и срок")
    if app.status == sm.NEEDS_INFO:
        for t in app.tasks:
            if t.status == "OPEN" and t.kind == "INFO" and t.created_by == "Система":
                t.status = "DONE"  # системные замечания перепроверит конвейер
    transition(db, app, sm.SUBMITTED, user.full_name, "Заявка отправлена в банк")
    app.submitted_at = app.submitted_at or utcnow()
    app.idempotency_key = idempotency_key
    enqueue(db, app, "PROCESS")
    db.commit()
    _run_inline(app, "PROCESS")
    db.refresh(app)
    return application_view(app)


def _extract(data: bytes) -> dict:
    """Упрощённое «распознавание» документа: ищем ключевые показатели в текстовом слое."""
    text = data.decode("utf-8", errors="ignore")
    out = {}
    patterns = {"annual_revenue": r"[Вв]ыручка[^\d\n]{0,40}([\d\s]{4,})",
                "annual_expenses": r"[Рр]асходы[^\d\n]{0,40}([\d\s]{4,})",
                "prev_year_revenue": r"[Вв]ыручка за прошлый год[^\d\n]{0,20}([\d\s]{4,})"}
    for key, pat in patterns.items():
        m = re.search(pat, text)
        if m:
            out[key] = float(re.sub(r"\s", "", m.group(1)))
    return out


@router.post("/{app_id}/documents", status_code=201, summary="Загрузить документ (закрывает связанную задачу)")
async def upload(app_id: int, doc_type: str = Form(...), file: UploadFile = File(...),
                 user: User = Depends(require_client), db: Session = Depends(get_db)):
    app = _own(db, app_id, user)
    if app.status in sm.FINAL:
        raise HTTPException(409, "Заявка закрыта")
    if doc_type not in DOC_TYPES:
        raise HTTPException(422, "Неизвестный тип документа")
    data = await file.read()
    if len(data) > get_settings().max_upload_mb * 1024 * 1024:
        raise HTTPException(413, "Файл слишком большой")
    extracted = _extract(data)
    doc = Document(application_id=app.id, doc_type=doc_type, filename=file.filename or "file",
                   content_type=file.content_type or "application/octet-stream", size=len(data), data=data,
                   extracted=extracted)
    db.add(doc)
    for t in app.tasks:
        if t.status == "OPEN" and t.doc_type == doc_type:
            t.status = "DONE"
    add_event(db, app, "DOCUMENT", user.full_name, f"Загружен документ: {DOC_TYPES[doc_type]}")
    db.commit()
    return {"id": doc.id, "extracted": extracted}


@router.get("/{app_id}/documents/{doc_id}", summary="Скачать документ")
def download(app_id: int, doc_id: int, user: User = Depends(require_client), db: Session = Depends(get_db)):
    _own(db, app_id, user)
    doc = db.get(Document, doc_id)
    if not doc or doc.application_id != app_id:
        raise HTTPException(404)
    return Response(doc.data, media_type=doc.content_type,
                    headers={"Content-Disposition": f'attachment; filename="doc-{doc.id}"'})


class TaskAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=4000)


@router.post("/{app_id}/tasks/{task_id}/complete", summary="Ответить на запрос банка")
def complete_task(app_id: int, task_id: int, body: TaskAnswer, user: User = Depends(require_client),
                  db: Session = Depends(get_db)):
    app = _own(db, app_id, user)
    task = db.get(Task, task_id)
    if not task or task.application_id != app.id:
        raise HTTPException(404)
    task.status, task.answer = "DONE", body.answer
    add_event(db, app, "TASK", user.full_name, f"Ответ на запрос «{task.title}»: {body.answer}")
    db.commit()
    return application_view(app)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@router.post("/{app_id}/messages", summary="Сообщение в чат с банком (внутри продукта)")
def message(app_id: int, body: MessageIn, user: User = Depends(require_client), db: Session = Depends(get_db)):
    app = _own(db, app_id, user)
    db.add(Message(application_id=app.id, author_role="CLIENT", author_name=user.full_name, text=body.text))
    add_event(db, app, "MESSAGE", user.full_name, "Сообщение от клиента")
    db.commit()
    return application_view(app)


@router.post("/{app_id}/accept", summary="Принять предложение банка → подписание")
def accept(app_id: int, user: User = Depends(require_client), db: Session = Depends(get_db)):
    app = _own(db, app_id, user)
    if app.status not in (sm.APPROVED, sm.COUNTER_OFFER):
        raise HTTPException(409, "Нет активного предложения")
    o = app.offer
    app.signing = {
        "contract_number": f"КД-{app.number[3:]}",
        "code": f"{random.randint(0, 999999):06d}",
        "document": (f"Кредитный договор № КД-{app.number[3:]}. Заёмщик: {app.company.name}, ИНН {app.company.inn}. "
                     f"Продукт: {o['product_name']}. Сумма: {o['amount']:_.0f} ₽. Срок: {o['term_months']} мес. "
                     f"Ставка: {o['rate']}% годовых. Ежемесячный платёж: {o['monthly_payment']:_.0f} ₽.").replace("_", " "),
        "created_at": utcnow().isoformat(),
    }
    transition(db, app, sm.SIGNING, user.full_name, "Клиент принял условия")
    db.commit()
    return application_view(app)


class SignIn(BaseModel):
    code: str


@router.post("/{app_id}/sign", summary="Подписать договор (симуляция простой электронной подписи)")
def sign(app_id: int, body: SignIn, user: User = Depends(require_client), db: Session = Depends(get_db)):
    app = _own(db, app_id, user)
    if app.status != sm.SIGNING:
        raise HTTPException(409, "Договор не ожидает подписания")
    if not user.can_sign:
        raise HTTPException(403, "У вас нет права подписи. Договор подписывает руководитель компании")
    if body.code.strip() != app.signing["code"]:
        raise HTTPException(422, "Неверный код подтверждения")
    app.signing = app.signing | {"signed_by": user.full_name, "signed_at": utcnow().isoformat()}
    transition(db, app, sm.DISBURSING, user.full_name, "Договор подписан")
    enqueue(db, app, "DISBURSE")
    db.commit()
    _run_inline(app, "DISBURSE")
    db.refresh(app)
    return application_view(app)


@router.post("/{app_id}/cancel", summary="Отменить заявку / отказаться от предложения")
def cancel(app_id: int, user: User = Depends(require_client), db: Session = Depends(get_db)):
    app = _own(db, app_id, user)
    try:
        transition(db, app, sm.CANCELLED, user.full_name, "Отменена клиентом")
    except sm.TransitionError:
        raise HTTPException(409, "Заявку нельзя отменить на этом этапе") from None
    db.commit()
    return application_view(app)


@router.get("/{app_id}/stream", summary="SSE-поток событий заявки (статусы обновляются в реальном времени)")
async def stream(app_id: int, user: User = Depends(user_from_query_token), last_id: int = 0):
    with SessionLocal() as db:
        app = db.get(Application, app_id)
        if not app or (user.role not in BANK_ROLES and app.company_id != user.company_id):
            raise HTTPException(404)

    async def gen():
        cursor = last_id
        yield "retry: 3000\n\n"
        for _ in range(1800):  # ~30 минут, затем браузер переподключится сам
            with SessionLocal() as db:
                events = db.query(Event).filter(Event.application_id == app_id, Event.id > cursor).order_by(Event.id).all()
                status = db.get(Application, app_id).status if events else None
            for e in events:
                cursor = e.id
                data = {"id": e.id, "type": e.type, "to_status": e.to_status, "status": status, "message": e.message}
                yield f"id: {e.id}\nevent: update\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
            if not events:
                yield ": ping\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
