from app import credit
from app import state_machine as sm
import pytest

P = credit.ProductTerms("EXPRESS", "Экспресс", 300_000, 5_000_000, 3, 24, 19.5, 5_000_000, False, 6)


def feats(**kw):
    base = dict(business_age_months=60, annual_revenue=14_000_000, annual_expenses=10_500_000, prev_year_revenue=None,
                monthly_debt_payments=0, amount=2_000_000, term_months=12, rate=19.5, industry="food",
                bank_client=True, bki_available=True, bki_history_months=40)
    base.update(kw)
    return credit.Features(**base)


def run(f, product=P, **kw):
    sr = credit.score(f)
    return sr, credit.decide(credit.DecisionInput(features=f, product=product, alternatives=[product], **kw), sr)


def test_annuity():
    assert round(credit.annuity_payment(1_200_000, 0, 12)) == 100_000
    pay = credit.annuity_payment(1_000_000, 12, 12)
    assert 88_800 < pay < 88_900
    sched = credit.schedule(1_000_000, 12, 12)
    assert sched[-1]["rest"] == 0 and len(sched) == 12


def test_good_client_auto_approved():
    sr, d = run(feats())
    assert sr.grade == "A"
    assert d.outcome == "APPROVED" and d.offer["amount"] == 2_000_000


def test_overdue_is_stop_factor():
    _, d = run(feats(bki_current_overdue_days=60))
    assert d.outcome == "REJECTED" and d.stop_factors


def test_liquidation_is_stop_factor():
    _, d = run(feats(), company_status="LIQUIDATING")
    assert d.outcome == "REJECTED"


def test_young_business_rejected_with_alternative():
    _, d = run(feats(business_age_months=2))
    assert d.outcome == "REJECTED"


def test_high_load_gives_counter_offer_with_longer_term():
    f = feats(annual_revenue=60_000_000, annual_expenses=50_000_000, monthly_debt_payments=250_000,
              amount=5_000_000, term_months=12, industry="trade")
    _, d = run(f)
    assert d.outcome == "COUNTER_OFFER"
    assert d.offer["term_months"] > 12 and d.offer["amount"] == 5_000_000


def test_bki_unavailable_goes_to_manual():
    _, d = run(feats(bki_available=False))
    assert d.outcome == "MANUAL_REVIEW"


def test_same_risk_different_products_different_terms():
    """Одинаковый скоринг даёт разные условия для разных продуктов."""
    cheap = credit.ProductTerms("G", "Развитие", 1_000_000, 30_000_000, 12, 60, 17.0, 10_000_000, False, 12)
    _, d1 = run(feats())
    _, d2 = run(feats(), product=cheap)
    assert d1.offer["rate"] != d2.offer["rate"]


def test_state_machine():
    sm.check_transition(sm.DRAFT, sm.SUBMITTED)
    with pytest.raises(sm.TransitionError):
        sm.check_transition(sm.DRAFT, sm.APPROVED)
    with pytest.raises(sm.TransitionError):
        sm.check_transition(sm.DISBURSED, sm.CANCELLED)
