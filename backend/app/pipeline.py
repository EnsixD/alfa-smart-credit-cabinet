"""Кредитный конвейер: проверка полноты → обогащение → скоринг → решение; а также выдача.

Шаги выполняет воркер (app.worker), каждый шаг фиксируется отдельной транзакцией,
поэтому клиент видит движение статуса в реальном времени.
"""

import logging
import time
from datetime import date

from sqlalchemy.orm import Session

from . import credit, integrations
from . import state_machine as sm
from .config import get_settings
from .models import Application, Check, Company, Loan, Product, Task
from .services import DOC_TYPES, add_event, notify, transition

log = logging.getLogger("pipeline")
SYSTEM = "Кредитный конвейер"


def _pause() -> None:
    delay = get_settings().pipeline_step_delay_s
    if delay:
        time.sleep(delay)


def _months_between(d: date, today: date | None = None) -> int:
    today = today or date.today()
    return (today.year - d.year) * 12 + today.month - d.month


def _check(db: Session, app: Application, source: str, status: str, summary: str, payload: dict | None = None) -> None:
    db.add(Check(application_id=app.id, source=source, status=status, summary=summary, payload=payload or {}))
    add_event(db, app, "CHECK", SYSTEM, f"{source}: {summary}", {"status": status})


def product_terms(p: Product) -> credit.ProductTerms:
    return credit.ProductTerms(p.code, p.name, p.min_amount, p.max_amount, p.min_term, p.max_term, p.base_rate,
                               p.auto_limit, p.collateral_required, p.min_business_age_months)


# ---------- шаг 1: полнота и корректность ----------

def completeness_issues(app: Application) -> tuple[list[str], list[str]]:
    """Возвращает (ошибки данных, недостающие типы документов)."""
    p = app.product
    errors = []
    if not p:
        return ["Не выбран кредитный продукт"], []
    if not app.amount or not (p.min_amount <= app.amount <= p.max_amount):
        errors.append(f"Сумма должна быть от {p.min_amount:_.0f} до {p.max_amount:_.0f} ₽".replace("_", " "))
    if not app.term_months or not (p.min_term <= app.term_months <= p.max_term):
        errors.append(f"Срок должен быть от {p.min_term} до {p.max_term} мес.")
    fin = app.financials or {}
    if not fin.get("annual_revenue") or fin.get("annual_expenses") in (None, ""):
        errors.append("Укажите годовую выручку и расходы")
    if not (app.consents or {}).get("bki"):
        errors.append("Нужно согласие на запрос в бюро кредитных историй")
    if p.collateral_required and not (app.collateral or {}).get("type"):
        errors.append("Опишите залоговое имущество")
    uploaded = {d.doc_type for d in app.documents}
    missing = [t for t in p.required_docs if t not in uploaded]
    return errors, missing


def step_data_check(db: Session, app: Application) -> bool:
    transition(db, app, sm.DATA_CHECK, SYSTEM)
    db.commit()
    _pause()
    errors, missing = completeness_issues(app)
    open_types = {t.doc_type for t in app.tasks if t.status == "OPEN"}
    if errors or missing:
        for t in missing:
            if t not in open_types:
                db.add(Task(application_id=app.id, kind="DOCUMENT", doc_type=t, title=f"Загрузите: {DOC_TYPES[t]}",
                            description="Документ обязателен для выбранного продукта."))
        for e in errors:
            db.add(Task(application_id=app.id, kind="INFO", title=e, description="Исправьте данные в заявке."))
        _check(db, app, "COMPLETENESS", "FAIL", "Не хватает данных: " + "; ".join(errors + [DOC_TYPES[m] for m in missing]))
        transition(db, app, sm.NEEDS_INFO, SYSTEM, "Не хватает данных или документов — см. задачи")
        db.commit()
        return False
    _check(db, app, "COMPLETENESS", "OK", "Анкета заполнена, обязательные документы загружены")
    db.commit()
    return True


# ---------- шаг 2: обогащение из внешних источников ----------

