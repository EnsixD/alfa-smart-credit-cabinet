"""Синтетические демо-данные: компании под каждую ветку кредитного сценария, учётки, продукты, новости.

Все данные вымышлены. ИНН/ОГРН и ответы реестров согласованы с фикстурами mock-gateway.
Сид идемпотентен: повторный запуск ничего не дублирует.
"""

from datetime import date, datetime, timedelta, timezone

from .news_articles import article
from .db import SessionLocal, init_db
from .models import Company, News, Product, User
from .security import hash_password

DEMO_PASSWORD = "demo123"

PRODUCTS = [
    dict(code="EXPRESS", name="Экспресс-кредит", short="Быстрые деньги на оборот без залога, решение за несколько минут.",
         description="Кредит без залога и поручительств для пополнения оборотных средств и закупок. Решение принимается автоматически.",
         min_amount=300_000, max_amount=5_000_000, min_term=3, max_term=24, base_rate=19.5, auto_limit=5_000_000,
         collateral_required=False, min_business_age_months=6, purposes=["cash_gap", "working_capital", "purchase"],
         required_docs=[], decision_time="за 5 минут"),
    dict(code="OVERDRAFT", name="Овердрафт", short="Лимит на расчётном счёте для кассовых разрывов, проценты только за использованные дни.",
         description="Возобновляемый лимит на расчётном счёте. Подходит, когда деньги нужны на несколько дней или недель.",
         min_amount=100_000, max_amount=10_000_000, min_term=1, max_term=12, base_rate=18.0, auto_limit=3_000_000,
         collateral_required=False, min_business_age_months=6, purposes=["cash_gap"], required_docs=[], decision_time="за 5 минут"),
    dict(code="GROWTH", name="Кредит на развитие", short="Крупная сумма на рост бизнеса: оборот, закупки, новое направление.",
         description="Беззалоговый кредит на развитие бизнеса на срок до 5 лет. Нужна бухгалтерская отчётность.",
         min_amount=1_000_000, max_amount=30_000_000, min_term=12, max_term=60, base_rate=17.0, auto_limit=10_000_000,
         collateral_required=False, min_business_age_months=12, purposes=["working_capital", "purchase", "development"],
         required_docs=["FIN_STATEMENTS"], decision_time="до 1 рабочего дня"),
    dict(code="INVEST", name="Инвестиционный кредит", short="Покупка оборудования, транспорта, недвижимости под залог, до 7 лет.",
         description="Кредит на инвестиционные цели под залог приобретаемого или имеющегося имущества. Рассматривается специалистом.",
         min_amount=5_000_000, max_amount=150_000_000, min_term=12, max_term=84, base_rate=16.0, auto_limit=0,
         collateral_required=True, min_business_age_months=24, purposes=["equipment", "real_estate", "development"],
         required_docs=["FIN_STATEMENTS", "COLLATERAL_DOCS"], decision_time="до 3 рабочих дней"),
    dict(code="CARD", name="Кредитная бизнес-карта", short="Небольшой лимит на текущие расходы и закупки, до 2 мес. без процентов.",
         description="Корпоративная кредитная карта для повседневных расходов бизнеса.",
         min_amount=50_000, max_amount=1_000_000, min_term=12, max_term=36, base_rate=24.0, auto_limit=1_000_000,
         collateral_required=False, min_business_age_months=1, purposes=["cash_gap", "purchase"], required_docs=[],
         decision_time="за 5 минут"),
]

