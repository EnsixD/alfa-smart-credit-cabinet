"""mock-gateway — симулятор внешних систем для автономного запуска прототипа.

Смоделированы (контракты упрощены, смысл интеграции сохранён):
  * ЕГРЮЛ/ЕГРИП           GET  /egrul/{inn}
  * ФНС «Прозрачный бизнес» GET  /fns/transparent-business/{inn}
  * Бюро кредитных историй  GET  /bki/report/{inn}
  * Платёжный шлюз          POST /payments/disburse
  * Управление сбоями       GET/POST /admin/faults  — чтобы показать отказоустойчивость конвейера

Для известных ИНН ответы берутся из fixtures.json, для прочих генерируются детерминированно из ИНН.
"""

import hashlib
import json
import time
import uuid
from datetime import date, timedelta
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="mock-gateway: ЕГРЮЛ / ФНС / БКИ / платежи", version="1.0.0")
FIX = json.loads((Path(__file__).parent / "fixtures.json").read_text(encoding="utf-8"))
FAULTS = {"EGRUL": "ok", "FNS": "ok", "BKI": "ok", "PAYMENTS": "ok"}
STATUS_TEXT = {"ACTIVE": "действующая", "LIQUIDATING": "в процессе ликвидации", "LIQUIDATED": "ликвидирована"}


def _fault(service: str) -> None:
    mode = FAULTS[service]
    if mode == "down":
        raise HTTPException(503, f"{service} temporarily unavailable")
    if mode == "slow":
        time.sleep(5)  # дольше таймаута клиента


def _rnd(inn: str, salt: str) -> int:
    return int(hashlib.sha256(f"{inn}:{salt}".encode()).hexdigest(), 16)


def _valid_inn(inn: str) -> bool:
    return inn.isdigit() and len(inn) in (10, 12)


@app.get("/egrul/{inn}")
def egrul(inn: str):
    _fault("EGRUL")
    if not _valid_inn(inn):
        raise HTTPException(404, "not found")
    if inn in FIX:
        d = FIX[inn]["egrul"]
    elif inn.startswith("000"):
        raise HTTPException(404, "not found")
    else:
        ip = len(inn) == 12
        d = {"name": f"{'ИП' if ip else 'ООО'} «Компания {inn[-4:]}»", "ogrn": str(10**14 + _rnd(inn, 'o') % 10**14)[:13 + ip * 2],
             "status": "ACTIVE", "reg_date": (date(2010, 1, 1) + timedelta(days=_rnd(inn, "d") % 5000)).isoformat(),
             "okved": "47.19", "okved_name": "Торговля розничная прочая", "address": "г. Москва",
             "director": "Иванов Иван Иванович", "founders": [], "legal_form": "ИП" if ip else "ООО"}
    return {"inn": inn, "found": True, "status_text": STATUS_TEXT[d["status"]], "source": "ЕГРЮЛ/ЕГРИП (mock)", **d}


@app.get("/fns/transparent-business/{inn}")
def fns(inn: str):
    _fault("FNS")
    if inn in FIX:
        d = FIX[inn]["fns"]
    else:
        d = {"employees": 3 + _rnd(inn, "e") % 40, "tax_regime": "УСН", "tax_debt": 0, "mass_address": False,
             "disqualified_director": False, "revenue_last_year": 10_000_000 + _rnd(inn, "r") % 50_000_000}
    return {"inn": inn, "source": "ФНС «Прозрачный бизнес» (mock)", **d}


@app.get("/bki/report/{inn}")
def bki(inn: str):
    _fault("BKI")
    if inn in FIX:
        d = FIX[inn]["bki"]
    else:
        d = {"history_months": _rnd(inn, "h") % 80, "overdue_12m": 0, "current_overdue_days": 0,
             "max_overdue_days": 0, "active_loans": []}
    total = sum(x["balance"] for x in d["active_loans"])
    return {"inn": inn, "source": "Бюро кредитных историй (mock)", "report_id": str(uuid.uuid4()), "total_debt": total, **d}


class Disburse(BaseModel):
    inn: str
    amount: float
    reference: str


@app.post("/payments/disburse")
def disburse(body: Disburse):
    _fault("PAYMENTS")
    return {"payment_id": f"PAY-{uuid.uuid4().hex[:10].upper()}", "status": "EXECUTED", "amount": body.amount,
            "reference": body.reference}


class Fault(BaseModel):
    service: str
    mode: str


@app.get("/admin/faults")
def get_faults():
    return FAULTS


@app.post("/admin/faults")
def set_fault(body: Fault):
    if body.service not in FAULTS or body.mode not in ("ok", "down", "slow"):
        raise HTTPException(422, "bad service or mode")
    FAULTS[body.service] = body.mode
    return FAULTS


@app.get("/health")
def health():
    return {"status": "ok"}