def step_enrichment(db: Session, app: Application) -> dict | None:
    transition(db, app, sm.ENRICHMENT, SYSTEM)
    db.commit()
    _pause()
    company: Company = app.company
    ctx: dict = {"bki_available": True, "fns_flags": [], "tax_debt": 0.0, "company_status": "ACTIVE"}

    try:
        eg = integrations.egrul(company.inn)
        if not eg.get("found", True):
            _check(db, app, "EGRUL", "FAIL", "Компания не найдена в реестре", eg)
            transition(db, app, sm.REJECTED, SYSTEM, "Компания не найдена в ЕГРЮЛ/ЕГРИП")
            app.decision = {"outcome": "REJECTED", "reasons": ["Компания не найдена в ЕГРЮЛ/ЕГРИП"], "stop_factors": ["Нет в реестре"]}
            db.commit()
            return None
        ctx["company_status"] = eg["status"]
        ctx["reg_date"] = eg["reg_date"]
        ok = eg["status"] == "ACTIVE"
        _check(db, app, "EGRUL", "OK" if ok else "FAIL",
               f"{eg['name']}, ОГРН {eg['ogrn']}, статус: {eg['status_text']}", eg)
    except integrations.IntegrationUnavailable as e:
        ctx["reg_date"] = company.reg_date.isoformat()
        ctx["fns_flags"].append("Реестр ЕГРЮЛ недоступен — данные взяты из профиля клиента")
        _check(db, app, "EGRUL", "UNAVAILABLE", "Сервис недоступен", {"error": str(e)})
    db.commit()
    _pause()

    try:
        fns = integrations.fns(company.inn)
        flags = []
        if fns.get("mass_address"):
            flags.append("Адрес массовой регистрации (ФНС)")
        if fns.get("disqualified_director"):
            flags.append("Руководитель дисквалифицирован (ФНС)")
        ctx["fns_flags"] += flags
        ctx["tax_debt"] = float(fns.get("tax_debt", 0))
        status = "WARN" if flags or ctx["tax_debt"] > 0 else "OK"
        _check(db, app, "FNS", status,
               f"Сотрудников: {fns.get('employees')}, режим: {fns.get('tax_regime')}, налоговый долг: {ctx['tax_debt']:_.0f} ₽".replace("_", " ")
               + (f". Риски: {', '.join(flags)}" if flags else ""), fns)
    except integrations.IntegrationUnavailable as e:
        ctx["fns_flags"].append("Сервис ФНС недоступен — нужна ручная проверка")
        _check(db, app, "FNS", "UNAVAILABLE", "Сервис недоступен", {"error": str(e)})
    db.commit()
    _pause()

    try:
        bki = integrations.bki(company.inn)
        ctx["bki"] = bki
        status = "FAIL" if bki["current_overdue_days"] > 30 else "WARN" if bki["overdue_12m"] else "OK"
        _check(db, app, "BKI", status,
               f"История {bki['history_months']} мес., активных кредитов: {len(bki['active_loans'])}, "
               f"просрочек за год: {bki['overdue_12m']}, текущая просрочка: {bki['current_overdue_days']} дн.", bki)
    except integrations.IntegrationUnavailable as e:
        ctx["bki_available"] = False
        _check(db, app, "BKI", "UNAVAILABLE", "Бюро кредитных историй недоступно", {"error": str(e)})

    internal = {"annual_turnover": company.account_turnover_month * 12, "monthly_debt_payments": company.monthly_debt_payments}
    declared = float(app.financials.get("annual_revenue") or 0)
    diff = abs(declared - internal["annual_turnover"]) / declared if declared and internal["annual_turnover"] else 0
    if internal["annual_turnover"] and diff > 0.3:
        ctx["fns_flags"].append("Заявленная выручка расходится с оборотами по счёту более чем на 30%")
    _check(db, app, "INTERNAL", "WARN" if diff > 0.3 else "OK",
           f"Обороты по счёту в банке: {internal['annual_turnover']:_.0f} ₽/год".replace("_", " ")
           + (f"; расхождение с анкетой {diff:.0%}" if diff > 0.3 else ""), internal)
    db.commit()
    return ctx


# ---------- шаг 3–4: скоринг и решение ----------

