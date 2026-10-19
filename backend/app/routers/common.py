from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import credit, integrations
from ..assistant import answer
from ..db import get_db
from ..models import Application, Loan, Notification, Product, User
from ..news import personalized_feed
from ..security import create_token, current_user, require_client, verify_password
from ..services import PURPOSES
from ..views import iso, company_view, loan_view, product_view, user_view

router = APIRouter(prefix="/api")


class LoginIn(BaseModel):
    login: str
    password: str


@router.post("/auth/login", tags=["auth"], summary="Вход по логину и паролю, выдаёт JWT")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.login == body.login).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")
    return {"token": create_token(user), "user": user_view(user)}


@router.get("/auth/me", tags=["auth"])
def me(user: User = Depends(current_user)):
    return user_view(user)


@router.get("/catalog/purposes", tags=["catalog"])
def purposes():
    return [{"code": k, "title": v} for k, v in PURPOSES.items()]


@router.get("/catalog/products", tags=["catalog"])
def products(db: Session = Depends(get_db)):
    return [product_view(p) for p in db.query(Product).order_by(Product.base_rate).all()]


class RecommendIn(BaseModel):
    purpose: str
    amount: float = Field(gt=0)
    term_months: int = Field(gt=0, le=120)


@router.post("/catalog/recommend", tags=["catalog"],
             summary="Подбор продуктов под цель + предварительная оценка (без запроса в БКИ)")
def recommend(body: RecommendIn, user: User = Depends(require_client), db: Session = Depends(get_db)):
    c = user.company
    age = (date.today().year - c.reg_date.year) * 12 + date.today().month - c.reg_date.month
    result = []
    for p in db.query(Product).all():
        amount = min(max(body.amount, p.min_amount), p.max_amount)
        term = min(max(body.term_months, p.min_term), p.max_term)
        f = credit.Features(business_age_months=age, annual_revenue=c.annual_revenue or c.account_turnover_month * 12,
                            annual_expenses=c.annual_expenses, prev_year_revenue=None,
                            monthly_debt_payments=c.monthly_debt_payments, amount=amount, term_months=term,
                            rate=p.base_rate, industry=c.industry, bank_client=c.account_turnover_month > 0,
                            bki_available=False)
        sr = credit.score(f)
        chance = {"A": "высокий", "B": "высокий", "C": "средний", "D": "низкий", "E": "низкий"}[sr.grade]
        notes, fit = [], 0
        if body.purpose in p.purposes:
            fit += 50
        else:
            notes.append("Продукт обычно используют для других целей")
        if amount != body.amount:
            notes.append(f"Сумма скорректирована под лимиты продукта: {amount:_.0f} ₽".replace("_", " "))
            fit -= 20
        if term != body.term_months:
            notes.append(f"Срок скорректирован: {term} мес.")
            fit -= 10
        if age < p.min_business_age_months:
            notes.append(f"Нужно, чтобы бизнесу было не меньше {p.min_business_age_months} мес.")
            chance, fit = "недоступен", fit - 100
        if p.collateral_required:
            notes.append("Нужен залог")
        fit += {"A": 30, "B": 25, "C": 10}.get(sr.grade, 0)
        pay = credit.annuity_payment(amount, p.base_rate, term)
        result.append({"product": product_view(p), "amount": amount, "term_months": term, "rate_from": p.base_rate,
                       "monthly_payment": round(pay, 2), "chance": chance, "fit": fit, "notes": notes,
                       "eligible": age >= p.min_business_age_months})
    result.sort(key=lambda x: -x["fit"])
    for i, r in enumerate(result):
        r["recommended"] = i < 2 and r["eligible"] and r["fit"] > 40
    return result


@router.get("/company", tags=["company"], summary="Профиль компании клиента, баланс и действующие кредиты")
def company(user: User = Depends(require_client), db: Session = Depends(get_db)):
    loans = db.query(Loan).filter(Loan.company_id == user.company_id).all()
    return {"company": company_view(user.company), "loans": [loan_view(l) for l in loans]}


@router.get("/company/lookup/{inn}", tags=["company"], summary="Автозаполнение реквизитов из ЕГРЮЛ/ЕГРИП (mock)")
def lookup(inn: str, user: User = Depends(current_user)):
    try:
        data = integrations.egrul(inn)
    except integrations.IntegrationUnavailable:
        raise HTTPException(503, "Реестр временно недоступен, заполните данные вручную") from None
    if not data.get("found", True):
        raise HTTPException(404, "Компания с таким ИНН не найдена")
    return data


@router.get("/notifications", tags=["notifications"])
def notifications(user: User = Depends(require_client), db: Session = Depends(get_db)):
    rows = (db.query(Notification).filter(Notification.company_id == user.company_id)
            .order_by(Notification.id.desc()).limit(30).all())
    return [{"id": n.id, "text": n.text, "application_id": n.application_id, "read": n.read,
             "created_at": iso(n.created_at)} for n in rows]


@router.post("/notifications/read", tags=["notifications"])
def read_all(user: User = Depends(require_client), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.company_id == user.company_id).update({"read": True})
    db.commit()
    return {"ok": True}


@router.get("/news/feed", tags=["news"], summary="Персональная лента: зависит от отрасли, размера бизнеса и стадии заявки")
def feed(user: User = Depends(require_client), db: Session = Depends(get_db)):
    return personalized_feed(db, user.company)


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    application_id: int | None = None


@router.post("/assistant/ask", tags=["assistant"])
def ask(body: AskIn, user: User = Depends(require_client), db: Session = Depends(get_db)):
    app = None
    if body.application_id:
        app = db.get(Application, body.application_id)
        if not app or app.company_id != user.company_id:
            raise HTTPException(404, "Заявка не найдена")
    else:
        app = (db.query(Application).filter(Application.company_id == user.company_id)
               .order_by(Application.updated_at.desc()).first())
    return answer(body.question, app, db.query(Product).all())
