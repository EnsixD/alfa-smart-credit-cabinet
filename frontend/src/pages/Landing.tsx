import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CreditCard,
  Factory,
  FileCheck2,
  FileText,
  MessageCircle,
  Play,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, money, months } from "../api";
import SiteHeader, { Logo, scrollToId } from "../components/SiteHeader";
import SmoothHeight from "../components/SmoothHeight";
import FadeContent from "../components/reactbits/FadeContent";
import SplitText from "../components/reactbits/SplitText";
import BrandField from "../components/BrandField";
import { AnimatePresence, motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { AnimatedNumber } from "../anim";
import SpotlightCard from "../components/reactbits/SpotlightCard";
import { homeOf, useAuth } from "../auth";

const ICONS: Record<string, any> = {
  EXPRESS: Zap,
  OVERDRAFT: Wallet,
  GROWTH: TrendingUp,
  INVEST: Factory,
  CARD: CreditCard,
};
const FAQ = [
  [
    "Для какого бизнеса подходит кредит?",
    "Для индивидуальных предпринимателей и компаний малого бизнеса. Требования к сроку работы, обороту и документам зависят от продукта — они будут видны при подборе.",
  ],
  [
    "Какие документы нужно подготовить?",
    "Для экспресс-кредита, овердрафта и бизнес-карты используем данные счёта и реестров. Для кредита на развитие нужна бухгалтерская отчётность, а для инвестиционного — ещё документы на залог.",
  ],
  [
    "Предварительная оценка влияет на кредитную историю?",
    "Нет. На этапе подбора оцениваем предложение по данным компании. Запрос в бюро кредитных историй происходит после подачи заявки с вашего согласия.",
  ],
  [
    "Что делать, если запрошенную сумму не одобрили?",
    "В кабинете появятся причины решения. Если возможно, банк предложит другую сумму, срок или продукт. Вы сможете сравнить предложение с первоначальным запросом.",
  ],
  [
    "Может ли бухгалтер заполнить заявку?",
    "Да. Сотрудник может подготовить заявку и добавить документы, а руководитель — проверить условия и подписать договор из своего кабинета.",
  ],
];
const JOURNEY = [
  {
    n: "01",
    title: "Расскажите о задаче",
    text: "Закупить товар, открыть точку или обновить оборудование — начнём с того, что нужно вашему делу.",
    icon: MessageCircle,
  },
  {
    n: "02",
    title: "Получите решение",
    text: "Проверим данные компании. Каждый этап и запрос документов появятся в кабинете.",
    icon: FileCheck2,
  },
  {
    n: "03",
    title: "Переходите к планам",
    text: "Подпишите договор онлайн. После выдачи кредита график платежей останется под рукой.",
    icon: ArrowUpRight,
  },
];

export default function Landing() {
  const { scrollY } = useScroll();
  const reducedMotion = useReducedMotion();
  const backgroundY = useTransform(scrollY, [0, 1000], [0, 180]);
  const { user } = useAuth();
  const { hash } = useLocation();
  const [products, setProducts] = useState<any[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selected, setSelected] = useState("all");
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState("status");

  const apply = user
    ? user.role === "CLIENT"
      ? "/cabinet/new"
      : homeOf(user)
    : "/login";
  const cabinet = user ? homeOf(user) : "/login";
  useEffect(() => {
    api("/api/catalog/products")
      .then(setProducts)
      .catch(() => setCatalogError(true));
  }, []);
  useEffect(() => {
    if (hash) {
      const t = setTimeout(() => scrollToId(hash.slice(1)), 120);
      return () => clearTimeout(t);
    }
  }, [hash]);
  const list =
    selected === "all"
      ? products
      : products.filter((p) =>
          selected === "grow"
            ? ["GROWTH", "INVEST"].includes(p.code)
            : ["EXPRESS", "OVERDRAFT", "CARD"].includes(p.code),
        );

  return (
    <div className="studio-site">
      <a className="st-skip" href="#business">
        К содержимому
      </a>
      <SiteHeader />
      <main>
        <section className="vx-hero" id="business">
          <motion.div className="vf-hero-parallax" style={{ y: reducedMotion ? 0 : backgroundY }} aria-hidden="true">
            <BrandField className="vf-hero-field" />
          </motion.div>
          <div className="vx-hero-halo" aria-hidden="true" />
          <FadeContent
            trigger="mount"
            duration={0.8}
            className="vx-hero-content"
          >
            <div className="vx-eyebrow">
              <span /> Вектор для бизнеса <i /> Ваш следующий шаг
            </div>
            <h1>
              <SplitText
                text="Большим планам —"
                tag="span"
                textAlign="center"
                className="vx-title-line"
                trigger="load"
                effect="rise"
                mask={false}
                delay={22}
                duration={0.8}
              />
              <SplitText
                text="верное направление."
                tag="span"
                textAlign="center"
                className="vx-title-line vx-red"
                trigger="load"
                effect="rise"
                mask={false}
                delay={18}
                duration={0.9}
              />
            </h1>
            <p>
              Финансирование, которое двигает ваше дело.
              <br />
              От первого решения до нового масштаба — в одном кабинете.
            </p>
            <div className="st-actions">
                <Link className="st-button vf-hero-action" to={apply}>
                  Подобрать кредит <ArrowUpRight size={21} />
                </Link>
              <button
                className="vx-secondary vf-hero-action"
                onClick={() => scrollToId("how")}
              >
                Как это работает <ArrowRight size={19} />
              </button>
            </div>
            <div className="vx-hero-proof">
              <ShieldCheck size={17} /> Заявка онлайн <span /> Решение от 5
              минут <span /> До 150 млн ₽
            </div>
          </FadeContent>
          <div className="vx-hero-caption" aria-hidden="true">
            <span>ВДОХНОВЛЯЕТ БИЗНЕС. ПОДДЕРЖИВАЕТ РОСТ.</span>
            <span>01 / НАПРАВЛЕНИЕ ВПЕРЁД</span>
          </div>
        </section>

        <div className="vf-proof-strip">
          <div>
            <span>01</span>
            <b>5 решений</b>
            <small>для вашего бизнеса</small>
          </div>
          <div>
            <span>02</span>
            <b>До 150 млн ₽</b>
            <small>на большие планы</small>
          </div>
          <div>
            <span>03</span>
            <b>От 5 минут</b>
            <small>автоматическое решение</small>
          </div>
          <div>
            <span>04</span>
            <b>Всё онлайн</b>
            <small>от заявки до договора</small>
          </div>
        </div>

        <section className="vf-section vf-finance" id="credits">
          <FadeContent duration={0.6}>
            <div className="vf-section-label">
              <span>01 / Финансирование</span>
              <span>Решения в вашем масштабе</span>
            </div>
            <div className="vf-section-heading">
              <h2>
                У каждого дела —<br />
                <em>свой размах.</em>
              </h2>
              <p>
                Деньги на то, что важно сейчас.
                <br />И на то, к чему вы идёте.
              </p>
            </div>
          </FadeContent>
          <div
            className="vf-filter"
            role="group"
            aria-label="Задача финансирования"
          >
            {[
              ["all", "Все решения"],
              ["today", "На каждый день"],
              ["grow", "Для развития"],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={selected === key}
                onClick={() => setSelected(key)}
              >
                {selected === key && (
                  <motion.span
                    layoutId="finance-filter"
                    className="vf-filter-active"
                    transition={{
                      type: "spring",
                      stiffness: 240,
                      damping: 30,
                      mass: 0.85,
                    }}
                  />
                )}
                <span>{label}</span>
              </button>
            ))}
          </div>
          <SmoothHeight className="vf-product-window">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected}
                className="vf-products"
                data-count={list.length}
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
                  },
                  exit: { opacity: 0, y: -7, transition: { duration: 0.18 } },
                }}
              >
                {list.map((p, i) => {
                  const Icon = ICONS[p.code] || Wallet;
                  return (
                    <motion.div
                      key={p.code}
                      className={
                        "vf-product-cell " + (i < 2 ? "vf-product-wide" : "")
                      }
                      variants={{
                        hidden: { opacity: 0, y: 16 },
                        visible: {
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.42,
                            ease: [0.22, 1, 0.36, 1],
                          },
                        },
                      }}
                    >
                      <Link
                        to={`/credits/${p.code}`}
                        className={
                          "vf-product-card " +
                          (p.code === "INVEST" ? "vf-product-dark" : "")
                        }
                      >
                        <div className="vf-product-top">
                          <span className="vf-product-icon">
                            <Icon size={26} strokeWidth={1.5} />
                          </span>
                          <span className="vf-product-code">
                            {p.code === "EXPRESS"
                              ? "Быстрое решение"
                              : p.collateral_required
                                ? "С обеспечением"
                                : "Без залога"}
                          </span>
                          <ArrowUpRight size={25} />
                        </div>
                        <h3>{p.name}</h3>
                        <p>{p.short}</p>
                        <div className="vf-product-bottom">
                          <div>
                            <span>Сумма до</span>
                            <b>{money(p.max_amount)}</b>
                          </div>
                          <div>
                            <span>Ставка от</span>
                            <strong>{p.base_rate}%</strong>
                          </div>
                        </div>
                        <div className="vf-product-tail">
                          <span>До {months(p.max_term)}</span>
                          <span>
                            Подробнее <ArrowRight size={16} />
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </SmoothHeight>
          {!products.length && !catalogError && (
            <p role="status" className="vf-note">
              Загружаем решения…
            </p>
          )}
          {catalogError && (
            <p className="vf-note">
              Не удалось загрузить каталог.{" "}
              <button onClick={() => window.location.reload()}>Обновить</button>
            </p>
          )}
          <p className="vf-note">
            Условия зависят от продукта и результатов проверки компании.
            Итоговое предложение — в кабинете.
          </p>
        </section>

        <section className="vf-process" id="how">
          <div className="vf-section">
            <FadeContent>
              <div className="vf-section-label">
                <span>02 / Как это работает</span>
                <span>Прозрачно на каждом шаге</span>
              </div>
              <div className="vf-section-heading">
                <h2>
                  Ближе к цели.
                  <br />
                  <em>Шаг за шагом.</em>
                </h2>
                <p>
                  Без догадок о том, что дальше.
                  <br />
                  Ваш путь всегда перед глазами.
                </p>
              </div>
            </FadeContent>
            <div className="vf-process-grid">
              <div
                className="vf-step-list"
                role="group"
                aria-label="Этапы финансирования"
              >
                {JOURNEY.map(({ n, title, text }, i) => (
                  <button
                    key={n}
                    aria-pressed={step === i}
                    onClick={() => setStep(i)}
                    className={step === i ? "active" : ""}
                  >
                    <span className="vf-step-number">{n}</span>
                    <div>
                      <h3>{title}</h3>
                      <AnimatePresence initial={false}>
                        {step === i && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                          >
                            {text}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <ArrowUpRight size={22} />
                  </button>
                ))}
              </div>
              <div className="vf-step-stage">
                <div className="vf-step-stage-top">
                  <span>ВЕКТОР / ВАШ ПУТЬ</span>
                  <span>0{step + 1} — 03</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    className="vf-step-scene"
                    initial={{ opacity: 0, y: 25, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                  >
                    {step === 0 ? (
                      <>
                        <div className="vf-scene-symbol">
                          <MessageCircle size={44} />
                        </div>
                        <span className="vf-scene-caption">
                          Всё начинается с задачи
                        </span>
                        <h3>
                          Что нужно
                          <br />
                          вашему делу?
                        </h3>
                        <div className="vf-goal-tags">
                          <span>Новая точка</span>
                          <span>Закупка товара</span>
                          <span>Оборудование</span>
                        </div>
                      </>
                    ) : step === 1 ? (
                      <>
                        <div className="vf-scene-symbol">
                          <ShieldCheck size={44} />
                        </div>
                        <span className="vf-scene-caption">
                          Данные собраны в одном месте
                        </span>
                        <h3>
                          Решение.
                          <br />
                          Всё по порядку.
                        </h3>
                        <div className="vf-live-checks">
                          {[
                            "Данные компании",
                            "Финансовые показатели",
                            "Условия финансирования",
                          ].map((t, i) => (
                            <motion.div
                              key={t}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.15 }}
                            >
                              <Check size={17} />
                              {t}
                            </motion.div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="vf-scene-symbol">
                          <ArrowUpRight size={44} />
                        </div>
                        <span className="vf-scene-caption">
                          Остаётся перейти к планам
                        </span>
                        <h3>
                          Всё готово.
                          <br />
                          Дело за вами.
                        </h3>
                        <div className="vf-goal-tags">
                          <span>
                            <FileCheck2 size={16} /> Договор онлайн
                          </span>
                          <span>
                            <Wallet size={16} /> Деньги на счёте
                          </span>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="vf-step-progress">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      aria-label={`Этап ${i + 1}`}
                      aria-pressed={step === i}
                    >
                      <motion.span
                        animate={{ scaleX: i <= step ? 1 : 0 }}
                        transition={{ duration: 0.5 }}
                      />
                    </button>
                  ))}
                </div>
                <small className="vf-stage-note">
                  Иллюстрация пути. Фактический статус — в кабинете.
                </small>
              </div>
            </div>
          </div>
        </section>

        <section className="vf-cabinet">
          <div className="vf-section">
            <div className="vf-section-label">
              <span>03 / Ваш кабинет</span>
              <span>Одно место. Полная картина.</span>
            </div>
            <div className="vf-cabinet-grid">
              <FadeContent className="vf-cabinet-copy">
                <h2>
                  Бизнес под
                  <br />
                  контролем.
                  <br />
                  <em>Планы — в движении.</em>
                </h2>
                <p>
                  Заявки, документы и платежи связаны между собой. Всё важное
                  видно сразу — и следующий шаг тоже.
                </p>
                <Link to={cabinet} className="st-button">
                  Открыть кабинет <ArrowUpRight size={20} />
                </Link>
                <span className="vf-cabinet-caption">
                  <ShieldCheck size={16} /> Ваши решения в одном пространстве
                </span>
              </FadeContent>
              <div className="vf-cabinet-demo">
                <div className="vf-demo-chrome">
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>ВЕКТОР / ЛИЧНЫЙ КАБИНЕТ</span>
                  <ShieldCheck size={16} />
                </div>
                <div
                  className="vf-demo-tabs"
                  role="group"
                  aria-label="Возможности кабинета"
                >
                  {[
                    ["status", "Заявка"],
                    ["payments", "Платежи"],
                    ["documents", "Документы"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      aria-pressed={preview === key}
                      onClick={() => setPreview(key)}
                    >
                      {preview === key && (
                        <motion.span layoutId="cabinet-preview" />
                      )}
                      <b>{label}</b>
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={preview}
                    className="vf-demo-body"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                  >
                    {preview === "status" ? (
                      <>
                        <span className="vf-demo-overline">
                          Кредит на развитие
                        </span>
                        <div className="vf-demo-amount">
                          <AnimatedNumber value={5000000} format={money} />
                        </div>
                        <div className="vf-demo-status">
                          <span /> Данные компании проверены
                        </div>
                        <div className="vf-demo-timeline">
                          {[
                            "Заявка принята",
                            "Проверка данных",
                            "Решение банка",
                          ].map((t, i) => (
                            <motion.div
                              key={t}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.12 }}
                            >
                              <span>{i < 2 ? <Check size={15} /> : 3}</span>
                              <div>
                                <b>{t}</b>
                                <small>
                                  {i < 2 ? "Готово" : "Следующий этап"}
                                </small>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </>
                    ) : preview === "payments" ? (
                      <>
                        <span className="vf-demo-overline">
                          Платёж в месяц · пример
                        </span>
                        <div className="vf-demo-amount">244 816 ₽</div>
                        <div className="vf-mini-chart">
                          {Array.from({ length: 12 }, (_, i) => (
                            <motion.div
                              key={i}
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ delay: i * 0.04, duration: 0.6 }}
                            >
                              <span style={{ height: `${76 + i * 1.5}%` }} />
                              <i style={{ height: `${24 - i * 1.5}%` }} />
                            </motion.div>
                          ))}
                        </div>
                        <div className="vf-mini-legend">
                          <span>
                            <i />
                            Основной долг
                          </span>
                          <span>
                            <i />
                            Проценты
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="vf-demo-overline">
                          Документы компании · пример
                        </span>
                        <h3>Всё на своих местах.</h3>
                        <div className="vf-demo-docs">
                          {[
                            "Бухгалтерская отчётность",
                            "Документы компании",
                            "Кредитный договор",
                          ].map((t, i) => (
                            <motion.div
                              key={t}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                            >
                              <FileText size={22} />
                              <span>
                                <b>{t}</b>
                                <small>
                                  {i === 2 ? "Готов к подписанию" : "Загружен"}
                                </small>
                              </span>
                              <Check size={17} />
                            </motion.div>
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
                <div className="vf-demo-foot">
                  Интерактивный пример · вымышленные данные
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="vf-section vf-faq-section" id="support">
          <FadeContent>
            <div className="vf-section-label">
              <span>04 / Вопросы и ответы</span>
              <span>Разберёмся вместе</span>
            </div>
            <div className="vf-section-heading">
              <h2>
                Хорошие вопросы.
                <br />
                <em>Понятные ответы.</em>
              </h2>
              <p>
                О финансировании —<br />
                простым языком.
              </p>
            </div>
          </FadeContent>
          <div className="vf-faq-layout">
            <div className="vf-question-card">
              <MessageCircle size={34} strokeWidth={1.5} />
              <h3>
                Ваша ситуация
                <br />
                особенная?
              </h3>
              <p>Обсудите её со специалистом в кабинете.</p>
              <Link to={cabinet}>
                Перейти в кабинет <ArrowUpRight size={20} />
              </Link>
            </div>
            <div className="vf-faq-list">
              {FAQ.map(([q, a], i) => (
                <div
                  key={q}
                  className={"vf-faq-row " + (openFaq === i ? "open" : "")}
                >
                  <h3>
                    <button
                      aria-expanded={openFaq === i}
                      aria-controls={`answer-${i}`}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      <span>0{i + 1}</span>
                      <b>{q}</b>
                      <motion.span
                        className="vf-faq-plus"
                        animate={{ rotate: openFaq === i ? 45 : 0 }}
                      >
                        +
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.div
                        id={`answer-${i}`}
                        className="vf-faq-answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <p>{a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="vf-final">
          <BrandField bright />
          <div className="vf-final-shade" />
          <FadeContent className="vf-final-copy">
            <span className="vx-eyebrow">Планам пора стать делом.</span>
            <h2>
              Дайте своему делу
              <br />
              <em>новый вектор.</em>
            </h2>
            <p>Следующая глава вашего бизнеса начинается с одного шага.</p>
            <Link to={apply} className="st-button">
              Начать с заявки <ArrowUpRight size={22} />
            </Link>
          </FadeContent>
          <div className="vf-final-foot">
            <span>ВЕКТОР / БИЗНЕС</span>
            <ArrowUpRight size={32} />
          </div>
        </section>
      </main>
      <footer className="st-footer st-wrap">
        <div className="st-footer-top">
          <Logo />
          <div>
            <button onClick={() => scrollToId("credits")}>
              Кредиты для бизнеса
            </button>
            <button onClick={() => scrollToId("how")}>Как это работает</button>
            <Link to={cabinet}>Личный кабинет</Link>
          </div>
          <button
            className="st-back-top"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              })
            }
          >
            Наверх <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="st-footer-bottom">
          <span>© 2026 Вектор. Прототип для хакатона.</span>
          <p>
            Данные синтетические. Внешние системы смоделированы.
            <br />
            Интерфейс создан в стилистике Альфа-Банка и не является официальным
            банковским сервисом.
          </p>
        </div>
      </footer>
    </div>
  );
}
