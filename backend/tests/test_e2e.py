"""Сквозные сценарии по демо-учёткам: от черновика до выдачи / отказа."""

from .conftest import login

FIN = lambda rev, exp, debt: {"annual_revenue": rev, "annual_expenses": exp, "monthly_debt_payments": debt}  # noqa: E731


def create_and_submit(client, h, **body):
    body.setdefault("consents", {"bki": True, "pd": True})
    r = client.post("/api/applications", json=body, headers=h)
    assert r.status_code == 201, r.text
    app_id = r.json()["id"]
    r = client.post(f"/api/applications/{app_id}/submit", headers=h | {"Idempotency-Key": f"k-{app_id}"})
    assert r.status_code == 200, r.text
    return r.json()


def sign_flow(client, h, app):
    r = client.post(f"/api/applications/{app['id']}/accept", headers=h)
    assert r.json()["status"]["code"] == "SIGNING"
    code = r.json()["signing"]["code"]
    assert client.post(f"/api/applications/{app['id']}/sign", json={"code": "000000" if code != "000000" else "111111"}, headers=h).status_code == 422
    r = client.post(f"/api/applications/{app['id']}/sign", json={"code": code}, headers=h)
    assert r.json()["status"]["code"] == "DISBURSED", r.json()["status"]
    return r.json()


def test_happy_path_auto_approval_and_disbursement(client):
    h = login(client, "client_good")
    bal = client.get("/api/company", headers=h).json()["company"]["balance"]
    recs = client.post("/api/catalog/recommend", json={"purpose": "purchase", "amount": 2_000_000, "term_months": 12}, headers=h).json()
    assert recs[0]["recommended"]
    app = create_and_submit(client, h, product_code="EXPRESS", amount=2_000_000, term_months=12, purpose="purchase",
                            financials=FIN(14_000_000, 10_500_000, 0))
    assert app["status"]["code"] == "APPROVED", app["decision"]
    statuses = [t["to_status"] for t in app["timeline"] if t["to_status"]]
    assert statuses[:5] == ["DRAFT", "SUBMITTED", "DATA_CHECK", "ENRICHMENT", "SCORING"]
    # повторная отправка с тем же ключом идемпотентна
    assert client.post(f"/api/applications/{app['id']}/submit", headers=h | {"Idempotency-Key": f"k-{app['id']}"}).status_code == 200
    done = sign_flow(client, h, app)
    company = client.get("/api/company", headers=h).json()
    assert company["company"]["balance"] == bal + 2_000_000
    assert company["loans"][0]["term_months"] == 12
    feed = client.get("/api/news/feed", headers=h).json()
    assert any("stage" in " ".join(n["why"]) or "заявка" in " ".join(n["why"]).lower() for n in feed)
    assert done["status"]["code"] == "DISBURSED"


def test_counter_offer(client):
    h = login(client, "client_counter")
    app = create_and_submit(client, h, product_code="EXPRESS", amount=5_000_000, term_months=12, purpose="cash_gap",
                            financials=FIN(60_000_000, 50_000_000, 250_000))
    assert app["status"]["code"] == "COUNTER_OFFER", app["decision"]
    assert app["offer"]["term_months"] > 12
    sign_flow(client, h, app)


def test_needs_info_then_approved_and_delegate_cannot_sign(client):
    h = login(client, "accountant_info")
    app = create_and_submit(client, h, product_code="GROWTH", amount=8_000_000, term_months=36, purpose="development",
                            financials=FIN(85_000_000, 70_000_000, 300_000))
    assert app["status"]["code"] == "NEEDS_INFO"
    task = next(t for t in app["tasks"] if t["status"] == "OPEN")
    assert task["doc_type"] == "FIN_STATEMENTS"
    r = client.post(f"/api/applications/{app['id']}/documents", data={"doc_type": "FIN_STATEMENTS"},
                    files={"file": ("otchet.txt", "Выручка: 85 000 000\nРасходы: 70 000 000".encode(), "text/plain")}, headers=h)
    assert r.json()["extracted"]["annual_revenue"] == 85_000_000
    r = client.post(f"/api/applications/{app['id']}/submit", headers=h)
    assert r.json()["status"]["code"] == "APPROVED", r.json()["decision"]
    client.post(f"/api/applications/{app['id']}/accept", headers=h)
    code = client.get(f"/api/applications/{app['id']}", headers=h).json()["signing"]["code"]
    assert client.post(f"/api/applications/{app['id']}/sign", json={"code": code}, headers=h).status_code == 403
    director = login(client, "client_info")
    assert client.post(f"/api/applications/{app['id']}/sign", json={"code": code}, headers=director).json()["status"]["code"] == "DISBURSED"


