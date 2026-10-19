"""Ассистент клиента: объясняет продукты, термины и статус заявки простыми словами.

Если LLM_ENABLED=true и доступен Ollama — ответ генерирует open-weights модель (по умолчанию Qwen2.5),
получая в контекст только данные этой компании. Иначе работает детерминированный режим на правилах,
поэтому основной сценарий от LLM не зависит.
"""

import logging

import httpx

from . import state_machine as sm
from .config import get_settings
from .models import Application, Product

log = logging.getLogger("assistant")

GLOSSARY = {
    "овердрафт": "Овердрафт — возможность уйти в минус по расчётному счёту в пределах лимита. Удобен для кассовых разрывов: проценты платите только за дни, когда пользуетесь деньгами.",
    "залог": "Залог — имущество (оборудование, недвижимость, транспорт), которое обеспечивает кредит. С залогом банк может дать больше и дешевле.",
    "dscr": "DSCR — во сколько раз денежный поток бизнеса превышает платежи по всем кредитам. Банку комфортно, когда он не ниже 1,25.",
    "аннуитет": "Аннуитетный платёж — одинаковый ежемесячный платёж на весь срок: в начале в нём больше процентов, в конце — основного долга.",
    "бки": "Бюро кредитных историй хранит сведения о ваших кредитах и платежах. Запрос делается только с вашего согласия и не ухудшает историю.",
    "скоринг": "Скоринг — автоматическая оценка риска по финансам, кредитной истории и параметрам заявки. Это не окончательное решение: банк учитывает ещё условия продукта и проверки.",
    "встречн": "Встречное предложение — банк готов дать деньги, но на других условиях: меньшую сумму, больший срок или другой продукт. Его можно принять или отказаться.",
    "ставк": "Ставка зависит от продукта и оценки риска: чем стабильнее финансы и чище кредитная история, тем ниже надбавка.",
}


def _context(app: Application | None, products: list[Product]) -> str:
    lines = ["Продукты банка:"] + [
        f"- {p.name}: {p.min_amount:_.0f}–{p.max_amount:_.0f} ₽, {p.min_term}–{p.max_term} мес., от {p.base_rate}% годовых. {p.short}"
        for p in products]
    if app:
        lines.append(f"Заявка {app.number}: статус «{sm.LABELS[app.status][0]}» — {sm.LABELS[app.status][1]}")
        if app.decision:
            lines.append("Причины решения: " + "; ".join(app.decision.get("reasons", [])))
            if app.decision.get("recommendations"):
                lines.append("Рекомендации: " + "; ".join(app.decision["recommendations"]))
        if app.offer:
            o = app.offer
            lines.append(f"Предложение: {o['product_name']}, {o['amount']:_.0f} ₽ на {o['term_months']} мес. под {o['rate']}%, платёж {o['monthly_payment']:_.0f} ₽/мес.")
        open_tasks = [t.title for t in app.tasks if t.status == "OPEN"]
        if open_tasks:
            lines.append("Открытые задачи: " + "; ".join(open_tasks))
    return "\n".join(lines).replace("_", " ")


def _rule_based(question: str, app: Application | None, products: list[Product]) -> str:
    q = question.lower()
    if app and any(w in q for w in ("статус", "заявк", "что происходит", "почему", "отказ", "когда", "что делать", "дальше")):
        title, hint = sm.LABELS[app.status]
        parts = [f"Заявка {app.number} сейчас в статусе «{title}». {hint}"]
        if app.decision and app.decision.get("reasons"):
            parts.append("Основные причины: " + "; ".join(app.decision["reasons"]) + ".")
        if app.decision and app.decision.get("recommendations"):
            parts.append("Что можно сделать: " + "; ".join(app.decision["recommendations"]) + ".")
        tasks = [t.title for t in app.tasks if t.status == "OPEN"]
        if tasks:
            parts.append("Чтобы продолжить, выполните задачи: " + "; ".join(tasks) + ".")
        return " ".join(parts)
    for key, text in GLOSSARY.items():
        if key in q:
            return text
    if any(w in q for w in ("какой", "подобрать", "выбрать", "подходит", "кредит", "продукт", "нужн")):
        hints = {"разрыв": "OVERDRAFT", "оборуд": "INVEST", "транспорт": "INVEST", "товар": "EXPRESS",
                 "закуп": "EXPRESS", "развит": "GROWTH", "карт": "CARD"}
        code = next((c for k, c in hints.items() if k in q), None)
        p = next((p for p in products if p.code == code), None)
        if p:
            return f"Под вашу задачу обычно подходит «{p.name}»: {p.short} Точнее подберёт мастер «Новая заявка» — он учитывает данные вашей компании."
        return "Начните с мастера «Новая заявка»: укажите, на что нужны деньги, сумму и срок — мы покажем подходящие продукты, платёж и шанс одобрения ещё до подачи."
    return ("Я помогаю с выбором кредита, терминами и статусом заявки. Спросите, например: «Что такое овердрафт?», "
            "«Почему мне предложили другие условия?» или «Что сейчас с моей заявкой?»")


def answer(question: str, app: Application | None, products: list[Product]) -> dict:
    s = get_settings()
    if s.llm_enabled:
        try:
            r = httpx.post(f"{s.llm_url}/api/chat", timeout=60, json={
                "model": s.llm_model, "stream": False, "options": {"temperature": 0.2},
                "messages": [
                    {"role": "system", "content": "Ты помощник предпринимателя в кредитном кабинете банка. Отвечай по-русски, "
                     "кратко (до 5 предложений), простыми словами, без обещаний одобрения. Используй только факты из контекста; "
                     "если данных нет — скажи об этом.\n\nКонтекст:\n" + _context(app, products)},
                    {"role": "user", "content": question}]})
            r.raise_for_status()
            return {"answer": r.json()["message"]["content"].strip(), "mode": f"llm:{s.llm_model}"}
        except Exception as e:  # noqa: BLE001 — при недоступности модели деградируем к правилам
            log.warning("LLM unavailable, fallback to rules: %s", e)
    return {"answer": _rule_based(question, app, products), "mode": "rules"}
