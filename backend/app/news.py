"""Персонализированная лента: ранжирование материалов по профилю компании и состоянию её заявок.

Правила прозрачные: у каждой карточки есть пояснение «почему вы это видите».
"""

from datetime import date

from sqlalchemy.orm import Session

from . import state_machine as sm
from .models import Application, Company, News

STAGE_TAGS = {
    sm.DRAFT: "stage:draft", sm.NEEDS_INFO: "stage:needs_info", sm.MANUAL_REVIEW: "stage:review",
    sm.ESCALATED: "stage:review", sm.APPROVED: "stage:approved", sm.COUNTER_OFFER: "stage:counter",
    sm.SIGNING: "stage:approved", sm.DISBURSED: "stage:disbursed", sm.REJECTED: "stage:rejected",
}
INDUSTRY_TITLES = {"food": "общепит", "trade": "торговля", "manufacturing": "производство", "construction": "строительство",
                   "auto": "автосервис", "it": "IT", "transport": "перевозки"}


def personalized_feed(db: Session, company: Company, limit: int = 8) -> list[dict]:
    apps = db.query(Application).filter(Application.company_id == company.id).order_by(Application.updated_at.desc()).all()
    active = next((a for a in apps if a.status not in (sm.CANCELLED,)), None)
    age_months = (date.today().year - company.reg_date.year) * 12 + date.today().month - company.reg_date.month

    signals: dict[str, tuple[int, str]] = {
        f"industry:{company.industry}": (40, f"Ваша отрасль — {INDUSTRY_TITLES.get(company.industry, company.industry)}"),
        f"segment:{company.segment}": (15, "Подходит под размер вашего бизнеса"),
        f"form:{company.legal_form}": (10, f"Актуально для {company.legal_form}"),
        "all": (5, "Важно для всех предпринимателей"),
    }
    if age_months < 24:
        signals["young"] = (15, "Бизнесу меньше двух лет")
    if active:
        tag = STAGE_TAGS.get(active.status)
        if tag:
            signals[tag] = (60, f"Ваша заявка {active.number}: {sm.LABELS[active.status][0].lower()}")
        if active.product_code:
            signals[f"product:{active.product_code}"] = (20, f"Связано с продуктом «{active.product.name}»")
        if active.purpose:
            signals[f"purpose:{active.purpose}"] = (25, "Связано с целью вашего финансирования")
    else:
        signals["stage:none"] = (30, "У вас пока нет заявок — подскажем, с чего начать")

    ranked = []
    for n in db.query(News).all():
        hits = [signals[t] for t in n.tags if t in signals]
        if not hits:
            continue
        # свежесть: новость теряет 1 балл за каждые 3 дня
        days = (date.today() - n.published_at.date()).days
        score = sum(h[0] for h in hits) - days / 3
        reasons = [h[1] for h in sorted(hits, key=lambda h: -h[0])]
        ranked.append((score, n, reasons))
    ranked.sort(key=lambda x: -x[0])
    return [{"id": n.id, "title": n.title, "summary": n.summary, "body": n.body, "category": n.category,
             "published_at": n.published_at.date().isoformat(), "why": reasons[:2], "score": round(s, 1)}
            for s, n, reasons in ranked[:limit]]