COMPANIES = [
    dict(key="good", inn="771234567890", ogrn="321774600123456", name="ИП Смирнова Анна Сергеевна (кофейня «Зерно»)",
         legal_form="ИП", okved="56.10", okved_name="Деятельность ресторанов и услуги по доставке продуктов питания",
         industry="food", reg_date=date(2021, 3, 15), address="г. Москва, ул. Покровка, д. 12", region="Москва",
         director="Смирнова Анна Сергеевна", segment="micro", annual_revenue=14_000_000, annual_expenses=10_500_000,
         monthly_debt_payments=0, account_turnover_month=1_150_000, balance=820_000),
    dict(key="counter", inn="7701234567", ogrn="1197746123456", name="ООО «ТоргСнаб»", legal_form="ООО", okved="46.90",
         okved_name="Торговля оптовая неспециализированная", industry="trade", reg_date=date(2019, 5, 20),
         address="г. Москва, Варшавское ш., д. 47", region="Москва", director="Орлов Виктор Петрович", segment="small",
         annual_revenue=60_000_000, annual_expenses=50_000_000, monthly_debt_payments=250_000,
         account_turnover_month=4_900_000, balance=2_400_000),
    dict(key="info", inn="5003123456", ogrn="1185003001234", name="ООО «ЭкоПласт»", legal_form="ООО", okved="22.29",
         okved_name="Производство прочих пластмассовых изделий", industry="manufacturing", reg_date=date(2018, 2, 10),
         address="Московская обл., г. Видное, Промзона, стр. 3", region="Московская область",
         director="Белова Ирина Николаевна", segment="small", annual_revenue=85_000_000, annual_expenses=70_000_000,
         monthly_debt_payments=300_000, account_turnover_month=7_000_000, balance=5_300_000),
    dict(key="manual", inn="6658123456", ogrn="1156658012345", name="ООО «СтройМаш»", legal_form="ООО", okved="28.92",
         okved_name="Производство машин и оборудования для добычи полезных ископаемых и строительства",
         industry="manufacturing", reg_date=date(2015, 9, 1), address="г. Екатеринбург, ул. Монтажников, д. 4",
         region="Свердловская область", director="Кравцов Дмитрий Олегович", segment="small",
         annual_revenue=320_000_000, annual_expenses=270_000_000, monthly_debt_payments=1_500_000,
         account_turnover_month=26_000_000, balance=18_000_000),
    dict(key="reject", inn="540312345678", ogrn="322540000098765", name="ИП Козлов Пётр Андреевич (автосервис)",
         legal_form="ИП", okved="45.20", okved_name="Техническое обслуживание и ремонт автотранспортных средств",
         industry="auto", reg_date=date(2022, 6, 1), address="г. Новосибирск, ул. Станционная, д. 30",
         region="Новосибирская область", director="Козлов Пётр Андреевич", segment="micro",
         annual_revenue=9_000_000, annual_expenses=7_200_000, monthly_debt_payments=60_000,
         account_turnover_month=0, balance=150_000),
    dict(key="liquidated", inn="7812345678", ogrn="1177847123456", name="ООО «Ромашка»", legal_form="ООО", okved="47.11",
         okved_name="Торговля розничная в неспециализированных магазинах", industry="trade", reg_date=date(2017, 4, 3),
         address="г. Санкт-Петербург, Лиговский пр., д. 50", region="Санкт-Петербург", director="Лебедев Игорь Ильич",
         segment="micro", annual_revenue=12_000_000, annual_expenses=11_000_000, monthly_debt_payments=0,
         account_turnover_month=900_000, balance=300_000),
    dict(key="young", inn="773412345678", ogrn="326770000054321", name="ИП Новиков Денис Игоревич (веб-студия)",
         legal_form="ИП", okved="62.01", okved_name="Разработка компьютерного программного обеспечения", industry="it",
         reg_date=date(2026, 8, 1), address="г. Москва, ул. Лесная, д. 5", region="Москва",
         director="Новиков Денис Игоревич", segment="micro", annual_revenue=2_400_000, annual_expenses=1_500_000,
         monthly_debt_payments=0, account_turnover_month=200_000, balance=180_000),
]

USERS = [
    ("client_good", "CLIENT", "Смирнова Анна Сергеевна", "Индивидуальный предприниматель", True, "good"),
    ("client_counter", "CLIENT", "Орлов Виктор Петрович", "Генеральный директор", True, "counter"),
    ("client_info", "CLIENT", "Белова Ирина Николаевна", "Генеральный директор", True, "info"),
    ("accountant_info", "CLIENT", "Зайцева Ольга Викторовна", "Главный бухгалтер", False, "info"),
    ("client_manual", "CLIENT", "Кравцов Дмитрий Олегович", "Генеральный директор", True, "manual"),
    ("client_reject", "CLIENT", "Козлов Пётр Андреевич", "Индивидуальный предприниматель", True, "reject"),
    ("client_liquidated", "CLIENT", "Лебедев Игорь Ильич", "Генеральный директор", True, "liquidated"),
    ("client_young", "CLIENT", "Новиков Денис Игоревич", "Индивидуальный предприниматель", True, "young"),
    ("underwriter", "UNDERWRITER", "Морозова Елена Андреевна", "Кредитный аналитик", True, None),
    ("approver", "APPROVER", "Соколов Андрей Михайлович", "Руководитель кредитного управления", True, None),
    ("admin", "ADMIN", "Администратор системы", "Администратор", True, None),
]

