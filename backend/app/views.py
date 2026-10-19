"""Представления сущностей для API. Клиенту — понятные формулировки, банку — полные данные."""

from datetime import datetime, timezone

from . import state_machine as sm
from .models import Application, Company, Loan, Product, User
from .services import DOC_TYPES, PURPOSES


def iso(d: datetime | None) -> str | None:
    """SQLite теряет часовой пояс — время в БД всегда UTC."""
    if d is None:
        return None
    return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).isoformat()


def user_view(u: User) -> dict:
    return {"id": u.id, "login": u.login, "role": u.role, "full_name": u.full_name, "position": u.position,
            "can_sign": u.can_sign, "company": company_view(u.company) if u.company else None}


def company_view(c: Company) -> dict:
    return {"id": c.id, "inn": c.inn, "ogrn": c.ogrn, "name": c.name, "legal_form": c.legal_form, "okved": c.okved,
            "okved_name": c.okved_name, "industry": c.industry, "reg_date": c.reg_date.isoformat(), "address": c.address,
            "region": c.region, "director": c.director, "segment": c.segment, "balance": round(c.balance, 2),
            "annual_revenue": c.annual_revenue, "annual_expenses": c.annual_expenses,
            "monthly_debt_payments": c.monthly_debt_payments, "account_turnover_month": c.account_turnover_month}


def product_view(p: Product) -> dict:
    return {"code": p.code, "name": p.name, "short": p.short, "description": p.description,
            "min_amount": p.min_amount, "max_amount": p.max_amount, "min_term": p.min_term, "max_term": p.max_term,
            "base_rate": p.base_rate, "collateral_required": p.collateral_required,
            "min_business_age_months": p.min_business_age_months, "purposes": p.purposes,
            "required_docs": [{"type": d, "title": DOC_TYPES[d]} for d in p.required_docs],
            "decision_time": p.decision_time}


def loan_view(l: Loan) -> dict:
    return {"id": l.id, "application_id": l.application_id, "contract_number": l.contract_number, "amount": l.amount,
            "rate": l.rate, "term_months": l.term_months, "monthly_payment": l.monthly_payment,
            "schedule": l.schedule, "disbursed_at": iso(l.disbursed_at)}


def status_view(status: str) -> dict:
    title, hint = sm.LABELS[status]
    return {"code": status, "title": title, "hint": hint, "stage": sm.STAGE_OF[status], "stages": sm.STAGES,
            "final": status in sm.FINAL}


def application_view(a: Application, bank: bool = False, short: bool = False) -> dict:
    v = {
        "id": a.id, "number": a.number, "status": status_view(a.status), "version": a.version,
        "product_code": a.product_code, "product_name": a.product.name if a.product else None,
        "amount": a.amount, "term_months": a.term_months, "purpose": a.purpose,
        "purpose_title": PURPOSES.get(a.purpose or "", ""), "company_name": a.company.name,
        "created_at": iso(a.created_at), "updated_at": iso(a.updated_at) if a.updated_at else None,
        "submitted_at": iso(a.submitted_at) if a.submitted_at else None,
        "open_tasks": sum(1 for t in a.tasks if t.status == "OPEN"),
    }
    if bank:
        v |= {"grade": (a.score or {}).get("grade"), "points": (a.score or {}).get("points"),
              "assigned_to": a.assigned_to, "inn": a.company.inn, "industry": a.company.industry}
    if short:
        return v
    decision = a.decision or {}
    v |= {
        "purpose_text": a.purpose_text, "financials": a.financials, "collateral": a.collateral, "contact": a.contact,
        "consents": a.consents, "offer": a.offer,
        "signing": {k: x for k, x in (a.signing or {}).items() if bank or k != "code_hash"} if a.signing else None,
        "decision": {"outcome": decision.get("outcome"), "reasons": decision.get("reasons", []),
                     "recommendations": decision.get("recommendations", []), "by": decision.get("by"),
                     "comment": decision.get("comment")} if decision else None,
        "company": company_view(a.company),
        "product": product_view(a.product) if a.product else None,
        "tasks": [{"id": t.id, "kind": t.kind, "doc_type": t.doc_type, "title": t.title, "description": t.description,
                   "status": t.status, "answer": t.answer, "created_by": t.created_by,
                   "created_at": iso(t.created_at)} for t in a.tasks],
        "documents": [{"id": d.id, "doc_type": d.doc_type, "doc_title": DOC_TYPES.get(d.doc_type, d.doc_type),
                       "filename": d.filename, "size": d.size, "extracted": d.extracted,
                       "uploaded_at": iso(d.uploaded_at)} for d in a.documents],
        "messages": [{"id": m.id, "author_role": m.author_role, "author_name": m.author_name, "text": m.text,
                      "created_at": iso(m.created_at)} for m in a.messages],
        "timeline": [{"id": e.id, "type": e.type, "to_status": e.to_status,
                      "title": sm.LABELS[e.to_status][0] if e.to_status else e.message,
                      "message": e.message, "actor": e.actor if bank or e.type != "CHECK" else "Банк",
                      "created_at": iso(e.created_at)}
                     for e in a.events if bank or e.type in ("STATUS", "DOCUMENT", "TASK")],
        # клиенту — человеческая сводка проверок без сырых ответов источников
        "checks": [{"source": c.source, "status": c.status, "summary": c.summary, "created_at": iso(c.created_at),
                    **({"payload": c.payload} if bank else {})} for c in a.checks],
    }
    if bank:
        v["score"] = a.score
        v["decision_full"] = a.decision
    else:
        # клиенту показываем, какие факторы помогли и какие помешали, без внутренних баллов
        f = (a.score or {}).get("factors", [])
        v["score_explained"] = {"grade": (a.score or {}).get("grade"),
                                "positive": [x["label"] for x in f if x["points"] > 0][-4:][::-1],
                                "negative": [x["label"] for x in f if x["points"] < 0][:4]} if a.score else None
    return v
