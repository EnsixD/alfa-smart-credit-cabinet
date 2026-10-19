# Описание API

Полная спецификация: [`openapi.json`](openapi.json) (OpenAPI 3.1), интерактивно — Swagger UI на `http://localhost:8000/docs` (или `http://localhost:8080/docs` через nginx). Коллекция запросов: [`postman_collection.json`](postman_collection.json) (Postman / Bruno / Insomnia).

**Аутентификация:** `POST /api/auth/login` → `token`; далее заголовок `Authorization: Bearer <token>`. Для SSE (`/stream`) токен передаётся в `?token=`, так как EventSource не поддерживает заголовки.

**Ошибки:** `401` — нет/истёк токен, `403` — нет прав (роль, полномочия, право подписи), `404` — не найдено или чужая заявка, `409` — недопустимый переход статуса / конфликт версии, `422` — ошибка валидации, `503` — внешний источник недоступен.

**Надёжность:** `POST /submit` принимает `Idempotency-Key`; `PATCH` принимает `version` для оптимистичной блокировки.

## Аутентификация

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/api/auth/login` | Вход по логину и паролю, выдаёт JWT |
| `GET` | `/api/auth/me` | Me |

## Каталог и подбор

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/catalog/purposes` | Purposes |
| `GET` | `/api/catalog/products` | Products |
| `POST` | `/api/catalog/recommend` | Подбор продуктов под цель + предварительная оценка (без запроса в БКИ) |

## Компания

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/company` | Профиль компании клиента, баланс и действующие кредиты |
| `GET` | `/api/company/lookup/{inn}` | Автозаполнение реквизитов из ЕГРЮЛ/ЕГРИП (mock) |

## Уведомления

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/notifications` | Notifications |
| `POST` | `/api/notifications/read` | Отметить все прочитанными |
| `DELETE` | `/api/notifications/{notification_id}` | Удалить уведомление |
| `DELETE` | `/api/notifications` | Очистить все уведомления |

## Персональная лента

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/news/feed` | Персональная лента: зависит от отрасли, размера бизнеса и стадии заявки |

## Ассистент

| Метод | Путь | Назначение |
|---|---|---|
| `POST` | `/api/assistant/ask` | Ask |

## Заявки клиента

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/applications` | Заявки компании клиента |
| `POST` | `/api/applications` | Создать черновик заявки |
| `GET` | `/api/applications/{app_id}` | Get App |
| `PATCH` | `/api/applications/{app_id}` | Автосохранение черновика / исправление данных по запросу банка |
| `POST` | `/api/applications/{app_id}/submit` | Отправить заявку в банк (идемпотентно по Idempotency-Key) |
| `POST` | `/api/applications/{app_id}/documents` | Загрузить документ (закрывает связанную задачу) |
| `GET` | `/api/applications/{app_id}/documents/{doc_id}` | Скачать документ |
| `POST` | `/api/applications/{app_id}/tasks/{task_id}/complete` | Ответить на запрос банка |
| `POST` | `/api/applications/{app_id}/messages` | Сообщение в чат с банком (внутри продукта) |
| `POST` | `/api/applications/{app_id}/accept` | Принять предложение банка → подписание |
| `POST` | `/api/applications/{app_id}/sign` | Подписать договор (симуляция простой электронной подписи) |
| `POST` | `/api/applications/{app_id}/cancel` | Отменить заявку / отказаться от предложения |
| `GET` | `/api/applications/{app_id}/stream` | SSE-поток событий заявки (статусы обновляются в реальном времени) |

## Рабочее место банка

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/api/bank/applications` | Очередь заявок с фильтрами |
| `GET` | `/api/bank/applications/{app_id}` | Полная карточка заявки для андеррайтера |
| `GET` | `/api/bank/applications/{app_id}/documents/{doc_id}` | Download |
| `POST` | `/api/bank/applications/{app_id}/assign` | Взять заявку в работу |
| `POST` | `/api/bank/applications/{app_id}/decision` | Решение специалиста: одобрить / отказать / контрпредложение / запросить данные / эскалировать |
| `POST` | `/api/bank/applications/{app_id}/messages` | Message |
| `GET` | `/api/bank/metrics` | Воронка конвейера и ключевые показатели |
| `GET` | `/api/bank/ruleset` | Действующие правила скоринга и кредитной политики |
| `GET` | `/api/bank/integrations` | Состояние смоделированных интеграций |
| `POST` | `/api/bank/integrations` | Симулировать сбой интеграции (для демонстрации отказоустойчивости) |

## Эксплуатация

| Метод | Путь | Назначение |
|---|---|---|
| `GET` | `/health` | Health |
| `GET` | `/metrics` | Метрики в формате Prometheus |

## Смоделированные внешние сервисы (mock-gateway, порт 8081)

| Метод | Путь | Смысл интеграции |
|---|---|---|
| `GET` | `/egrul/{inn}` | ЕГРЮЛ/ЕГРИП: существование, статус, дата регистрации, ОКВЭД, руководитель, учредители |
| `GET` | `/fns/transparent-business/{inn}` | ФНС «Прозрачный бизнес»: сотрудники, налоговый режим, налоговый долг, массовый адрес, дисквалификация |
| `GET` | `/bki/report/{inn}` | БКИ: длина истории, активные кредиты и платежи, просрочки |
| `POST` | `/payments/disburse` | Платёжный шлюз: зачисление кредита |
| `GET/POST` | `/admin/faults` | Симулятор сбоев: `ok` / `slow` / `down` для каждого сервиса |
