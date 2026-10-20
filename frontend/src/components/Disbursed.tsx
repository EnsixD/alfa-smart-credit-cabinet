import "./Disbursed.css";
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  FileText,
  Home,
  Percent,
  Wallet,
  X,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import BrandField from "./BrandField";
import { motion } from "motion/react";
import { api, dt, money, months } from "../api";
import { AnimatedNumber } from "../anim";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
const STAGE_STATUSES = [
  ["DRAFT"],
  ["SUBMITTED", "DATA_CHECK", "NEEDS_INFO"],
  ["ENRICHMENT", "SCORING", "DECISION", "MANUAL_REVIEW", "ESCALATED"],
  ["APPROVED", "COUNTER_OFFER"],
  ["SIGNING"],
  ["DISBURSING", "DISBURSED"],
];

function firstPayment(app: any) {
  const d = new Date(app.signing?.signed_at || app.updated_at);
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Полноэкранная анимация зачисления: красный круг раскрывается из центра на весь экран. */
export function DisburseOverlay({
  app,
  onClose,
}: {
  app: any;
  onClose: () => void;
}) {
  const nav = useNavigate();
  const [closing, setClosing] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    modal.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  const close = (after?: () => void) => {
    setClosing(true);
    setTimeout(() => {
      onClose();
      after?.();
    }, 650);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const o = app.offer;
  return createPortal(
    <div
      className={"payout" + (closing ? " closing" : "")}
      ref={modal}
      role="dialog"
      aria-modal="true"
      aria-label="Средства зачислены"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const buttons = Array.from(e.currentTarget.querySelectorAll("button"));
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      {/* фон раскрывается кругом из центра экрана, при закрытии — схлопывается обратно */}
      <motion.div
        className="payout-reveal"
        initial={{ clipPath: "circle(0% at 50% 50%)" }}
        animate={{ clipPath: closing ? "circle(0% at 50% 50%)" : "circle(150% at 50% 50%)" }}
        transition={closing ? { duration: 0.6, ease: [0.7, 0, 0.84, 0] } : { duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="payout-reveal-field"
          initial={{ opacity: 0, scale: 1.15 }}
          animate={{ opacity: closing ? 0 : 1, scale: 1 }}
          transition={{ duration: 1.4, delay: closing ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <BrandField className="vf-payout-field" bright />
        </motion.div>
        <div className="payout-reveal-glow" />
      </motion.div>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="payout-wave"
          initial={{ scale: 0, opacity: 0.55 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 1.6, delay: 0.1 + i * 0.22, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      <button className="payout-x" onClick={() => close()} aria-label="Закрыть">
        <X size={20} />
      </button>
      <motion.div
        className="payout-body"
        animate={closing ? { opacity: 0, scale: 0.94, filter: "blur(6px)" } : {}}
        transition={{ duration: 0.3 }}
      >
        <div className="payout-check">
          <svg viewBox="0 0 24 24" width="56" height="56">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </div>
        <div className="payout-eyebrow">
          Средства зачислены на расчётный счёт
        </div>
        <div className="payout-sum">
          +<AnimatedNumber value={o.amount} format={rub} duration={1.6} />
        </div>
        <div className="payout-sub">
          {app.company.name} · договор {app.signing?.contract_number}
        </div>
        <div className="payout-facts">
          <div>
            <span>Ежемесячный платёж</span>
            <b>{money(o.monthly_payment)}</b>
          </div>
          <div>
            <span>Ставка</span>
            <b>{o.rate}%</b>
          </div>
          <div>
            <span>Срок</span>
            <b>{months(o.term_months)}</b>
          </div>
          <div>
            <span>Первый платёж</span>
            <b>{firstPayment(app)}</b>
          </div>
        </div>
        <div className="payout-actions">
          <button
            className="btn payout-primary"
            onClick={() => close(() => nav("/cabinet/loans"))}
          >
            <CalendarDays size={18} /> График платежей
          </button>
          <button className="btn payout-ghost" onClick={() => close()}>
            <FileText size={18} /> Детали заявки
          </button>
          <button
            className="btn payout-ghost"
            onClick={() => close(() => nav("/cabinet"))}
          >
            <Home size={18} /> На главную
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/** Итоговый экран выданной заявки: всё на одном экране, без прокрутки. */
export function DisbursedView({
  app,
  onReplay,
  onDetails,
}: {
  app: any;
  onReplay: () => void;
  onDetails: () => void;
}) {
  const nav = useNavigate();
  const o = app.offer;
  const at = (codes: string[]) =>
    [...app.timeline].reverse().find((t: any) => codes.includes(t.to_status))
      ?.created_at;
  const openSchedule = async () => {
    const company = await api("/api/company");
    const loan = company.loans.find(
      (l: any) => String(l.application_id) === String(app.id),
    );
    nav(loan ? `/cabinet/loans/${loan.id}` : "/cabinet/loans");
  };
  return (
    <div className="vx-issued">
      <section className="vx-issued-main">
        <div className="vx-issued-field" aria-hidden="true">
          <BrandField />
        </div>
        <div className="vx-issued-content">
          <div className="vx-issued-check">
            <CircleCheck size={30} />
          </div>
          <span className="vx-eyebrow">Готово. Можно действовать.</span>
          <h1>
            Деньги уже
            <br />
            работают на вас.
          </h1>
          <p>Зачислено на расчётный счёт компании</p>
          <div className="vx-issued-sum">
            <AnimatedNumber value={o.amount} format={money} duration={1.1} />
          </div>
          <span className="vx-issued-company">{app.company.name}</span>
          <div className="vx-issued-facts">
            <div>
              <span>Платёж в месяц</span>
              <b>{money(o.monthly_payment)}</b>
            </div>
            <div>
              <span>Ставка</span>
              <b>{o.rate}%</b>
            </div>
            <div>
              <span>Первый платёж</span>
              <b>{firstPayment(app)}</b>
            </div>
            <div>
              <span>Договор</span>
              <b>{app.signing?.contract_number}</b>
            </div>
          </div>
          <div className="vx-issued-actions">
            <button className="st-button" onClick={openSchedule}>
              Открыть график <ArrowRight size={18} />
            </button>
            <button className="vx-secondary" onClick={onDetails}>
              Проверки и история
            </button>
            <button
              className="vx-replay"
              onClick={onReplay}
              aria-label="Повторить анимацию зачисления"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </section>
      <aside className="vx-issued-route">
        <span className="vx-eyebrow">Путь к результату</span>
        <h2>Всё получилось.</h2>
        <p>Заявка {app.number}</p>
        <ol>
          {app.status.stages.map((s: string, i: number) => (
            <motion.li
              key={s}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
            >
              <CircleCheck size={20} />
              <div>
                <b>{s}</b>
                <small>{dt(at(STAGE_STATUSES[i]))}</small>
              </div>
            </motion.li>
          ))}
        </ol>
        <div className="vx-issued-foot">
          {months(o.term_months)}
          <br />
          {o.product_name}
        </div>
      </aside>
    </div>
  );
}
