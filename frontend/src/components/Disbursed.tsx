import { ArrowRight, CalendarDays, CircleCheck, FileText, Home, Percent, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { dt, money, months } from "../api";
import { AnimatedNumber } from "../anim";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
const STAGE_STATUSES = [["DRAFT"], ["SUBMITTED", "DATA_CHECK", "NEEDS_INFO"], ["ENRICHMENT", "SCORING", "DECISION", "MANUAL_REVIEW", "ESCALATED"], ["APPROVED", "COUNTER_OFFER"], ["SIGNING"], ["DISBURSING", "DISBURSED"]];

function firstPayment(app: any) {
  const d = new Date(app.signing?.signed_at || app.updated_at);
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/** Полноэкранная анимация зачисления: красный круг раскрывается из центра на весь экран. */
export function DisburseOverlay({ app, onClose }: { app: any; onClose: () => void }) {
  const nav = useNavigate();
  const [closing, setClosing] = useState(false);
  const close = (after?: () => void) => { setClosing(true); setTimeout(() => { onClose(); after?.(); }, 380); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const o = app.offer;
  return createPortal(
    <div className={"payout" + (closing ? " closing" : "")} role="dialog" aria-modal="true">
      <div className="payout-burst" />
      <div className="payout-rings"><i /><i /><i /></div>
      <button className="payout-x" onClick={() => close()} aria-label="Закрыть"><X size={20} /></button>
      <div className="payout-body">
        <div className="payout-check"><svg viewBox="0 0 24 24" width="56" height="56"><path d="M5 12.5l4.2 4.2L19 7" /></svg></div>
        <div className="payout-eyebrow">Средства зачислены на расчётный счёт</div>
        <div className="payout-sum">+<AnimatedNumber value={o.amount} format={rub} duration={1.6} /></div>
        <div className="payout-sub">{app.company.name} · договор {app.signing?.contract_number}</div>
        <div className="payout-facts">
          <div><span>Ежемесячный платёж</span><b>{money(o.monthly_payment)}</b></div>
          <div><span>Ставка</span><b>{o.rate}%</b></div>
          <div><span>Срок</span><b>{months(o.term_months)}</b></div>
          <div><span>Первый платёж</span><b>{firstPayment(app)}</b></div>
        </div>
        <div className="payout-actions">
          <button className="btn payout-primary" onClick={() => close(() => nav("/?schedule=1"))}><CalendarDays size={18} /> График платежей</button>
          <button className="btn payout-ghost" onClick={() => close()}><FileText size={18} /> Детали заявки</button>
          <button className="btn payout-ghost" onClick={() => close(() => nav("/"))}><Home size={18} /> На главную</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Итоговый экран выданной заявки: всё на одном экране, без прокрутки. */
export function DisbursedView({ app, onReplay, onDetails }: { app: any; onReplay: () => void; onDetails: () => void }) {
  const nav = useNavigate();
  const o = app.offer;
  const at = (codes: string[]) => [...app.timeline].reverse().find((t: any) => codes.includes(t.to_status))?.created_at;
  return (
    <div className="done">
      <section className="done-hero">
        <div className="done-glow" />
        <div className="done-top">
          <div className="done-check"><CircleCheck size={28} /></div>
          <div><div className="eyebrow" style={{ color: "rgba(255,255,255,.7)", margin: 0 }}>Заявка {app.number} · {app.product_name}</div><div className="done-title">Деньги на счёте</div></div>
        </div>
        <div className="done-sum">{money(o.amount)}</div>
        <div className="done-facts">
          <div><Wallet size={18} /><span>Платёж в месяц</span><b>{money(o.monthly_payment)}</b></div>
          <div><Percent size={18} /><span>Ставка</span><b>{o.rate}%</b></div>
          <div><CalendarDays size={18} /><span>Первый платёж</span><b>{firstPayment(app)}</b></div>
          <div><FileText size={18} /><span>Договор</span><b>{app.signing?.contract_number}</b></div>
        </div>
        <div className="done-actions">
          <button className="btn done-primary" onClick={() => nav("/?schedule=1")}>График платежей <ArrowRight size={16} /></button>
          <button className="btn done-ghost" onClick={onDetails}>Проверки и история</button>
          <button className="btn done-ghost" onClick={onReplay}>Показать зачисление ещё раз</button>
        </div>
      </section>
      <aside className="done-steps">
        <div className="eyebrow">Путь заявки</div>
        <h2 style={{ margin: "0 0 6px" }}>Все этапы пройдены</h2>
        <ol>
          {app.status.stages.map((s: string, i: number) => (
            <li key={s}><span className="ds-dot"><CircleCheck size={16} /></span><div><b>{s}</b><small>{dt(at(STAGE_STATUSES[i]))}</small></div></li>
          ))}
        </ol>
        <div className="ds-foot"><span>{months(o.term_months)} · {o.product_name}</span></div>
      </aside>
    </div>
  );
}
