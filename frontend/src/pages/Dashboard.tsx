import EmptyState from "../components/EmptyState";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgePercent,
  Banknote,
  BookOpen,
  CalendarClock,
  Coins,
  CreditCard,
  Factory,
  FileText,
  Files,
  Gavel,
  HandCoins,
  Landmark,
  Loader,
  Newspaper,
  PenLine,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money, months, poll } from "../api";
import { AnimatedNumber } from "../anim";
import { StatusBadge } from "../components/Status";
import { useAuth } from "../auth";
import BrandField from "../components/BrandField";
import SpotlightCard from "../components/reactbits/SpotlightCard";
import BlurText from "../components/reactbits/BlurText";
import ShinyText from "../components/reactbits/ShinyText";
import ClickSpark from "../components/reactbits/ClickSpark";
import SmoothHeight from "../components/SmoothHeight";
import "./Dashboard.css";

export const PRODUCT_ICONS: Record<string, any> = {
  EXPRESS: Zap,
  OVERDRAFT: Wallet,
  GROWTH: TrendingUp,
  INVEST: Factory,
  CARD: CreditCard,
};

const EASE = [0.2, 0.8, 0.2, 1] as const;
const LIVE = ["SUBMITTED", "DATA_CHECK", "ENRICHMENT", "SCORING", "DECISION", "MANUAL_REVIEW", "ESCALATED", "DISBURSING"];
const NEWS_UI: Record<string, { icon: any; tone: string }> = {
  Законы: { icon: Gavel, tone: "violet" },
  Налоги: { icon: Landmark, tone: "amber" },
  Господдержка: { icon: HandCoins, tone: "green" },
  Деньги: { icon: Coins, tone: "green" },
  Гид: { icon: BookOpen, tone: "blue" },
  Отрасль: { icon: Factory, tone: "slate" },
  Продукты: { icon: Sparkles, tone: "red" },
  Рынок: { icon: TrendingUp, tone: "blue" },
  Безопасность: { icon: ShieldCheck, tone: "slate" },
  Старт: { icon: Rocket, tone: "red" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

const appLink = (a: any) => (a.status.code === "DRAFT" ? `/cabinet/new/${a.id}` : `/cabinet/applications/${a.id}`);

/** Строка заявки: иконка продукта, номер и дата, мини-шкала этапов, статус и сумма. */
export function AppRow({ a }: { a: any }) {
  const nav = useNavigate();
  const Icon = PRODUCT_ICONS[a.product_code] || FileText;
  const total = a.status.stages.length - 1;
  const failed = ["REJECTED", "CANCELLED"].includes(a.status.code);
  return (
    <motion.div
      className="db-row"
      role="link"
      tabIndex={0}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav(appLink(a)); } }}
      onClick={() => nav(appLink(a))}
    >
      <span className="db-row-ico"><Icon size={18} /></span>
      <div className="db-row-main">
        <b>{a.product_name || "Черновик заявки"}</b>
        <small>№ {a.number} · {new Date(a.created_at).toLocaleDateString("ru-RU")}</small>
      </div>
      <div className={"db-row-stages" + (failed ? " failed" : "")} aria-hidden="true">
        {a.status.stages.slice(1).map((s: string, i: number) => (
          <i key={s} className={i + 1 < a.status.stage || (a.status.final && !failed && i + 1 <= a.status.stage) ? "done" : i + 1 === a.status.stage ? "on" : ""} title={s} />
        ))}
        <span>{Math.min(a.status.stage, total)}/{total}</span>
      </div>
      <StatusBadge status={a.status} />
      <div className="db-row-sum">{a.amount ? money(a.amount) : "—"}</div>
      <ArrowRight size={16} className="db-row-go" />
    </motion.div>
  );
}

function nextPayment(loans: any[]) {
  const today = new Date().toISOString().slice(0, 10);
  let best: any = null;
  for (const l of loans) for (const p of l.schedule || []) if (p.date >= today && (!best || p.date < best.date)) { best = { ...p, contract: l.contract_number, loanId: l.id }; break; }
  return best;
}

