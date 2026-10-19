"""Диаграмма состояний кредитной заявки. Единственный источник правды о допустимых переходах."""

DRAFT = "DRAFT"
SUBMITTED = "SUBMITTED"
DATA_CHECK = "DATA_CHECK"
NEEDS_INFO = "NEEDS_INFO"
ENRICHMENT = "ENRICHMENT"
SCORING = "SCORING"
DECISION = "DECISION"
MANUAL_REVIEW = "MANUAL_REVIEW"
ESCALATED = "ESCALATED"
COUNTER_OFFER = "COUNTER_OFFER"
APPROVED = "APPROVED"
SIGNING = "SIGNING"
DISBURSING = "DISBURSING"
DISBURSED = "DISBURSED"
REJECTED = "REJECTED"
CANCELLED = "CANCELLED"

TRANSITIONS: dict[str, set[str]] = {
    DRAFT: {SUBMITTED, CANCELLED},
    SUBMITTED: {DATA_CHECK, CANCELLED},
    DATA_CHECK: {NEEDS_INFO, ENRICHMENT, REJECTED},
    NEEDS_INFO: {SUBMITTED, CANCELLED, REJECTED},
    ENRICHMENT: {SCORING, REJECTED, MANUAL_REVIEW},
    SCORING: {DECISION},
    DECISION: {APPROVED, MANUAL_REVIEW, COUNTER_OFFER, REJECTED, NEEDS_INFO},
    MANUAL_REVIEW: {APPROVED, COUNTER_OFFER, REJECTED, NEEDS_INFO, ESCALATED, CANCELLED},
    ESCALATED: {APPROVED, COUNTER_OFFER, REJECTED, NEEDS_INFO, CANCELLED},
    COUNTER_OFFER: {SIGNING, CANCELLED},
    APPROVED: {SIGNING, CANCELLED},
    SIGNING: {DISBURSING, CANCELLED},
    DISBURSING: {DISBURSED},
    DISBURSED: set(),
    REJECTED: set(),
    CANCELLED: set(),
}

FINAL = {DISBURSED, REJECTED, CANCELLED}
IN_PIPELINE = {SUBMITTED, DATA_CHECK, ENRICHMENT, SCORING, DECISION}
BANK_REVIEW = {MANUAL_REVIEW, ESCALATED}

# Понятные клиенту названия и пояснения (клиент не обязан знать внутренние процессы банка)
LABELS: dict[str, tuple[str, str]] = {
    DRAFT: ("Черновик", "Заявка сохраняется автоматически — можно вернуться к ней в любой момент."),
    SUBMITTED: ("Отправлена", "Мы получили заявку и поставили её в очередь на проверку."),
    DATA_CHECK: ("Проверяем полноту данных", "Смотрим, хватает ли сведений и документов. Обычно до минуты."),
    NEEDS_INFO: ("Нужны уточнения", "Нам не хватает данных. Выполните задачи ниже и отправьте заявку повторно."),
    ENRICHMENT: ("Проверяем компанию", "Сверяем данные с ЕГРЮЛ/ЕГРИП, ФНС и бюро кредитных историй."),
    SCORING: ("Оцениваем финансы", "Анализируем выручку, долговую нагрузку и кредитную историю."),
    DECISION: ("Формируем решение", "Подбираем условия под ваш бизнес."),
    MANUAL_REVIEW: ("На рассмотрении у специалиста", "Заявку изучает кредитный специалист. Обычно до 1 рабочего дня."),
    ESCALATED: ("На согласовании", "Крупная сумма — решение согласует руководитель кредитного подразделения."),
    COUNTER_OFFER: ("Есть встречное предложение", "Банк готов выдать финансирование на других условиях — посмотрите их."),
    APPROVED: ("Одобрено", "Проверьте условия и подпишите договор."),
    SIGNING: ("Подписание договора", "Подтвердите подписание кодом из кабинета."),
    DISBURSING: ("Зачисляем деньги", "Перечисляем средства на расчётный счёт."),
    DISBURSED: ("Деньги зачислены", "Средства на счёте. График платежей доступен в кабинете."),
    REJECTED: ("Отказ", "Сейчас банк не может выдать кредит. Ниже — причины и что можно сделать."),
    CANCELLED: ("Отменена", "Заявка отменена."),
}

# Укрупнённые шаги для прогресс-бара клиента
STAGES = ["Заявка", "Проверка данных", "Анализ", "Решение", "Подписание", "Выдача"]
STAGE_OF = {
    DRAFT: 0, SUBMITTED: 1, DATA_CHECK: 1, NEEDS_INFO: 1,
    ENRICHMENT: 2, SCORING: 2, DECISION: 2, MANUAL_REVIEW: 2, ESCALATED: 2,
    APPROVED: 3, COUNTER_OFFER: 3, REJECTED: 3,
    SIGNING: 4, DISBURSING: 5, DISBURSED: 5, CANCELLED: 0,
}


class TransitionError(Exception):
    pass


def check_transition(src: str, dst: str) -> None:
    if dst not in TRANSITIONS.get(src, set()):
        raise TransitionError(f"Переход {src} → {dst} недопустим")