# (дней назад, категория, заголовок, анонс, теги)
NEWS = [
    (1, "Законы", "С 1 января меняются лимиты для упрощённой системы налогообложения",
     "Порог доходов для УСН вырастет. Разбираем, кого коснутся изменения и что проверить уже сейчас.", ["all", "form:ИП", "segment:micro"]),
    (2, "Налоги", "Календарь налоговых платежей на ноябрь",
     "Сроки уплаты НДФЛ, страховых взносов и авансов по УСН в одном месте.", ["all"]),
    (3, "Отрасль", "Общепит: обязательная маркировка молочной продукции расширяется",
     "Кафе и кофейни должны выводить из оборота маркированную молочку. Что изменится на кассе.", ["industry:food"]),
    (5, "Отрасль", "Кофейни на подъёме: средний чек вырос на 9% за год",
     "Аналитика рынка кофе навынос: где растёт спрос и как кофейням увеличить оборот.", ["industry:food", "segment:micro"]),
    (4, "Отрасль", "Оптовая торговля: как сократить кассовые разрывы с отсрочкой поставщикам",
     "Практические способы выровнять денежный поток, когда покупатели платят с отсрочкой.", ["industry:trade", "purpose:cash_gap"]),
    (6, "Отрасль", "Маркетплейсы снижают комиссии для оптовых поставщиков",
     "Новые условия для продавцов категории B2B — что выгоднее: свой склад или фулфилмент.", ["industry:trade"]),
    (2, "Господдержка", "Субсидии на модернизацию производств: приём заявок до 15 декабря",
     "Минпромторг компенсирует часть затрат на новое оборудование. Кто может участвовать.", ["industry:manufacturing", "purpose:equipment"]),
    (7, "Отрасль", "Производители пластика: требования к переработке ужесточат",
     "Новый экосбор и доля вторсырья. Как подготовиться производителям полимерных изделий.", ["industry:manufacturing"]),
    (3, "Отрасль", "Спрос на строительную технику вырос на 14%",
     "Рынок спецтехники восстанавливается — что это значит для производителей оборудования.", ["industry:manufacturing", "segment:small"]),
    (5, "Отрасль", "Автосервисам: новые правила утилизации технических жидкостей",
     "Штрафы за нарушения выросли. Как оформить договор с переработчиком.", ["industry:auto"]),
    (4, "Отрасль", "IT-аккредитация для ИП: льготы и как их получить",
     "Пониженные взносы и налоговые льготы для разработчиков — пошаговая инструкция.", ["industry:it", "young"]),
    (1, "Старт", "Первый год бизнеса: какие финансовые привычки помогут получить кредит",
     "Ведите обороты через один расчётный счёт, платите налоги вовремя и копите кредитную историю с карты.", ["young", "stage:none"]),
    (2, "Гид", "Как выбрать кредит для бизнеса: короткая шпаргалка",
     "Кассовый разрыв — овердрафт, оборот — экспресс-кредит, оборудование — инвестиционный. Объясняем простыми словами.", ["stage:none", "stage:draft"]),
    (1, "Гид", "Что подготовить перед подачей заявки",
     "Список данных, которые ускорят решение: выручка, расходы, текущие кредиты, отчётность.", ["stage:draft"]),
    (1, "Гид", "Банк запросил документы: что это значит и как ответить быстрее",
     "Запрос документов — не отказ. Рассказываем, какие документы просят чаще всего и в каком виде их загрузить.", ["stage:needs_info"]),
    (2, "Гид", "Бухгалтерская отчётность: где взять и как загрузить",
     "Отчётность можно выгрузить из личного кабинета налогоплательщика или учётной системы за пару минут.", ["stage:needs_info", "product:GROWTH", "product:INVEST"]),
    (1, "Гид", "Заявку смотрит специалист: что происходит и сколько ждать",
     "Почему некоторые заявки рассматривает человек, а не алгоритм, и как ускорить решение через чат с банком.", ["stage:review"]),
    (1, "Гид", "Одобрили кредит: как читать график платежей",
     "Аннуитет, проценты и основной долг — разбираем на примере вашего графика.", ["stage:approved", "stage:disbursed"]),
    (2, "Гид", "Банк предложил другие условия — стоит ли соглашаться",
     "Больший срок снижает платёж, меньшая сумма — переплату. Как сравнить варианты.", ["stage:counter"]),
    (1, "Гид", "Отказ по кредиту: 5 шагов, чтобы получить одобрение в следующий раз",
     "Закройте просрочки, снизьте долговую нагрузку, переведите обороты в один банк и попробуйте снова через 3 месяца.", ["stage:rejected"]),
    (3, "Гид", "Как улучшить кредитную историю бизнеса",
     "Что видит бюро кредитных историй и какие действия быстрее всего повышают оценку.", ["stage:rejected", "young"]),
    (1, "Деньги", "Деньги на счёте: как не допустить просрочек по новому кредиту",
     "Настройте автоплатёж и резерв на 1–2 платежа — это сохранит хорошую историю.", ["stage:disbursed"]),
    (3, "Продукты", "Овердрафт: как работает лимит на расчётном счёте",
     "Проценты начисляются только за дни использования. Примеры расчёта для кассового разрыва.", ["product:OVERDRAFT", "purpose:cash_gap"]),
    (4, "Продукты", "Экспресс-кредит без залога: кому подходит",
     "Решение за минуты для бизнеса старше полугода. Требования и типичные суммы.", ["product:EXPRESS", "segment:micro", "purpose:purchase"]),
    (5, "Продукты", "Инвестиционный кредит: как банк оценивает залог",
     "Какое имущество подходит в залог и как рассчитывается дисконт.", ["product:INVEST", "purpose:equipment", "purpose:real_estate"]),
    (6, "Продукты", "Кредит на развитие: запускаем новое направление без залога",
     "Как обосновать цель кредита и какие показатели смотрит банк.", ["product:GROWTH", "purpose:development", "segment:small"]),
    (2, "Господдержка", "Льготные кредиты МСП: ставки по программе на IV квартал",
     "Условия программы льготного кредитования малого бизнеса и кто может участвовать.", ["segment:small", "segment:micro"]),
    (8, "Рынок", "Ключевая ставка: что будет с кредитами для бизнеса",
     "Как решение регулятора повлияет на ставки по кредитам МСП в ближайшие месяцы.", ["all"]),
    (9, "Безопасность", "Мошенники звонят от имени банка: как защитить бизнес",
     "Банк никогда не просит коды подтверждения по телефону. Все действия по заявке — только в кабинете.", ["all"]),
    (6, "Отрасль", "Общепит: как пережить зимний спад выручки",
     "Сезонность в кафе: резерв, гибкие закупки и короткое финансирование на кассовый разрыв.", ["industry:food", "purpose:cash_gap"]),
    (5, "Законы", "ООО: новые требования к хранению документов",
     "Какие документы общество обязано хранить и в каком виде с 2027 года.", ["form:ООО"]),
    (3, "Законы", "ИП: страховые взносы за себя в 2027 году",
     "Фиксированная часть и 1% с дохода сверх порога — новые суммы и сроки.", ["form:ИП"]),
]


