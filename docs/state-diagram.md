# Диаграмма состояний заявки

Источник правды — [`backend/app/state_machine.py`](../backend/app/state_machine.py). Любой переход вне этой схемы отклоняется (HTTP 409).

```mermaid
stateDiagram-v2
  [*] --> DRAFT: клиент создал черновик
  DRAFT --> SUBMITTED: клиент отправил
  DRAFT --> CANCELLED
  SUBMITTED --> DATA_CHECK: конвейер
  DATA_CHECK --> NEEDS_INFO: не хватает данных/документов
  DATA_CHECK --> ENRICHMENT: данные полные
  NEEDS_INFO --> SUBMITTED: клиент дополнил и отправил повторно
  NEEDS_INFO --> CANCELLED
  ENRICHMENT --> REJECTED: стоп-фактор реестра (ликвидация, нет в ЕГРЮЛ)
  ENRICHMENT --> SCORING: ЕГРЮЛ/ФНС/БКИ/данные банка получены
  SCORING --> DECISION
  DECISION --> APPROVED: автоодобрение
  DECISION --> COUNTER_OFFER: другие срок/сумма/продукт
  DECISION --> MANUAL_REVIEW: нужен специалист
  DECISION --> REJECTED: стоп-фактор или высокий риск
  MANUAL_REVIEW --> APPROVED
  MANUAL_REVIEW --> COUNTER_OFFER
  MANUAL_REVIEW --> REJECTED
  MANUAL_REVIEW --> NEEDS_INFO: специалист запросил данные
  MANUAL_REVIEW --> ESCALATED: сумма выше полномочий аналитика
  ESCALATED --> APPROVED: руководитель
  ESCALATED --> COUNTER_OFFER
  ESCALATED --> REJECTED
  ESCALATED --> NEEDS_INFO
  APPROVED --> SIGNING: клиент принял условия
  COUNTER_OFFER --> SIGNING: клиент принял условия
  APPROVED --> CANCELLED: клиент отказался
  COUNTER_OFFER --> CANCELLED: клиент отказался
  SIGNING --> DISBURSING: договор подписан кодом
  SIGNING --> CANCELLED
  DISBURSING --> DISBURSED: платёжный шлюз зачислил средства
  DISBURSED --> [*]
  REJECTED --> [*]
  CANCELLED --> [*]
```

## Статусы

| Статус | Кто переводит | Клиент видит | Этап прогресс-бара |
|---|---|---|---|
| DRAFT | клиент | Черновик (автосохранение) | Заявка |
| SUBMITTED | клиент | Отправлена | Проверка данных |
| DATA_CHECK | конвейер | Проверяем полноту данных | Проверка данных |
| NEEDS_INFO | конвейер / специалист | Нужны уточнения + список задач | Проверка данных |
| ENRICHMENT | конвейер | Проверяем компанию (ЕГРЮЛ, ФНС, БКИ) | Анализ |
| SCORING | конвейер | Оцениваем финансы | Анализ |
| DECISION | конвейер | Формируем решение | Анализ |
| MANUAL_REVIEW | конвейер | На рассмотрении у специалиста | Анализ |
| ESCALATED | аналитик | На согласовании | Анализ |
| APPROVED | конвейер / специалист | Одобрено, условия | Решение |
| COUNTER_OFFER | конвейер / специалист | Встречное предложение (сравнение) | Решение |
| REJECTED | конвейер / специалист | Отказ: причины и рекомендации | Решение |
| SIGNING | клиент | Подписание договора | Подписание |
| DISBURSING | клиент (подпись) | Зачисляем деньги | Выдача |
| DISBURSED | конвейер | Деньги зачислены, график платежей | Выдача |
| CANCELLED | клиент | Отменена | — |

Каждый переход записывается в `application_events` (кто, когда, из какого статуса, комментарий) и порождает уведомление клиенту внутри кабинета.
