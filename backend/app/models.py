from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    inn: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    ogrn: Mapped[str] = mapped_column(String(15))
    name: Mapped[str] = mapped_column(String(255))
    legal_form: Mapped[str] = mapped_column(String(10))  # ИП / ООО
    okved: Mapped[str] = mapped_column(String(10))
    okved_name: Mapped[str] = mapped_column(String(255))
    industry: Mapped[str] = mapped_column(String(32))  # тег отрасли для ленты и скоринга
    reg_date: Mapped[date] = mapped_column(Date)
    address: Mapped[str] = mapped_column(String(255))
    region: Mapped[str] = mapped_column(String(64))
    director: Mapped[str] = mapped_column(String(128))
    segment: Mapped[str] = mapped_column(String(16))  # micro / small
    # «Внутренние данные банка» — обороты по расчётному счёту клиента в банке
    annual_revenue: Mapped[float] = mapped_column(Float, default=0)
    annual_expenses: Mapped[float] = mapped_column(Float, default=0)
    monthly_debt_payments: Mapped[float] = mapped_column(Float, default=0)
    account_turnover_month: Mapped[float] = mapped_column(Float, default=0)
    balance: Mapped[float] = mapped_column(Float, default=0)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16))  # CLIENT / UNDERWRITER / APPROVER / ADMIN
    full_name: Mapped[str] = mapped_column(String(128))
    position: Mapped[str] = mapped_column(String(64), default="")
    can_sign: Mapped[bool] = mapped_column(Boolean, default=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    company: Mapped[Company | None] = relationship()


class Product(Base):
    __tablename__ = "products"
    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    short: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    min_amount: Mapped[float] = mapped_column(Float)
    max_amount: Mapped[float] = mapped_column(Float)
    min_term: Mapped[int] = mapped_column(Integer)
    max_term: Mapped[int] = mapped_column(Integer)
    base_rate: Mapped[float] = mapped_column(Float)
    auto_limit: Mapped[float] = mapped_column(Float)  # до этой суммы допускается автоматическое решение
    collateral_required: Mapped[bool] = mapped_column(Boolean, default=False)
    min_business_age_months: Mapped[int] = mapped_column(Integer, default=3)
    purposes: Mapped[list] = mapped_column(JSON, default=list)
    required_docs: Mapped[list] = mapped_column(JSON, default=list)
    decision_time: Mapped[str] = mapped_column(String(64), default="")


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    product_code: Mapped[str | None] = mapped_column(ForeignKey("products.code"), nullable=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(32), nullable=True)
    purpose_text: Mapped[str] = mapped_column(Text, default="")
    financials: Mapped[dict] = mapped_column(JSON, default=dict)
    collateral: Mapped[dict] = mapped_column(JSON, default=dict)
    contact: Mapped[dict] = mapped_column(JSON, default=dict)
    consents: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), index=True, default="DRAFT")
    score: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    decision: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    offer: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    signing: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    idempotency_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    company: Mapped[Company] = relationship()
    product: Mapped[Product | None] = relationship()
    events: Mapped[list["Event"]] = relationship(order_by="Event.id", back_populates="application")
    checks: Mapped[list["Check"]] = relationship(order_by="Check.id")
    tasks: Mapped[list["Task"]] = relationship(order_by="Task.id")
    documents: Mapped[list["Document"]] = relationship(order_by="Document.id")
    messages: Mapped[list["Message"]] = relationship(order_by="Message.id")


class Event(Base):
    """Журнал событий заявки: аудит + источник для realtime-обновлений (SSE)."""

    __tablename__ = "application_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    type: Mapped[str] = mapped_column(String(32))  # STATUS / CHECK / MESSAGE / TASK / DOCUMENT / ACTION
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    actor: Mapped[str] = mapped_column(String(128))
    message: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    application: Mapped[Application] = relationship(back_populates="events")


class Check(Base):
    __tablename__ = "checks"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    source: Mapped[str] = mapped_column(String(32))  # EGRUL / FNS / BKI / INTERNAL / COMPLETENESS
    status: Mapped[str] = mapped_column(String(16))  # OK / WARN / FAIL / UNAVAILABLE
    summary: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Task(Base):
    """Задача клиенту (дозагрузить документ / уточнить данные) — заменяет письма и звонки."""

    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # DOCUMENT / INFO
    doc_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="OPEN")  # OPEN / DONE
    answer: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(String(128), default="Система")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(32))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(128))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    extracted: Mapped[dict] = mapped_column(JSON, default=dict)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    author_role: Mapped[str] = mapped_column(String(16))
    author_name: Mapped[str] = mapped_column(String(128))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    application_id: Mapped[int | None] = mapped_column(ForeignKey("applications.id"), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Job(Base):
    """Очередь задач конвейера в БД (SELECT ... FOR UPDATE SKIP LOCKED в Postgres)."""

    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))  # PROCESS / DISBURSE
    status: Mapped[str] = mapped_column(String(16), default="PENDING", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str] = mapped_column(Text, default="")
    run_after: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Loan(Base):
    __tablename__ = "loans"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), unique=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    contract_number: Mapped[str] = mapped_column(String(32))
    amount: Mapped[float] = mapped_column(Float)
    rate: Mapped[float] = mapped_column(Float)
    term_months: Mapped[int] = mapped_column(Integer)
    monthly_payment: Mapped[float] = mapped_column(Float)
    schedule: Mapped[list] = mapped_column(JSON, default=list)
    disbursed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class News(Base):
    __tablename__ = "news"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32))
    tags: Mapped[list] = mapped_column(JSON, default=list)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