/** Витрина продуктов в hero: сама перелистывается, точки показывают таймер. */
function Showcase() {
  const [items, setItems] = useState<any[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => { api("/api/catalog/products").then(setItems).catch(() => {}); }, []);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setTimeout(() => setI((x) => (x + 1) % items.length), 4500);
    return () => clearTimeout(t);
  }, [i, items.length]);
  const p = items[i];
  if (!p) return <div className="db-show skeleton-dark" />;
  const Icon = PRODUCT_ICONS[p.code] || Wallet;
  const short = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)} млн ₽` : `${Math.round(v / 1e3)} тыс ₽`);
  return (
    <motion.div className="db-show" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.5, ease: EASE }}>
      <span className="db-show-label">Продукты для бизнеса</span>
      <AnimatePresence mode="wait">
        <motion.div key={p.code} className="db-show-body" initial={{ opacity: 0, x: 24, filter: "blur(6px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -24, filter: "blur(6px)" }} transition={{ duration: 0.4, ease: EASE }}>
          <span className="db-show-ico"><Icon size={22} /></span>
          <b>{p.name}</b>
          <p>{p.short}</p>
          <div className="db-show-facts">
            <div><small>Ставка</small><strong>от {p.base_rate}%</strong></div>
            <div><small>Сумма</small><strong>до {short(p.max_amount)}</strong></div>
            <div><small>Решение</small><strong>{p.decision_time}</strong></div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="db-show-foot">
        <div className="db-show-dots">
          {items.map((x, k) => (
            <button key={x.code} aria-label={x.name} className={k === i ? "on" : ""} onClick={() => setI(k)}>
              {k === i && <motion.i key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 4.5, ease: "linear" }} />}
            </button>
          ))}
        </div>
        <Link to={`/cabinet/new`} className="db-show-go">Оформить <ArrowRight size={14} /></Link>
      </div>
    </motion.div>
  );
}

function Hero({ active }: { active: any }) {
  return (
    <motion.section className="db-hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE }}>
      <div className="db-hero-field" aria-hidden="true"><BrandField /></div>
      <div className="db-hero-shade" aria-hidden="true" />
      {active ? (
        <div className="db-hero-in">
          <span className="db-eyebrow"><span className="db-live" /> Заявка в работе · № {active.number}</span>
          <h2>{active.product_name || "Заявка на кредит"}</h2>
          <p className="db-hero-sum"><AnimatedNumber value={active.amount || 0} format={money} /> · {months(active.term_months)}</p>
          <div className="db-hero-stages">
            {active.status.stages.map((s: string, i: number) => {
              const st = i < active.status.stage ? "done" : i === active.status.stage ? "on" : "";
              return (
                <div key={s} className={"db-hs " + st}>
                  <span><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: st ? 1 : 0 }} transition={{ duration: 0.6, delay: 0.3 + i * 0.12, ease: EASE }} /></span>
                  <small>{s}</small>
                </div>
              );
            })}
          </div>
          <div className="db-hero-now">
            {LIVE.includes(active.status.code) ? <Loader size={16} className="spin-ico" /> : <AlertTriangle size={16} />}
            <b>{active.status.title}</b>
            <span>{active.status.hint}</span>
          </div>
          <Link to={appLink(active)} className="db-hero-btn">Следить за заявкой <ArrowUpRight size={18} /></Link>
        </div>
      ) : (
        <div className="db-hero-in idle">
          <div className="db-hero-copy">
            <span className="db-eyebrow">Бизнес в движении</span>
            <h2>Следующий шаг<br /><em>начинается здесь.</em></h2>
            <p>Подберём финансирование под задачу бизнеса и покажем платёж до отправки заявки.</p>
            <div className="db-hero-cta">
              <ClickSpark sparkColor={["#ef3124", "#ff8a80", "#ffffff"]} sparkCount={12}>
                <Link to="/cabinet/new" className="db-hero-btn">
                  <ShinyText text="Рассчитать кредит" color="#ffffff" shineColor="#ffd6d2" speed={3} /> <ArrowUpRight size={18} />
                </Link>
              </ClickSpark>
            </div>
            <ul className="db-perks">
              {[[Zap, "Решение от 5 минут"], [ShieldCheck, "Без запроса в БКИ при подборе"], [PenLine, "Подпись онлайн"]].map(([I, t]: any, i) => (
                <motion.li key={t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.08 }}><I size={14} /> {t}</motion.li>
              ))}
            </ul>
          </div>
          <Showcase />
        </div>
      )}
    </motion.section>
  );
}

function Metric({ icon: Icon, label, value, format, to, linkText, sub, i }: { icon: any; label: string; value: number; format?: (v: number) => string; to: string; linkText: string; sub?: string; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 + i * 0.07, ease: EASE }}>
      <SpotlightCard theme="light" spotlightColor="rgba(239,49,36,0.12)" className="db-metric">
        <span className="db-metric-ico"><Icon size={18} /></span>
        <span className="db-metric-label">{label}</span>
        <strong><AnimatedNumber value={value} format={format} duration={1} /></strong>
        {sub && <small className="db-metric-sub">{sub}</small>}
        <Link to={to}>{linkText} <ArrowRight size={15} /></Link>
      </SpotlightCard>
    </motion.div>
  );
}

function News({ feed }: { feed: any[] }) {
  const cats = Array.from(new Set(feed.map((n) => n.category)));
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const list = feed.filter((n) => cat === "all" || n.category === cat).slice(0, 7);
  const [lead, ...rest] = list;
  const date = (n: any) => new Date(n.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const card = (n: any, big = false) => {
    const ui = NEWS_UI[n.category] || { icon: Newspaper, tone: "slate" };
    const isOpen = open === n.id;
    return (
      <motion.article key={n.id} className={"db-news " + ui.tone + (big ? " lead" : "") + (isOpen ? " open" : "")} variants={{ h: { opacity: 0, y: 14, scale: 0.98 }, s: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } } }} onClick={() => setOpen(isOpen ? null : n.id)}>
        {big && <span className="db-news-art" aria-hidden="true"><ui.icon size={120} strokeWidth={1.1} /></span>}
        <div className="db-news-top">
          <span className="db-tag"><ui.icon size={13} /> {n.category}</span>
          <small>{date(n)}</small>
        </div>
        <b>{n.title}</b>
        <AnimatePresence initial={false} mode="wait">
          <motion.p key={isOpen ? "b" : "s"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>{isOpen ? n.body : n.summary}</motion.p>
        </AnimatePresence>
        <div className="db-why">{n.why.map((w: string) => <span key={w}>{w}</span>)}</div>
        <span className="db-news-more">{isOpen ? "Свернуть" : "Читать"} <ArrowRight size={14} /></span>
      </motion.article>
    );
  };
  return (
    <section className="db-block">
      <div className="db-block-head">
        <div><h3><Newspaper size={18} /> Новости для вашего бизнеса</h3><small>Подбираем по отрасли, форме бизнеса и стадии заявки</small></div>
      </div>
      <div className="db-cats" role="tablist">
        {["all", ...cats].map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => { setCat(c); setOpen(null); }}>
            {cat === c && <motion.span layoutId="db-cat" className="db-cat-bg" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span>{c === "all" ? "Все" : c}</span>
          </button>
        ))}
      </div>
      <SmoothHeight>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={cat} className="db-news-grid" initial="h" animate="s" exit="x" variants={{ h: {}, s: { transition: { staggerChildren: 0.05 } }, x: { opacity: 0, filter: "blur(4px)", transition: { duration: 0.18 } } }}>
            {lead && card(lead, true)}
            {rest.map((n) => card(n))}
          </motion.div>
        </AnimatePresence>
      </SmoothHeight>
    </section>
  );
}

export default function Dashboard() {
  const [apps, setApps] = useState<any[] | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const { user } = useAuth();
  useEffect(() => poll(() => api("/api/applications").then(setApps), 4000), []);
  useEffect(() => { api("/api/company").then(setCompany).catch(() => {}); }, []);
  const feedKey = (apps || []).map((a) => a.status.code).join(",");
  useEffect(() => { api("/api/news/feed").then(setFeed).catch(() => {}); }, [feedKey]);

  const list = apps || [];
  const todo = list.filter((a) => a.open_tasks > 0 || ["APPROVED", "COUNTER_OFFER", "SIGNING"].includes(a.status.code));
  const active = list.find((a) => LIVE.includes(a.status.code) || a.status.code === "NEEDS_INFO");
  const inWork = list.filter((a) => LIVE.includes(a.status.code) || a.status.code === "NEEDS_INFO").length;
  const issued = list.filter((a) => a.status.code === "DISBURSED").reduce((s, a) => s + (a.offer?.amount || a.amount || 0), 0);
  const pay = nextPayment(company?.loans || []);
  const firstName = (user?.full_name || "").split(" ")[1] || "";
  const today = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="page db">
      <header className="db-head">
        <div>
          <h1 className="db-h1">
            <BlurText text={greeting() + (firstName ? "," : "!")} className="db-h1-txt" animateBy="words" delay={40} stepDuration={0.2} trigger="load" />
            {firstName && <ShinyText text={`${firstName}!`} color="#0b0b0d" shineColor="#ef3124" speed={3.5} className="db-h1-name" />}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Заявки, кредиты и всё важное для бизнеса — в одном месте</motion.p>
        </div>
        <motion.div className="db-today" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <CalendarClock size={16} />
          <div><b>{today.charAt(0).toUpperCase() + today.slice(1)}</b><small>{company?.company?.name || user?.company?.name || ""}</small></div>
        </motion.div>
      </header>

      <div className="db-top">
        <Hero active={active} />
        <div className="db-metrics">
          <Metric i={0} icon={Files} label="Заявок в кабинете" value={list.length} to="/cabinet/applications" linkText="Все заявки" />
          <Metric i={1} icon={Loader} label="В работе у банка" value={inWork} to="/cabinet/applications" linkText="Следить" sub={inWork ? "обновляется в реальном времени" : "активных заявок нет"} />
          <Metric i={2} icon={Banknote} label="Выдано бизнесу" value={issued} format={money} to="/cabinet/loans" linkText="Мои кредиты" />
          <Metric i={3} icon={CalendarClock} label="Ближайший платёж" value={pay?.payment || 0} format={money} to={pay ? `/cabinet/loans/${pay.loanId}` : "/cabinet/loans"} linkText="График" sub={pay ? new Date(pay.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "платежей пока нет"} />
        </div>
      </div>

      <AnimatePresence>
        {todo.length > 0 && (
          <motion.section className="db-block db-todo" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="db-block-head"><div><h3><AlertTriangle size={18} /> Требует внимания</h3><small>Без вашего действия эти заявки не двинутся дальше</small></div><span className="db-count">{todo.length}</span></div>
            <div className="db-todo-grid">
              {todo.map((a, i) => {
                const kind = a.open_tasks > 0 ? "tasks" : a.status.code === "SIGNING" ? "sign" : "offer";
                const Icon = kind === "tasks" ? FileText : kind === "sign" ? PenLine : BadgePercent;
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Link to={`/cabinet/applications/${a.id}`} className={"db-todo-card " + kind}>
                      <span className="ti"><Icon size={18} /></span>
                      <div>
                        <b>{kind === "tasks" ? `Банк ждёт данные · ${a.open_tasks}` : kind === "sign" ? "Подпишите договор" : "Рассмотрите предложение банка"}</b>
                        <small>№ {a.number} · {a.product_name} · {money(a.amount)}</small>
                      </div>
                      <ArrowRight size={16} className="go" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="db-block">
        <div className="db-block-head">
          <div><h3><Files size={18} /> Мои заявки</h3><small>Последние пять — с прогрессом по этапам</small></div>
          <Link to="/cabinet/applications" className="db-link">Все заявки <ArrowRight size={14} /></Link>
        </div>
        {apps === null && [0, 1, 2].map((k) => <div key={k} className="skeleton" style={{ height: 64, borderRadius: 16, marginBottom: 8 }} />)}
        {apps && list.length === 0 && <EmptyState kind="applications" compact />}
        <div className="db-rows">{list.slice(0, 5).map((a) => <AppRow key={a.id} a={a} />)}</div>
      </section>

      {feed.length > 0 && <News feed={feed} />}
    </div>
  );
}
