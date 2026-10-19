import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AnimatedNumber } from "../anim";
import { api, money, months } from "../api";
import SiteHeader from "../components/SiteHeader";
import SpotlightCard from "../components/reactbits/SpotlightCard";
import { homeOf, useAuth } from "../auth";

type Payment = {
  n: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  rest: number;
};
const ruDate = (v: string) =>
  new Date(v).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function amortize(amount: number, rate: number, term: number): Payment[] {
  const r = rate / 1200;
  const p = r ? (amount * r) / (1 - Math.pow(1 + r, -term)) : amount / term;
  let rest = amount;
  const base = new Date();
  base.setDate(1);
  return Array.from({ length: term }, (_, i) => {
    const date = new Date(base.getFullYear(), base.getMonth() + i + 1, 1);
    const interest = Math.round(rest * r * 100) / 100;
    const principal =
      i === term - 1
        ? Math.round(rest * 100) / 100
        : Math.round((p - interest) * 100) / 100;
    rest = Math.max(0, Math.round((rest - principal) * 100) / 100);
    return {
      n: i + 1,
      date: date.toISOString(),
      payment: Math.round((principal + interest) * 100) / 100,
      principal,
      interest,
      rest,
    };
  });
}
function exportSchedule(rows: Payment[], name: string) {
  const text =
    "\ufeff" +
    [
      "№;Дата;Платёж;Основной долг;Проценты;Остаток",
      ...rows.map((r) =>
        [
          r.n,
          new Date(r.date).toLocaleDateString("ru-RU"),
          r.payment,
          r.principal,
          r.interest,
          r.rest,
        ].join(";"),
      ),
    ].join("\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PaymentSchedule({
  rows,
  planned = false,
}: {
  rows: Payment[];
  planned?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState("chart");
  const [page, setPage] = useState(0);
  const modeId = useId();
  const reduce = useReducedMotion();
  const index = Math.min(selected, Math.max(0, rows.length - 1));
  const chosen = rows[index];
  const max = Math.max(1, ...rows.map((r) => r.payment));
  const group = Math.max(1, Math.ceil(rows.length / 36));
  const sampled = rows.filter((_, i) => i % group === 0);
  const total = rows.reduce((s, r) => s + r.payment, 0);
  const interest = rows.reduce((s, r) => s + r.interest, 0);
  useEffect(() => {
    setSelected(0);
    setPage(0);
  }, [rows.length]);
  if (!chosen)
    return <div className="cr-empty">График платежей пока не сформирован.</div>;
  return (
    <section className="cr-schedule">
      <header>
        <div>
          <span className="st-kicker">Деньги в деталях</span>
          <h2>График платежей</h2>
        </div>
        <button
          className="cr-download"
          onClick={() => exportSchedule(rows, "payment-schedule.csv")}
        >
          <Download size={17} /> Скачать CSV
        </button>
      </header>
      <div className="cr-schedule-summary">
        <div>
          <span>Всего выплат по графику</span>
          <b>
            <AnimatedNumber value={total} format={money} duration={0.35} />
          </b>
        </div>
        <div>
          <span>Проценты за весь срок</span>
          <b>
            <AnimatedNumber value={interest} format={money} duration={0.35} />
          </b>
        </div>
        <div>
          <span>Количество платежей</span>
          <b>{rows.length}</b>
        </div>
      </div>
      <div className="st-filters" role="group" aria-label="Вид графика">
        <button
          className={mode === "chart" ? "active" : ""}
          aria-pressed={mode === "chart"}
          onClick={() => setMode("chart")}
        >
          {mode === "chart" && (
            <motion.span
              layoutId={modeId}
              className="vx-chart-mode-active"
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              aria-hidden="true"
            />
          )}
          <span>Диаграмма</span>
        </button>
        <button
          className={mode === "table" ? "active" : ""}
          aria-pressed={mode === "table"}
          onClick={() => setMode("table")}
        >
          {mode === "table" && (
            <motion.span
              layoutId={modeId}
              className="vx-chart-mode-active"
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              aria-hidden="true"
            />
          )}
          <span>Таблица платежей</span>
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className="vx-schedule-view"
          initial={{
            opacity: 0,
            y: reduce ? 0 : 14,
            filter: reduce ? "none" : "blur(3px)",
          }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: reduce ? 0 : -8 }}
          transition={{ duration: reduce ? 0 : 0.23 }}
        >
          {mode === "chart" ? (
            <>
              <div className="cr-chart-legend">
                <span>
                  <i />
                  Основной долг
                </span>
                <span>
                  <i />
                  Проценты
                </span>
                <small>Выберите месяц на графике</small>
              </div>
              <div className="cr-chart">
                <div className="cr-chart-axis">
                  <span>{money(max)}</span>
                  <span>{money(max / 2)}</span>
                  <span>0 ₽</span>
                </div>
                <div className="cr-bars">
                  {sampled.map((r, i) => {
                    const actual = rows.indexOf(r);
                    return (
                      <button
                        key={r.n}
                        className={index === actual ? "chosen" : ""}
                        onMouseEnter={() => setSelected(actual)}
                        onFocus={() => setSelected(actual)}
                        onClick={() => setSelected(actual)}
                        aria-label={`Платёж ${r.n}: ${money(r.payment)}, проценты ${money(r.interest)}`}
                      >
                        <motion.span
                          className="cr-bar-stack"
                          initial={{ scaleY: reduce ? 1 : 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{
                            duration: reduce ? 0 : 0.65,
                            delay: reduce ? 0 : i * 0.025,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          style={{ height: `${(r.payment / max) * 100}%` }}
                        >
                          <i
                            className="cr-bar-interest"
                            style={{
                              height: `${(r.interest / r.payment) * 100}%`,
                            }}
                          />
                          <i
                            className="cr-bar-principal"
                            style={{
                              height: `${(r.principal / r.payment) * 100}%`,
                            }}
                          />
                        </motion.span>
                        {(i === 0 ||
                          i === sampled.length - 1 ||
                          i % Math.ceil(sampled.length / 6) === 0) && (
                          <small>{r.n}</small>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="cr-month-detail">
                <div className="cr-month-controls">
                  <button
                    onClick={() => setSelected(Math.max(0, index - 1))}
                    disabled={index === 0}
                    aria-label="Предыдущий платёж"
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <div>
                    <span>
                      Платёж {chosen.n} из {rows.length}
                    </span>
                    <b>{ruDate(chosen.date)}</b>
                  </div>
                  <button
                    onClick={() =>
                      setSelected(Math.min(rows.length - 1, index + 1))
                    }
                    disabled={index === rows.length - 1}
                    aria-label="Следующий платёж"
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
                <div>
                  <span>К оплате</span>
                  <b>
                    <AnimatedNumber
                      value={chosen.payment}
                      format={money}
                      duration={0.35}
                    />
                  </b>
                </div>
                <div>
                  <span>Основной долг</span>
                  <b>
                    <AnimatedNumber
                      value={chosen.principal}
                      format={money}
                      duration={0.35}
                    />
                  </b>
                </div>
                <div>
                  <span>Проценты</span>
                  <b>
                    <AnimatedNumber
                      value={chosen.interest}
                      format={money}
                      duration={0.35}
                    />
                  </b>
                </div>
                <div>
                  <span>Остаток после платежа</span>
                  <b>
                    <AnimatedNumber
                      value={chosen.rest}
                      format={money}
                      duration={0.35}
                    />
                  </b>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="cr-table-wrap">
                <table>
                  <caption className="sr-only">
                    Плановый график платежей
                  </caption>
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Дата</th>
                      <th>Платёж</th>
                      <th>Основной долг</th>
                      <th>Проценты</th>
                      <th>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(page * 12, page * 12 + 12).map((r) => (
                      <motion.tr
                        key={r.n}
                        initial={{ opacity: 0, x: reduce ? 0 : 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: reduce ? 0 : 0.25,
                          delay: reduce ? 0 : (r.n % 12) * 0.025,
                        }}
                      >
                        <td>{r.n}</td>
                        <td>{ruDate(r.date)}</td>
                        <td>{money(r.payment)}</td>
                        <td>{money(r.principal)}</td>
                        <td>{money(r.interest)}</td>
                        <td>{money(r.rest)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cr-table-pages">
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={17} /> Назад
                </button>
                <span>
                  {page + 1} / {Math.ceil(rows.length / 12)}
                </span>
                <button
                  disabled={(page + 1) * 12 >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  Далее <ChevronRight size={17} />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="cr-disclaimer">
        {planned
          ? "Предварительный расчёт по аннуитетной модели. Для овердрафта и карты фактический график зависит от использования лимита. Точные условия и даты платежей будут указаны в договоре."
          : "Плановый график по договору. Остаток рассчитан после каждого платежа; эти данные не подтверждают фактическое погашение."}
      </p>
    </section>
  );
}
export function ProductDetails() {
  const { code } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState(1000000);
  const [term, setTerm] = useState(12);
  useEffect(() => {
    window.scrollTo(0, 0);
    setProduct(null);
    setErr("");
    api("/api/catalog/products")
      .then((ps: any[]) => {
        const p = ps.find((p) => p.code === code);
        if (!p) {
          setErr("Такого продукта нет в каталоге.");
          return;
        }
        setProduct(p);
        setAmount(Math.min(p.max_amount, Math.max(p.min_amount, 3000000)));
        setTerm(Math.min(p.max_term, Math.max(p.min_term, 24)));
      })
      .catch((e) => setErr(e.message));
  }, [code]);
  const rows = useMemo(
    () => (product ? amortize(amount, product.base_rate, term) : []),
    [product, amount, term],
  );
  const apply = user
    ? user.role === "CLIENT"
      ? "/cabinet/new"
      : homeOf(user)
    : "/login";
  return (
    <div className="studio-site">
      <SiteHeader />
      <main className="st-wrap cr-public">
        <Link to="/#credits" className="cr-back">
          <ArrowLeft size={17} /> Все кредитные решения
        </Link>
        {err ? (
          <div className="cr-empty">{err}</div>
        ) : !product ? (
          <div className="cr-empty" role="status">
            Загружаем условия кредита…
          </div>
        ) : (
          <>
            <div className="cr-product-hero">
              <div>
                <span className="st-kicker">
                  Финансирование / {product.code}
                </span>
                <h1>{product.name}</h1>
                <p>{product.description || product.short}</p>
                <Link to={apply} className="st-button">
                  Подать заявку <ArrowUpRight size={20} />
                </Link>
              </div>
              <SpotlightCard
                theme="light"
                spotlightColor="rgba(239,49,36,.16)"
                className="cr-product-key"
              >
                <span>Возможности вашего бизнеса</span>
                <b>до {money(product.max_amount)}</b>
                <div>
                  <span>
                    Ставка от <strong>{product.base_rate}%</strong>
                  </span>
                  <span>
                    Срок до <strong>{months(product.max_term)}</strong>
                  </span>
                </div>
                <ShieldCheck size={32} />
              </SpotlightCard>
            </div>
            <div className="cr-product-rules">
              <div>
                <CalendarDays size={22} />
                <b>Срок работы компании</b>
                <span>От {months(product.min_business_age_months)}</span>
              </div>
              <div>
                <ShieldCheck size={22} />
                <b>Обеспечение</b>
                <span>
                  {product.collateral_required
                    ? "Потребуется залог"
                    : "Без обязательного залога"}
                </span>
              </div>
              <div>
                <FileCheck2 size={22} />
                <b>Рассмотрение</b>
                <span>
                  {product.decision_time || "После проверки данных компании"}
                </span>
              </div>
            </div>
            <section className="cr-calculator">
              <div>
                <span className="st-kicker">Под ваши планы</span>
                <h2>Рассчитайте свой шаг</h2>
                <p>
                  Посмотрите примерный платёж и структуру выплат. Расчёт не
                  требует подачи заявки.
                </p>
              </div>
              <div className="cr-sliders">
                <label>
                  <span>
                    Сумма кредита <b>{money(amount)}</b>
                  </span>
                  <input
                    type="range"
                    aria-label="Сумма кредита"
                    min={product.min_amount}
                    max={product.max_amount}
                    step={Math.max(
                      1000,
                      Math.round(
                        (product.max_amount - product.min_amount) / 200 / 1000,
                      ) * 1000,
                    )}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                  <small>
                    <span>{money(product.min_amount)}</span>
                    <span>{money(product.max_amount)}</span>
                  </small>
                </label>
                <label>
                  <span>
                    Срок <b>{months(term)}</b>
                  </span>
                  <input
                    type="range"
                    aria-label="Срок кредита"
                    min={product.min_term}
                    max={product.max_term}
                    value={term}
                    onChange={(e) => setTerm(Number(e.target.value))}
                  />
                  <small>
                    <span>{months(product.min_term)}</span>
                    <span>{months(product.max_term)}</span>
                  </small>
                </label>
                <div className="cr-calculated">
                  <span>Предварительный платёж в месяц</span>
                  <b>{money(rows[0]?.payment)}</b>
                </div>
              </div>
            </section>
            <PaymentSchedule rows={rows} planned />
            <section className="cr-requirements">
              <h2>Что понадобится</h2>
              {product.required_docs?.length ? (
                <ul>
                  {product.required_docs.map((d: any) => (
                    <li key={d.type}>
                      <FileCheck2 size={20} />
                      {d.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  Используем данные компании, счёта и государственных реестров.
                  Если потребуется уточнение, сообщим в кабинете.
                </p>
              )}
              <Link to={apply} className="st-button">
                Перейти к оформлению <ArrowUpRight size={19} />
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
export function LoanDetails() {
  const { id } = useParams();
  const [loan, setLoan] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    window.scrollTo(0, 0);
    api("/api/company")
      .then((d) => {
        const l = d.loans.find((l: any) => String(l.id) === id);
        if (l) setLoan(l);
        else setErr("Кредит не найден в вашей компании.");
      })
      .catch((e) => setErr(e.message));
  }, [id]);
  return (
    <div className="page cr-loan-detail">
      <Link to="/cabinet/loans" className="cr-back">
        <ArrowLeft size={17} /> Все мои кредиты
      </Link>
      {err ? (
        <div className="cr-empty">{err}</div>
      ) : !loan ? (
        <div className="cr-empty" role="status">
          Загружаем договор и график…
        </div>
      ) : (
        <>
          <div className="cr-loan-heading">
            <div>
              <span className="st-kicker">
                Договор / {loan.contract_number}
              </span>
              <h1>Ваш кредит в деталях</h1>
              <p>Выдан {ruDate(loan.disbursed_at)}</p>
            </div>
            <Link
              className="cr-related"
              to={`/cabinet/applications/${loan.application_id}`}
            >
              Открыть заявку <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="cr-loan-stats">
            <SpotlightCard
              className="cr-loan-balance"
              spotlightColor="rgba(255,255,255,.15)"
            >
              <Wallet size={24} />
              <span>Первоначальная сумма</span>
              <b>{money(loan.amount)}</b>
              <small>Договор {loan.contract_number}</small>
            </SpotlightCard>
            <div>
              <span>Ежемесячный платёж</span>
              <b>{money(loan.monthly_payment)}</b>
              <small>По графику договора</small>
            </div>
            <div>
              <span>Процентная ставка</span>
              <b>{loan.rate}%</b>
              <small>Годовых</small>
            </div>
            <div>
              <span>Срок кредита</span>
              <b>{months(loan.term_months)}</b>
              <small>{loan.schedule?.length || 0} платежей</small>
            </div>
          </div>
          <PaymentSchedule rows={loan.schedule || []} />
        </>
      )}
    </div>
  );
}
