import { ArrowRight, ArrowUpRight, BadgePercent, BookOpen, Building2, CalendarClock, CreditCard, Factory, FileText, Hourglass, Landmark, Newspaper, Package, PenLine, Rocket, ShieldAlert, Sparkles, TrendingUp, Wallet, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, dt, money, months } from "../api";
import { AnimatedNumber, useReveal } from "../anim";
import { Progress, StatusBadge } from "../components/Status";
import { useAuth } from "../main";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
const PRODUCT_ICONS: Record<string, any> = { EXPRESS: Zap, OVERDRAFT: Wallet, GROWTH: TrendingUp, INVEST: Factory, CARD: CreditCard };
const CATEGORY: Record<string, [any, string]> = {
  Отрасль: [Building2, "#2a6df4"], Законы: [Landmark, "#7c3aed"], Налоги: [CalendarClock, "#d97a00"], Гид: [BookOpen, "#ef3124"],
  Господдержка: [ShieldAlert, "#0aa45a"], Продукты: [BadgePercent, "#ef3124"], Старт: [Rocket, "#0b0b0d"], Деньги: [Wallet, "#0aa45a"],
  Рынок: [TrendingUp, "#2a6df4"], Безопасность: [ShieldAlert, "#e5291c"],
};
const QUICK = [
  { purpose: "cash_gap", icon: Hourglass, title: "Кассовый разрыв", hint: "Овердрафт за 5 минут" },
  { purpose: "purchase", icon: Package, title: "Закупка товара", hint: "Экспресс-кредит без залога" },
  { purpose: "equipment", icon: Factory, title: "Оборудование", hint: "Инвест-кредит до 7 лет" },
  { purpose: "development", icon: Rocket, title: "Новое направление", hint: "Кредит на развитие" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

function NewsFeed({ refreshKey }: { refreshKey: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api("/api/news/feed").then((x) => { ref.current?.querySelectorAll("[data-shown]").forEach((e) => e.removeAttribute("data-shown")); setItems(x); }).catch(() => {});
  }, [refreshKey]);
  useReveal(ref, [items]);
  const [first, ...rest] = items;
  return (
    <div className="feed" ref={ref}>
      <div className="row between reveal" style={{ marginBottom: 14 }}>
        <div><div className="eyebrow">Для вашего бизнеса</div><h2 style={{ margin: 0 }}>Лента</h2></div>
        <span className="badge muted plain"><Sparkles size={13} /> персонально</span>
      </div>
      {first && (
        <article className="feed-hero reveal" onClick={() => setOpen(open === first.id ? null : first.id)}>
          <div className="row between"><span className="pill-dark">{first.category}</span><span className="small" style={{ opacity: .7 }}>{new Date(first.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span></div>
          <h3>{first.title}</h3>
          <p>{open === first.id ? first.body : first.summary}</p>
          <div className="why-tags">{first.why.map((w: string) => <span key={w}>{w}</span>)}</div>
        </article>
      )}
      {rest.map((n) => {
        const [Icon, color] = CATEGORY[n.category] || [Newspaper, "#5c5f66"];
        return (
          <article key={n.id} className="feed-item reveal" onClick={() => setOpen(open === n.id ? null : n.id)}>
            <div className="f-ico" style={{ color, background: color + "14" }}><Icon size={18} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="row between" style={{ gap: 8 }}><span className="small" style={{ color, fontWeight: 700 }}>{n.category}</span><span className="faint small">{new Date(n.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span></div>
              <div className="f-title">{n.title}</div>
              <div className="small muted">{open === n.id ? n.body : n.summary}</div>
              <div className="why-tags light">{n.why.map((w: string) => <span key={w}>{w}</span>)}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [apps, setApps] = useState<any[] | null>(null);
  const [company, setCompany] = useState<any>(null);
  const { user } = useAuth();
  const nav = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const load = () => {
    api("/api/applications").then(setApps);
    api("/api/company").then(setCompany);
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  useReveal(root, [apps === null, company === null, apps?.length]);
  const list = apps || [];
  const todo = list.filter((a) => a.open_tasks > 0 || ["APPROVED", "COUNTER_OFFER", "SIGNING"].includes(a.status.code));
  const active = list.filter((a) => !a.status.final && a.status.code !== "DRAFT").length;
  const debt = company?.loans.reduce((s: number, l: any) => s + l.amount, 0) || 0;
  const pay = company?.loans.reduce((s: number, l: any) => s + l.monthly_payment, 0) || 0;
  const c = company?.company;
  const firstName = (user?.full_name || "").split(" ")[1] || "";

  return (
    <div ref={root}>
      <section className="welcome reveal">
        <div className="w-grid" aria-hidden><i /><i /><i /><i /></div>
        <div className="w-left">
          <div className="eyebrow" style={{ color: "rgba(255,255,255,.55)" }}>{c ? `${c.legal_form} · ИНН ${c.inn}` : " "}</div>
          <h1>{greeting()}{firstName && `, ${firstName}`}</h1>
          <div className="w-company">{c?.name}</div>
          <div className="w-actions">
            <Link to="/new" className="btn"><Sparkles size={18} /> Подобрать кредит</Link>
            {todo[0] && <Link to={`/applications/${todo[0].id}`} className="btn w-ghost">Продолжить заявку <ArrowRight size={16} /></Link>}
          </div>
        </div>
        <div className="w-balance">
          <div className="small" style={{ opacity: .6 }}>Расчётный счёт</div>
          <div className="w-sum">{c ? <AnimatedNumber value={c.balance} format={rub} /> : "—"}</div>
          <div className="w-stats">
            <div><span>Обороты/мес</span><b>{money(c?.account_turnover_month)}</b></div>
            <div><span>Активных заявок</span><b>{active}</b></div>
            <div><span>Кредиты</span><b>{debt ? money(debt) : "нет"}</b></div>
          </div>
        </div>
      </section>

      <div className="quick">
        {QUICK.map((q) => (
          <Link key={q.purpose} to={`/new?purpose=${q.purpose}`} className="quick-tile reveal">
            <div className="q-ico"><q.icon size={22} /></div>
            <div><b>{q.title}</b><div className="small muted">{q.hint}</div></div>
            <ArrowUpRight size={18} className="q-arrow" />
          </Link>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="stack">
          {todo.length > 0 && (
            <div className="card attention reveal">
              <div className="row between"><div><div className="eyebrow" style={{ color: "var(--red)" }}>Требует внимания</div><h2 style={{ margin: 0 }}>Что нужно сделать</h2></div><span className="badge red plain">{todo.length}</span></div>
              {todo.map((a) => (
                <div key={a.id} className="todo">
                  <div className="ico">{a.open_tasks > 0 ? <FileText size={20} color="var(--red)" /> : a.status.code === "SIGNING" ? <PenLine size={20} color="var(--red)" /> : <BadgePercent size={20} color="var(--red)" />}</div>
                  <div style={{ flex: 1 }}>
                    <b>{a.open_tasks > 0 ? `Банк ждёт данные по заявке ${a.number}` : a.status.code === "SIGNING" ? "Подпишите договор" : "Рассмотрите предложение банка"}</b>
                    <div className="small muted">{a.product_name} · {money(a.amount)}</div>
                  </div>
                  <Link className="btn small" to={`/applications/${a.id}`}>Перейти</Link>
                </div>
              ))}
            </div>
          )}

          <div className="card reveal">
            <div className="row between" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Мои заявки</h2>{list.length > 0 && <Link to="/new" className="link small">+ Новая</Link>}</div>
            {apps && list.length === 0 && (
              <div className="empty">
                <div className="ico"><Wallet size={28} /></div>
                <h3>Заявок пока нет</h3>
                <p className="muted small">Выберите задачу выше — подберём продукт и покажем платёж ещё до подачи.</p>
              </div>
            )}
            {list.map((a) => {
              const Icon = PRODUCT_ICONS[a.product_code] || Wallet;
              return (
                <div key={a.id} className="app-card reveal" onClick={() => nav(a.status.code === "DRAFT" ? `/new/${a.id}` : `/applications/${a.id}`)}>
                  <div className="a-ico"><Icon size={22} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row between" style={{ gap: 8 }}>
                      <div><b style={{ fontSize: 16 }}>{a.product_name || "Черновик"}</b><div className="faint small">{a.number} · {dt(a.created_at)}</div></div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="a-amount">{a.amount ? money(a.amount) : "—"}<span className="faint small"> {a.term_months ? `на ${months(a.term_months)}` : ""}{a.purpose_title && ` · ${a.purpose_title}`}</span></div>
                    {!a.status.final && a.status.code !== "DRAFT" && <Progress status={a.status} />}
                  </div>
                </div>
              );
            })}
          </div>

          {company?.loans?.length > 0 && (
            <div className="card reveal">
              <div className="row between"><h2 style={{ margin: 0 }}>Кредиты</h2><span className="small muted">Платежи: <b style={{ color: "var(--text)" }}>{money(pay)}/мес</b></span></div>
              {company.loans.map((l: any) => (
                <details key={l.id} className="loan">
                  <summary>
                    <div className="a-ico" style={{ background: "var(--black)", color: "#fff" }}><CreditCard size={20} /></div>
                    <div style={{ flex: 1 }}><b>{l.contract_number}</b><div className="small muted">{money(l.amount)} · {l.rate}% · {months(l.term_months)}</div></div>
                    <div className="right"><div className="faint small">Ближайший платёж</div><b>{money(l.monthly_payment)}</b><div className="faint small">{new Date(l.schedule[0].date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</div></div>
                  </summary>
                  <table style={{ marginTop: 12 }}>
                    <thead><tr><th>№</th><th>Дата</th><th>Платёж</th><th>Долг</th><th>Проценты</th><th>Остаток</th></tr></thead>
                    <tbody>{l.schedule.map((r: any) => <tr key={r.n}><td>{r.n}</td><td>{new Date(r.date).toLocaleDateString("ru-RU")}</td><td>{money(r.payment)}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.rest)}</td></tr>)}</tbody>
                  </table>
                </details>
              ))}
            </div>
          )}
        </div>
        <NewsFeed refreshKey={list.map((a) => a.status.code).join(",")} />
      </div>
    </div>
  );
}
