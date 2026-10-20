import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CircleCheck,
  ClipboardCheck,
  FileText,
  Loader,
  MessageSquare,
  PenLine,
  Scale,
  ScanSearch,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, dt, money, months, statusTone } from "../api";
import { AnimatedNumber } from "../anim";
import { CHECK_TITLES } from "./Status";
import BlurText from "./reactbits/BlurText";
import "./Tracker.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const LIVE = ["SUBMITTED", "DATA_CHECK", "ENRICHMENT", "SCORING", "DECISION", "DISBURSING"];
const STAGE_ICONS = [FileText, ClipboardCheck, ScanSearch, Scale, PenLine, Banknote];
const STAGE_STATUSES = [
  ["DRAFT"],
  ["SUBMITTED", "DATA_CHECK", "NEEDS_INFO"],
  ["ENRICHMENT", "SCORING", "DECISION", "MANUAL_REVIEW", "ESCALATED"],
  ["APPROVED", "COUNTER_OFFER", "REJECTED"],
  ["SIGNING"],
  ["DISBURSING", "DISBURSED"],
];
// к какому этапу относится проверка
const CHECK_STAGE: Record<string, number> = { COMPLETENESS: 1, EGRUL: 2, FNS: 2, BKI: 2, INTERNAL: 2 };
const CHECK_UI: Record<string, { tone: string; label: string; icon: any }> = {
  OK: { tone: "ok", label: "Пройдена", icon: CircleCheck },
  WARN: { tone: "warn", label: "Есть замечания", icon: AlertTriangle },
  FAIL: { tone: "bad", label: "Не пройдена", icon: XCircle },
  UNAVAILABLE: { tone: "muted", label: "Недоступно", icon: ShieldAlert },
};

type Issue = { tone: "warn" | "bad"; title: string; text: string; source: string; stage: number; icon: any };

function collectIssues(app: any): Issue[] {
  const out: Issue[] = [];
  for (const t of app.tasks.filter((t: any) => t.status === "OPEN"))
    out.push({ tone: "warn", title: t.title, text: t.description, source: `Запрос: ${t.created_by}`, stage: 1, icon: t.kind === "DOCUMENT" ? FileText : MessageSquare });
  for (const c of app.checks.filter((c: any) => c.status === "WARN" || c.status === "FAIL"))
    out.push({ tone: c.status === "FAIL" ? "bad" : "warn", title: CHECK_TITLES[c.source] || c.source, text: c.summary, source: CHECK_UI[c.status].label, stage: CHECK_STAGE[c.source] ?? 2, icon: CHECK_UI[c.status].icon });
  const s = app.status.code;
  if ((s === "REJECTED" || s === "COUNTER_OFFER") && app.decision?.reasons?.length)
    for (const r of app.decision.reasons)
      out.push({ tone: s === "REJECTED" ? "bad" : "warn", title: s === "REJECTED" ? "Причина отказа" : "Почему условия изменены", text: r, source: "Решение банка", stage: 3, icon: s === "REJECTED" ? XCircle : Scale });
  return out;
}

function stageState(app: any, i: number) {
  const st = app.status;
  const failed = st.code === "REJECTED" || st.code === "CANCELLED";
  if (i < st.stage) return "done";
  if (i === st.stage) {
    if (st.final && !failed) return "done";
    if (failed) return "failed";
    if (st.code === "NEEDS_INFO" || st.code === "COUNTER_OFFER") return "warn";
    return "current";
  }
  return "todo";
}

function stageTime(app: any, i: number) {
  const ev = app.timeline.find((t: any) => STAGE_STATUSES[i].includes(t.to_status));
  return ev ? dt(ev.created_at) : i === 0 ? dt(app.created_at) : null;
}

function StageRail({ app, issues }: { app: any; issues: Issue[] }) {
  const stages: string[] = app.status.stages;
  const pct = Math.min(100, (app.status.stage / (stages.length - 1)) * 100);
  return (
    <div className="tr-rail">
      <div className="tr-rail-line"><motion.i initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }} /></div>
      {stages.map((name, i) => {
        const state = stageState(app, i);
        const Icon = STAGE_ICONS[i] || Sparkles;
        const n = issues.filter((x) => x.stage === i).length;
        const bad = issues.some((x) => x.stage === i && x.tone === "bad");
        const time = stageTime(app, i);
        return (
          <motion.div key={name} className={"tr-stage " + state + " is-" + state} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i, duration: 0.4, ease: EASE }}>
            <span className="tr-node">
              {state === "current" && <span className="tr-node-pulse" />}
              {state === "done" ? <Check size={18} strokeWidth={3} /> : state === "failed" ? <X size={18} strokeWidth={3} /> : state === "current" ? <Loader size={18} className="spin-ico" /> : state === "warn" ? <AlertTriangle size={18} /> : <Icon size={18} />}
              {n > 0 && <motion.em className={bad ? "is-bad" : ""} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.5 }}>{n}</motion.em>}
            </span>
            <b>{name}</b>
            <small>{state === "current" ? "сейчас" : state === "warn" ? "нужно ваше действие" : state === "failed" ? "остановлено" : time || "впереди"}</small>
            {n > 0 && <span className={"tr-stage-flag " + (bad ? "is-bad" : "is-warn")}>{n} {n === 1 ? "замечание" : n < 5 ? "замечания" : "замечаний"}</span>}
          </motion.div>
        );
      })}
    </div>
  );
}