def sync_news(db) -> None:
    """Обновляет тексты новостей в уже заполненной базе, не трогая остальные данные."""
    changed = False
    for _, _, title, summary, _ in NEWS:
        body = article(title, summary)
        for n in db.query(News).filter(News.title == title).all():
            if n.body != body:
                n.body = body
                changed = True
    if changed:
        db.commit()


def seed() -> None:
    init_db()
    with SessionLocal() as db:
        if db.query(User).count():
            sync_news(db)
            return
        for p in PRODUCTS:
            db.add(Product(**p))
        companies = {}
        for c in COMPANIES:
            key = c.pop("key")
            companies[key] = Company(**c)
            db.add(companies[key])
            c["key"] = key
        db.flush()
        pwd = hash_password(DEMO_PASSWORD)
        for login, role, name, position, can_sign, ckey in USERS:
            db.add(User(login=login, password_hash=pwd, role=role, full_name=name, position=position,
                        can_sign=can_sign, company_id=companies[ckey].id if ckey else None))
        now = datetime.now(timezone.utc)
        for days, cat, title, summary, tags in NEWS:
            db.add(News(title=title, summary=summary, body=article(title, summary),
                        category=cat, tags=tags, published_at=now - timedelta(days=days)))
        db.commit()


if __name__ == "__main__":
    seed()
    print("seeded")