def build_features(app: Application, ctx: dict, rate: float) -> credit.Features:
    company = app.company
    fin = app.financials or {}
    bki = ctx.get("bki") or {}
    reg = date.fromisoformat(ctx.get("reg_date") or company.reg_date.isoformat())
    bki_debt = sum(x.get("monthly_payment", 0) for x in bki.get("active_loans", []))
    return credit.Features(
        business_age_months=_months_between(reg),
        annual_revenue=float(fin.get("annual_revenue") or 0),
        annual_expenses=float(fin.get("annual_expenses") or 0),
        prev_year_revenue=float(fin["prev_year_revenue"]) if fin.get("prev_year_revenue") else None,
        monthly_debt_payments=max(float(fin.get("monthly_debt_payments") or 0), bki_debt),
        amount=float(app.amount), term_months=int(app.term_months), rate=rate,
        industry=company.industry, bank_client=company.account_turnover_month > 0,
        bki_available=ctx["bki_available"],
        bki_overdue_12m=bki.get("overdue_12m", 0), bki_history_months=bki.get("history_months", 0),
        bki_current_overdue_days=bki.get("current_overdue_days", 0),
    )


def step_score_and_decide(db: Session, app: Application, ctx: dict) -> None:
    rs = credit.load_ruleset()
    transition(db, app, sm.SCORING, SYSTEM)
    db.commit()
    _pause()
    feats = build_features(app, ctx, app.product.base_rate)
    sr = credit.score(feats, rs)
    app.score = sr.as_dict()
    add_event(db, app, "ACTION", SYSTEM, f"Скоринг: {sr.points} баллов, рейтинг {sr.grade}", {"grade": sr.grade})
    transition(db, app, sm.DECISION, SYSTEM)
    db.commit()
    _pause()

    alts = [product_terms(p) for p in db.query(Product).order_by(Product.base_rate).all()]
    inp = credit.DecisionInput(features=feats, product=product_terms(app.product), alternatives=alts,
                               company_status=ctx["company_status"], fns_flags=ctx["fns_flags"],
                               tax_debt=ctx["tax_debt"], has_collateral=bool((app.collateral or {}).get("type")))
    d = credit.decide(inp, sr, rs)
    app.decision = d.as_dict() | {"ruleset_version": rs["version"], "by": SYSTEM}
    app.offer = d.offer
    msg = "; ".join(d.reasons)
    if d.outcome == "MANUAL_REVIEW":
        transition(db, app, sm.MANUAL_REVIEW, SYSTEM, "Заявка передана кредитному специалисту", {"reasons": d.reasons})
    else:
        transition(db, app, d.outcome, SYSTEM, msg, {"reasons": d.reasons})
    db.commit()


def process_application(db: Session, app_id: int) -> None:
    app = db.get(Application, app_id)
    if app is None or app.status != sm.SUBMITTED:
        log.info("skip application %s in status %s", app_id, app and app.status)
        return
    if not step_data_check(db, app):
        return
    ctx = step_enrichment(db, app)
    if ctx is None:
        return
    if ctx["company_status"] != "ACTIVE":
        app.decision = {"outcome": "REJECTED", "reasons": ["Компания в процессе ликвидации"],
                        "stop_factors": ["Статус в ЕГРЮЛ: ликвидация"], "recommendations": []}
        transition(db, app, sm.REJECTED, SYSTEM, "Компания в процессе ликвидации (ЕГРЮЛ)")
        db.commit()
        return
    step_score_and_decide(db, app, ctx)


def disburse_application(db: Session, app_id: int) -> None:
    app = db.get(Application, app_id)
    if app is None or app.status != sm.DISBURSING:
        return
    _pause()
    offer = app.offer
    res = integrations.disburse(app.company.inn, offer["amount"], app.number)
    loan = Loan(application_id=app.id, company_id=app.company_id, contract_number=app.signing["contract_number"],
                amount=offer["amount"], rate=offer["rate"], term_months=offer["term_months"],
                monthly_payment=offer["monthly_payment"],
                schedule=credit.schedule(offer["amount"], offer["rate"], offer["term_months"]))
    db.add(loan)
    app.company.balance += offer["amount"]
    transition(db, app, sm.DISBURSED, SYSTEM, f"{offer['amount']:_.0f} ₽ зачислены на расчётный счёт".replace("_", " "),
               {"payment_id": res.get("payment_id")})
    db.commit()