function Attention({ app, issues }: { app: any; issues: Issue[] }) {
  const bad = issues.some((i) => i.tone === "bad");
  const recs: string[] = app.status.code === "REJECTED" ? app.decision?.recommendations || [] : [];
  if (!issues.length) {
    if (!app.checks.length) return null;
    return (
      <motion.section className="tr-attn is-clean" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
        <span className="tr-attn-ico"><ShieldCheck size={22} /></span>
        <div><h2>Замечаний нет</h2><p>Все проверки пройдены — от вас сейчас ничего не требуется.</p></div>
      </motion.section>
    );
  }
  return (
    <motion.section className={"tr-attn " + (bad ? "is-bad" : "is-warn")} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
      <div className="tr-attn-head">
        <span className="tr-attn-ico">{bad ? <XCircle size={22} /> : <AlertTriangle size={22} />}</span>
        <div>
          <h2>{bad ? "Есть серьёзные замечания" : "Требует вашего внимания"}</h2>
          <p>{issues.length} {issues.length === 1 ? "пункт" : issues.length < 5 ? "пункта" : "пунктов"} · разберите их, чтобы заявка двигалась дальше</p>
        </div>
      </div>
      <motion.ul className="tr-issues" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}>
        {issues.map((x, i) => (
          <motion.li key={i} className={"is-" + x.tone} variants={{ h: { opacity: 0, x: -10 }, s: { opacity: 1, x: 0 } }}>
            <span className="ii"><x.icon size={17} /></span>
            <div><b>{x.title}</b><p>{x.text}</p></div>
            <small>{x.source}</small>
          </motion.li>
        ))}
      </motion.ul>
      {recs.length > 0 && (
        <div className="tr-recs">
          <b><Sparkles size={15} /> Что поможет</b>
          {recs.map((r) => <div key={r}><ArrowRight size={14} /> {r}</div>)}
          <Link to="/cabinet/new" className="tr-btn">Подобрать другой вариант <ArrowRight size={16} /></Link>
        </div>
      )}
    </motion.section>
  );
}

