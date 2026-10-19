"""Скоринг (оценка риска) и кредитное решение (политика банка).

Скоринг отвечает на вопрос «насколько рискован заёмщик», решение — «что ему предложить».
Оба модуля — чистые функции без доступа к БД, поэтому легко тестируются и воспроизводятся.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import yaml

RULESET_PATH = Path(__file__).parent / "rules" / "ruleset.yaml"


def load_ruleset() -> dict:
    return yaml.safe_load(RULESET_PATH.read_text(encoding="utf-8"))


# ---------- финансовая математика ----------

def annuity_payment(amount: float, rate_pct: float, months: int) -> float:
    r = rate_pct / 100 / 12
    if r == 0:
        return amount / months
    return amount * r / (1 - (1 + r) ** -months)


def max_principal(payment: float, rate_pct: float, months: int) -> float:
    r = rate_pct / 100 / 12
    if payment <= 0:
        return 0.0
    return payment * months if r == 0 else payment * (1 - (1 + r) ** -months) / r


def schedule(amount: float, rate_pct: float, months: int, start: date | None = None) -> list[dict]:
    start = start or date.today()
    pay = annuity_payment(amount, rate_pct, months)
    r = rate_pct / 100 / 12
    rest = amount
    rows = []
    for i in range(1, months + 1):
        interest = rest * r
        principal = pay - interest if i < months else rest
        rest = max(rest - principal, 0)
        rows.append({
            "n": i,
            "date": (start + timedelta(days=30 * i)).isoformat(),
            "payment": round(principal + interest, 2),
            "principal": round(principal, 2),
            "interest": round(interest, 2),
            "rest": round(rest, 2),
        })
    return rows


# ---------- скоринг ----------

@dataclass
class Features:
    business_age_months: int
    annual_revenue: float
    annual_expenses: float
    prev_year_revenue: float | None
    monthly_debt_payments: float
    amount: float
    term_months: int
    rate: float
    industry: str
    bank_client: bool
    bki_available: bool
    bki_overdue_12m: int = 0
    bki_history_months: int = 0
    bki_current_overdue_days: int = 0

    @property
    def monthly_net_income(self) -> float:
        return (self.annual_revenue - self.annual_expenses) / 12

    @property
    def new_payment(self) -> float:
        return annuity_payment(self.amount, self.rate, self.term_months)

    @property
    def dscr(self) -> float:
        total = self.monthly_debt_payments + self.new_payment
        return self.monthly_net_income / total if total > 0 else 99.0


@dataclass
class ScoreResult:
    points: int
    grade: str
    factors: list[dict] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    version: str = ""

    def as_dict(self) -> dict:
        return {"points": self.points, "grade": self.grade, "factors": self.factors, "metrics": self.metrics, "version": self.version}


def _bucket(rules: list[dict], value: float) -> dict:
    for rule in rules:
        if value <= rule["max"]:
            return rule
    return rules[-1]


def score(f: Features, rs: dict | None = None) -> ScoreResult:
    rs = rs or load_ruleset()
    sc = rs["scorecard"]
    margin = (f.annual_revenue - f.annual_expenses) / f.annual_revenue if f.annual_revenue else -1
    trend = (f.annual_revenue / f.prev_year_revenue - 1) if f.prev_year_revenue else 0.0
    amount_to_rev = f.amount / f.annual_revenue if f.annual_revenue else 99
    metrics = {
        "business_age_months": f.business_age_months,
        "profit_margin": round(margin, 3),
        "revenue_trend": round(trend, 3),
        "dscr": round(f.dscr, 2),
        "amount_to_revenue": round(amount_to_rev, 3),
        "new_monthly_payment": round(f.new_payment, 2),
        "monthly_net_income": round(f.monthly_net_income, 2),
    }
    factors: list[dict] = []

    def add(name: str, rule: dict, value):
        factors.append({"factor": name, "value": value, "points": rule["points"], "label": rule["label"]})

    add("business_age_months", _bucket(sc["business_age_months"], f.business_age_months), f.business_age_months)
    add("profit_margin", _bucket(sc["profit_margin"], margin), metrics["profit_margin"])
    if f.prev_year_revenue:
        add("revenue_trend", _bucket(sc["revenue_trend"], trend), metrics["revenue_trend"])
    add("dscr", _bucket(sc["dscr"], f.dscr), metrics["dscr"])
    add("amount_to_revenue", _bucket(sc["amount_to_revenue"], amount_to_rev), metrics["amount_to_revenue"])
    if f.bki_available:
        add("bki_overdue_12m", _bucket(sc["bki_overdue_12m"], f.bki_overdue_12m), f.bki_overdue_12m)
        add("bki_history_months", _bucket(sc["bki_history_months"], f.bki_history_months), f.bki_history_months)
    add("bank_client", sc["bank_client"]["client" if f.bank_client else "non_client"], f.bank_client)
    risk = rs["industries"].get(f.industry, "medium")
    add("industry_risk", sc["industry_risk"][risk], risk)

    points = sc["base"] + sum(x["points"] for x in factors)
    grade = next(g for g, minimum in rs["grades"].items() if points >= minimum)
    factors.sort(key=lambda x: x["points"])
    return ScoreResult(points=points, grade=grade, factors=factors, metrics=metrics, version=rs["version"])


# ---------- кредитное решение ----------

@dataclass
class ProductTerms:
    code: str
    name: str
    min_amount: float
    max_amount: float
    min_term: int
    max_term: int
    base_rate: float
    auto_limit: float
    collateral_required: bool
    min_business_age_months: int


@dataclass
class DecisionInput:
    features: Features
    product: ProductTerms
    alternatives: list[ProductTerms]
    company_status: str = "ACTIVE"           # из ЕГРЮЛ/ЕГРИП
    fns_flags: list[str] = field(default_factory=list)
    tax_debt: float = 0.0
    has_collateral: bool = False


@dataclass
class Decision:
    outcome: str                              # APPROVED / COUNTER_OFFER / MANUAL_REVIEW / REJECTED
    reasons: list[str]
    offer: dict | None = None
    recommendations: list[str] = field(default_factory=list)
    stop_factors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"outcome": self.outcome, "reasons": self.reasons, "offer": self.offer,
                "recommendations": self.recommendations, "stop_factors": self.stop_factors}


def make_offer(p: ProductTerms, amount: float, term: int, rate: float, valid_days: int) -> dict:
    pay = annuity_payment(amount, rate, term)
    return {
        "product_code": p.code, "product_name": p.name, "amount": round(amount, 2), "term_months": term,
        "rate": round(rate, 2), "monthly_payment": round(pay, 2), "total_payment": round(pay * term, 2),
        "overpayment": round(pay * term - amount, 2),
        "valid_until": (date.today() + timedelta(days=valid_days)).isoformat(),
    }


def affordable_amount(f: Features, rate: float, term: int, min_dscr: float) -> float:
    """Максимальная сумма, при которой DSCR не опускается ниже порога."""
    capacity = f.monthly_net_income / min_dscr - f.monthly_debt_payments
    return max_principal(capacity, rate, term)


def decide(inp: DecisionInput, sr: ScoreResult, rs: dict | None = None) -> Decision:
    rs = rs or load_ruleset()
    pol = rs["policy"]
    f, p = inp.features, inp.product
    rate = p.base_rate + rs["rate_premium"].get(sr.grade, 6.0)
    valid = pol["offer_valid_days"]

    # 1. Стоп-факторы — отказ независимо от скоринга
    stops = []
    if inp.company_status != "ACTIVE":
        stops.append("Компания в процессе ликвидации или исключена из реестра")
    if f.bki_available and f.bki_current_overdue_days > pol["max_current_overdue_days"]:
        stops.append(f"Текущая просрочка по кредитам {f.bki_current_overdue_days} дн.")
    if f.business_age_months < p.min_business_age_months:
        stops.append(f"Для продукта «{p.name}» бизнес должен работать не меньше {p.min_business_age_months} мес.")
    if stops:
        rec = []
        if f.bki_current_overdue_days:
            rec.append("Погасите текущую просрочку — после этого можно подать заявку повторно")
        alt = [a for a in inp.alternatives if f.business_age_months >= a.min_business_age_months and a.code != p.code]
        if f.business_age_months < p.min_business_age_months and alt:
            rec.append("Вам уже доступны: " + ", ".join(a.name for a in alt))
        return Decision("REJECTED", stops, recommendations=rec, stop_factors=stops)

    if sr.grade in pol["reject_grades"]:
        negative = [x["label"] for x in sr.factors if x["points"] < 0][:3]
        return Decision("REJECTED", [f"Высокий уровень риска (рейтинг {sr.grade})"] + negative,
                        recommendations=["Снизьте долговую нагрузку или запросите меньшую сумму",
                                         "Подключите расчётный счёт в банке — обороты повышают оценку"])

    # 2. Причины для ручного рассмотрения
    manual = []
    if not f.bki_available:
        manual.append("Бюро кредитных историй недоступно — нужна ручная проверка")
    if inp.fns_flags:
        manual += inp.fns_flags
    if inp.tax_debt > pol["tax_debt_manual_threshold"]:
        manual.append(f"Задолженность по налогам {inp.tax_debt:_.0f} ₽".replace("_", " "))
    if p.collateral_required:
        manual.append("Залоговый продукт — требуется оценка залога специалистом")
    if sr.grade in pol["manual_grades"]:
        manual.append(f"Средний уровень риска (рейтинг {sr.grade})")

    # 3. Платёжеспособность: хватает ли денежного потока
    limit_by_revenue = f.annual_revenue * pol["max_unsecured_to_revenue"] if not inp.has_collateral else p.max_amount
    max_ok = min(affordable_amount(f, rate, f.term_months, pol["min_dscr"]), limit_by_revenue, p.max_amount)
    if f.amount > max_ok:
        # сначала пробуем увеличить срок, затем снизить сумму, затем другой продукт
        for term in range(f.term_months + 6, p.max_term + 1, 6):
            if f.amount <= min(affordable_amount(f, rate, term, pol["min_dscr"]), limit_by_revenue):
                return Decision("COUNTER_OFFER", [
                    f"Платёж на {f.term_months} мес. слишком высок для текущего денежного потока",
                    f"При сроке {term} мес. платёж становится комфортным"],
                    offer=make_offer(p, f.amount, term, rate, valid))
        best_term = p.max_term
        reduced = min(affordable_amount(f, rate, best_term, pol["min_dscr"]), limit_by_revenue, p.max_amount)
        reduced = int(reduced // 10000) * 10000
        if reduced >= p.min_amount:
            return Decision("COUNTER_OFFER", [
                "Запрошенная сумма превышает комфортную долговую нагрузку",
                f"Можем предложить до {reduced:_.0f} ₽".replace("_", " ")],
                offer=make_offer(p, reduced, best_term, rate, valid))
        for alt in inp.alternatives:
            if alt.code == p.code or f.business_age_months < alt.min_business_age_months:
                continue
            arate = alt.base_rate + rs["rate_premium"].get(sr.grade, 6.0)
            amt = min(affordable_amount(f, arate, alt.max_term, pol["min_dscr"]), alt.max_amount, f.amount)
            amt = int(amt // 10000) * 10000
            if amt >= alt.min_amount:
                return Decision("COUNTER_OFFER", [
                    f"По продукту «{p.name}» нагрузка слишком высока",
                    f"Подойдёт «{alt.name}» на {amt:_.0f} ₽".replace("_", " ")],
                    offer=make_offer(alt, amt, alt.max_term, arate, valid))
        return Decision("REJECTED", ["Текущего денежного потока недостаточно для обслуживания кредита"],
                        recommendations=["Подайте заявку после роста выручки", "Рассмотрите финансирование под залог"])

    offer = make_offer(p, f.amount, f.term_months, rate, valid)
    if manual or f.amount > p.auto_limit:
        if f.amount > p.auto_limit and not p.collateral_required:
            manual.append("Сумма выше лимита автоматического решения")
        return Decision("MANUAL_REVIEW", manual, offer=offer)

    return Decision("APPROVED", [f"Рейтинг {sr.grade}: заявка соответствует условиям продукта"], offer=offer)
