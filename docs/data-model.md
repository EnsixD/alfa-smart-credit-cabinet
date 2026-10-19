# Модель данных

Определена в [`backend/app/models.py`](../backend/app/models.py) (SQLAlchemy 2, PostgreSQL 16).

```mermaid
erDiagram
  COMPANIES ||--o{ USERS : "сотрудники клиента"
  COMPANIES ||--o{ APPLICATIONS : подаёт
  PRODUCTS ||--o{ APPLICATIONS : "выбран в"
  USERS ||--o{ APPLICATIONS : "создал / назначен"
  APPLICATIONS ||--o{ APPLICATION_EVENTS : "журнал (аудит + SSE)"
  APPLICATIONS ||--o{ CHECKS : "результаты проверок"
  APPLICATIONS ||--o{ TASKS : "запросы клиенту"
  APPLICATIONS ||--o{ DOCUMENTS : документы
  APPLICATIONS ||--o{ MESSAGES : "чат с банком"
  APPLICATIONS ||--o{ JOBS : "задачи конвейера"
  APPLICATIONS ||--o| LOANS : "выданный кредит"
  COMPANIES ||--o{ NOTIFICATIONS : уведомления
  COMPANIES ||--o{ LOANS : кредиты

  COMPANIES { int id PK; string inn UK; string ogrn; string name; string legal_form; string okved; string industry; date reg_date; string segment; float annual_revenue; float account_turnover_month; float balance }
  USERS { int id PK; string login UK; string password_hash; string role; bool can_sign; int company_id FK }
  PRODUCTS { string code PK; string name; float min_amount; float max_amount; int min_term; int max_term; float base_rate; float auto_limit; bool collateral_required; int min_business_age_months; json purposes; json required_docs }
  APPLICATIONS { int id PK; string number UK; int company_id FK; string product_code FK; float amount; int term_months; string purpose; json financials; json collateral; json consents; string status; json score; json decision; json offer; json signing; int version; string idempotency_key; int assigned_to FK }
  APPLICATION_EVENTS { int id PK; int application_id FK; string type; string from_status; string to_status; string actor; text message; json payload; datetime created_at }
  CHECKS { int id PK; int application_id FK; string source; string status; text summary; json payload }
  TASKS { int id PK; int application_id FK; string kind; string doc_type; string title; string status; text answer; string created_by }
  DOCUMENTS { int id PK; int application_id FK; string doc_type; string filename; int size; bytes data; json extracted }
  MESSAGES { int id PK; int application_id FK; string author_role; text text }
  NOTIFICATIONS { int id PK; int company_id FK; int application_id FK; text text; bool read }
  JOBS { int id PK; int application_id FK; string kind; string status; int attempts; text last_error; datetime run_after }
  LOANS { int id PK; int application_id FK; string contract_number; float amount; float rate; int term_months; float monthly_payment; json schedule }
  NEWS { int id PK; string title; text summary; string category; json tags; datetime published_at }
```

## JSON-поля заявки
| Поле | Пример |
|---|---|
| `financials` | `{"annual_revenue": 14000000, "annual_expenses": 10500000, "prev_year_revenue": 12000000, "monthly_debt_payments": 0}` |
| `collateral` | `{"type": "Оборудование", "description": "Буровая установка", "value": 55000000}` |
| `consents` | `{"pd": true, "bki": true}` |
| `score` | `{"points": 800, "grade": "A", "factors": [{"factor": "dscr", "value": 1.57, "points": 30, "label": "…"}], "metrics": {...}, "version": "2026.10-1"}` |
| `decision` | `{"outcome": "COUNTER_OFFER", "reasons": [...], "recommendations": [...], "stop_factors": [...], "ruleset_version": "2026.10-1", "by": "Кредитный конвейер"}` |
| `offer` | `{"product_code": "EXPRESS", "amount": 5000000, "term_months": 18, "rate": 21.0, "monthly_payment": 326000, "valid_until": "2026-11-02"}` |
| `signing` | `{"contract_number": "КД-2610-00001", "code": "123456", "document": "…", "signed_by": "…", "signed_at": "…"}` |

## Теги новостей (персонализация ленты)
`industry:<food|trade|manufacturing|auto|it…>`, `segment:<micro|small>`, `form:<ИП|ООО>`, `young` (бизнес < 2 лет), `stage:<none|draft|needs_info|review|approved|counter|rejected|disbursed>`, `product:<CODE>`, `purpose:<code>`, `all`.