function Checks({ app }: { app: any }) {
  if (!app.checks.length)
    return (
      <section className="tr-card">
        <div className="tr-card-head"><h3>Проверки</h3></div>
        <div className="tr-wait"><Loader size={16} className="spin-ico" /> Проверки начнутся сразу после отправки</div>
      </section>
    );
  const order = { FAIL: 0, WARN: 1, UNAVAILABLE: 2, OK: 3 } as Record<string, number>;
  const list = [...app.checks].sort((a, b) => order[a.status] - order[b.status]);
  const ok = app.checks.filter((c: any) => c.status === "OK").length;
  return (
    <section className="tr-card">
      <div className="tr-card-head"><h3>Проверки</h3><span className="tr-count">{ok} из {app.checks.length} пройдено</span></div>
      <div className="tr-checks">
        {list.map((c: any, i: number) => {
          const ui = CHECK_UI[c.status] || CHECK_UI.UNAVAILABLE;
          return (
            <motion.div key={c.source + i} className={"tr-check is-" + ui.tone} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.35 }}>
              <span className="ci"><ui.icon size={17} /></span>
              <div><b>{CHECK_TITLES[c.source] || c.source}</b><p>{c.summary}</p></div>
              <em>{ui.label}</em>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function Score({ se }: { se: any }) {
  return (
    <section className="tr-card">
      <div className="tr-card-head"><h3>Что повлияло на оценку</h3></div>
      <div className="tr-score">
        <div className="pos"><b><ThumbsUp size={15} /> Помогло</b>{se.positive.map((x: string) => <span key={x}><Check size={14} /> {x}</span>)}</div>
        <div className="neg"><b><ThumbsDown size={15} /> Снизило оценку</b>{se.negative.length ? se.negative.map((x: string) => <span key={x}><X size={14} /> {x}</span>) : <span className="none">Ничего — отличный результат</span>}</div>
      </div>
    </section>
  );
}

function Chat({ app, reload }: { app: any; reload: () => void }) {
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [app.messages.length]);
  const send = async () => {
    if (!text.trim()) return;
    await api(`/api/applications/${app.id}/messages`, { body: { text } });
    setText("");
    reload();
  };
  return (
    <section className="tr-card">
      <div className="tr-card-head"><h3>Связь с банком</h3><span className="tr-count">{app.messages.length}</span></div>
      <div className="tr-chat" ref={box}>
        {!app.messages.length && <p className="tr-empty"><MessageSquare size={16} /> Задайте вопрос — ответит кредитный специалист</p>}
        <AnimatePresence initial={false}>
          {app.messages.map((m: any) => (
            <motion.div key={m.id} className={"tr-msg " + (m.author_role === "CLIENT" ? "me" : "bank")} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
              <small>{m.author_name} · {dt(m.created_at)}</small>
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="tr-send">
        <input aria-label="Сообщение банку" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение банку" />
        <button onClick={send} disabled={!text.trim()} aria-label="Отправить"><Send size={16} /></button>
      </div>
    </section>
  );
}

function History({ app }: { app: any }) {
  const [all, setAll] = useState(false);
  const items = [...app.timeline].reverse();
  const shown = all ? items : items.slice(0, 6);
  return (
    <section className="tr-card">
      <div className="tr-card-head"><h3>История</h3>{LIVE.includes(app.status.code) && <span className="tr-live"><i /> online</span>}</div>
      <ol className="tr-history">
        <AnimatePresence initial={false}>
          {shown.map((t: any, i: number) => {
            const tone = t.to_status ? statusTone(t.to_status) : "info";
            return (
              <motion.li key={t.id} className={"is-" + tone + (i === 0 ? " first" : "")} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <span className="tr-dot" />
                <b>{t.title}</b>
                {t.message && t.message !== t.title && <p>{t.message}</p>}
                <small>{t.actor} · {dt(t.created_at)}</small>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      {items.length > 6 && <button className="tr-more" onClick={() => setAll(!all)}>{all ? "Свернуть" : `Показать все · ${items.length}`}</button>}
    </section>
  );
}

/** Экран слежения за заявкой: этапы, замечания, проверки, связь и история. */
export default function Tracker({ app, reload, actions, onBackToResult }: { app: any; reload: () => void; actions?: ReactNode; onBackToResult?: () => void }) {
  const s = app.status.code;
  const live = LIVE.includes(s);
  const tone = statusTone(s);
  const issues = collectIssues(app);
  const o = app.offer;
  return (
    <div className="tr">
      <div className="tr-top">
        <Link to="/cabinet/applications" className="tr-back"><ArrowLeft size={15} /> Все заявки</Link>
        {onBackToResult && <button className="tr-back" onClick={onBackToResult}>К итогам выдачи <ArrowRight size={15} /></button>}
      </div>

      <motion.header className={"tr-hero is-" + tone} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="tr-hero-main">
          <span className="tr-eyebrow">Заявка {app.number}</span>
          <BlurText key={app.product_name} text={app.product_name || "Заявка на кредит"} className="tr-h1" animateBy="words" delay={30} stepDuration={0.2} trigger="load" />
          <div className="tr-meta">
            <span><AnimatedNumber value={o?.amount || app.amount} format={money} duration={0.8} /></span>
            <span>{months(o?.term_months || app.term_months)}</span>
            {o && <span>{o.rate}%</span>}
            {o && <span>{money(o.monthly_payment)} / мес</span>}
            {app.purpose_title && <span>{app.purpose_title}</span>}
          </div>
        </div>
        <div className={"tr-now is-" + tone}>
          <span className="tr-now-ico">{live ? <Loader size={20} className="spin-ico" /> : tone === "ok" ? <CircleCheck size={20} /> : tone === "bad" ? <XCircle size={20} /> : tone === "warn" ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}</span>
          <div>
            <small>Сейчас</small>
            <AnimatePresence mode="wait">
              <motion.b key={s} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{app.status.title}</motion.b>
            </AnimatePresence>
            <p>{app.status.hint}</p>
          </div>
        </div>
      </motion.header>

      <StageRail app={app} issues={issues} />

      <div className="tr-grid">
        <div className="tr-col">
          <Attention app={app} issues={issues} />
          {actions}
          <Checks app={app} />
          {app.score_explained && <Score se={app.score_explained} />}
        </div>
        <div className="tr-col tr-side">
          <Chat app={app} reload={reload} />
          <History app={app} />
          {!app.status.final && !["DISBURSING", "SIGNING"].includes(s) && (
            <button className="tr-cancel" onClick={() => confirm("Отменить заявку?") && api(`/api/applications/${app.id}/cancel`, { method: "POST" }).then(reload)}>
              Отменить заявку
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