def test_manual_review_escalation(client):
    h = login(client, "client_manual")
    app = create_and_submit(client, h, product_code="INVEST", amount=40_000_000, term_months=60, purpose="equipment",
                            financials=FIN(320_000_000, 270_000_000, 1_500_000),
                            collateral={"type": "Оборудование", "description": "Буровая установка", "value": 55_000_000})
    assert app["status"]["code"] == "NEEDS_INFO"
    for doc in ("FIN_STATEMENTS", "COLLATERAL_DOCS"):
        client.post(f"/api/applications/{app['id']}/documents", data={"doc_type": doc},
                    files={"file": (f"{doc}.txt", b"doc", "text/plain")}, headers=h)
    app = client.post(f"/api/applications/{app['id']}/submit", headers=h).json()
    assert app["status"]["code"] == "MANUAL_REVIEW", app["decision"]

    uw = login(client, "underwriter")
    queue = client.get("/api/bank/applications?status=ACTION", headers=uw).json()
    assert any(a["id"] == app["id"] for a in queue)
    card = client.get(f"/api/bank/applications/{app['id']}", headers=uw).json()
    assert card["score"]["grade"] and any(c["source"] == "BKI" for c in card["checks"])
    r = client.post(f"/api/bank/applications/{app['id']}/decision", json={"action": "approve", "comment": "Одобряю"}, headers=uw)
    assert r.status_code == 403  # выше полномочий
    r = client.post(f"/api/bank/applications/{app['id']}/decision", json={"action": "escalate", "comment": "Сумма выше лимита"}, headers=uw)
    assert r.json()["status"]["code"] == "ESCALATED"
    ap = login(client, "approver")
    r = client.post(f"/api/bank/applications/{app['id']}/decision",
                    json={"action": "approve", "comment": "Залог достаточный, одобрено"}, headers=ap)
    assert r.json()["status"]["code"] == "APPROVED"
    assert client.get("/api/bank/metrics", headers=ap).json()["funnel"][0]["count"] >= 1


def test_request_info_by_underwriter(client):
    h = login(client, "client_manual")
    app = create_and_submit(client, h, product_code="INVEST", amount=10_000_000, term_months=36, purpose="equipment",
                            financials=FIN(320_000_000, 270_000_000, 1_500_000), collateral={"type": "Транспорт", "value": 15_000_000})
    # документы уже загружались в другой заявке, здесь их нет → NEEDS_INFO; догружаем
    for doc in ("FIN_STATEMENTS", "COLLATERAL_DOCS"):
        client.post(f"/api/applications/{app['id']}/documents", data={"doc_type": doc}, files={"file": ("d.txt", b"x", "text/plain")}, headers=h)
    app = client.post(f"/api/applications/{app['id']}/submit", headers=h).json()
    uw = login(client, "underwriter")
    r = client.post(f"/api/bank/applications/{app['id']}/decision", headers=uw, json={
        "action": "request_info", "comment": "Нужна выписка",
        "tasks": [{"kind": "DOCUMENT", "doc_type": "BANK_STATEMENT", "title": "Выписка из другого банка"}]})
    assert r.json()["status"]["code"] == "NEEDS_INFO"
    client.post(f"/api/applications/{app['id']}/documents", data={"doc_type": "BANK_STATEMENT"}, files={"file": ("s.txt", b"x", "text/plain")}, headers=h)
    app = client.post(f"/api/applications/{app['id']}/submit", headers=h).json()
    assert app["status"]["code"] == "MANUAL_REVIEW"
    r = client.post(f"/api/bank/applications/{app['id']}/decision", headers=uw,
                    json={"action": "counter", "comment": "Предлагаем меньшую сумму", "amount": 8_000_000})
    assert r.json()["status"]["code"] == "COUNTER_OFFER"


def test_overdue_rejected(client):
    h = login(client, "client_reject")
    app = create_and_submit(client, h, product_code="EXPRESS", amount=1_000_000, term_months=12, purpose="purchase",
                            financials=FIN(9_000_000, 7_200_000, 60_000))
    assert app["status"]["code"] == "REJECTED"
    assert app["decision"]["recommendations"]


def test_liquidated_rejected(client):
    h = login(client, "client_liquidated")
    app = create_and_submit(client, h, product_code="EXPRESS", amount=1_000_000, term_months=12, purpose="purchase",
                            financials=FIN(12_000_000, 11_000_000, 0))
    assert app["status"]["code"] == "REJECTED"


def test_bki_outage_goes_to_manual_review(client, mock_gateway):
    mock_gateway.FAULTS["BKI"] = "down"
    try:
        h = login(client, "client_good")
        app = create_and_submit(client, h, product_code="EXPRESS", amount=1_000_000, term_months=12, purpose="purchase",
                                financials=FIN(14_000_000, 10_500_000, 0))
        assert app["status"]["code"] == "MANUAL_REVIEW"
        assert any(c["source"] == "BKI" and c["status"] == "UNAVAILABLE" for c in app["checks"])
    finally:
        mock_gateway.FAULTS["BKI"] = "ok"


def test_feed_depends_on_client(client):
    food = {n["title"] for n in client.get("/api/news/feed", headers=login(client, "client_good")).json()}
    young = {n["title"] for n in client.get("/api/news/feed", headers=login(client, "client_young")).json()}
    assert food != young


def test_access_control(client):
    h = login(client, "client_young")
    assert client.get("/api/bank/applications", headers=h).status_code == 403
    assert client.get("/api/applications/1", headers=h).status_code == 404
    assert client.get("/api/applications").status_code == 401


def test_assistant_rules_mode(client):
    h = login(client, "client_good")
    r = client.post("/api/assistant/ask", json={"question": "Что такое овердрафт?"}, headers=h).json()
    assert "Овердрафт" in r["answer"] and r["mode"] == "rules"
