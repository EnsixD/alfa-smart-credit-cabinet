import { BadgePercent, FileText, PenLine, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, dt, money, months } from "../api";
import { AnimatedNumber, useReveal } from "../anim";
import { Progress, StatusBadge } from "../components/Status";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";

function NewsFeed({ refreshKey }: { refreshKey: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { api("/api/news/feed").then((x) => { if (ref.current) ref.current.querySelectorAll("[data-shown]").forEach((e) => e.removeAttribute("data-shown")); setItems(x); }).catch(() => {}); }, [refreshKey]);
  useReveal(ref, [items]);
  return (
    <div className="card" ref={ref}>
      <div className="eyebrow">Для вас</div>
      <h2>Лента вашего бизнеса</h2>
      <p className="faint small" style={{ marginTop: -6 }}>Подстраивается под отрасль, размер бизнеса и стадию заявки</p>
      {items.map((n) => (
        <div key={n.id} className="news-item reveal">
          <div className="row between"><span className="badge muted plain">{n.category}</span><span className="faint small">{new Date(n.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span></div>
          <div className="news-title" onClick={() => setOpen(open === n.id ? null : n.id)}>{n.title}</div>
          <div className="small muted">{open === n.id ? n.body : n.summary}</div>
          <div className="why"><b>Почему вы это видите</b><span>{n.why.join(" · ")}</span></div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [apps, setApps] = useState<any[] | null>(null);
  const [company, setCompany] = useState<any>(null);
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
  const feedKey = list.map((a) => a.status.code).join(",");
  const debt = company?.loans.reduce((s: number, l: any) => s + l.amount, 0) || 0;

  return (
    <div ref={root}>
      <div className="page-head reveal">
        <div><div className="eyebrow">{company?.company.legal_form} · ИНН {company?.company.inn}</div><h1>{company?.company.name || "Загрузка…"}</h1></div>
        <Link to="/new" className="btn">+ Новая заявка</Link>
      </div>
      <div className="grid grid-2">
        <div className="stack">
          {company && (
            <div className="grid grid-2e reveal" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
              <div className="balance-card">
                <div className="muted small">Расчётный счёт</div>
                <div className="huge" style={{ margin: "10px 0 18px" }}><AnimatedNumber value={company.company.balance} format={rub} /></div>
                <div className="muted small">Обороты в месяц · {money(company.company.account_turnover_month)}</div>
              </div>
              <div className="card flat">
                <div className="faint small">Действующие кредиты</div>
                <div className="big" style={{ margin: "10px 0 6px" }}><AnimatedNumber value={company.loans.length} /></div>
                <div className="small muted">{debt ? `на ${money(debt)}` : "Пока нет — подберём под вашу задачу"}</div>
                <div className="divider" />
                <div className="faint small">ОКВЭД {company.company.okved}</div>
                <div className="small" style={{ marginTop: 4 }}>{company.company.okved_name}</div>
              </div>
            </div>
          )}

          {todo.length > 0 && (
            <div className="card reveal" style={{ boxShadow: "0 0 0 2px var(--red), var(--shadow-2)" }}>
              <div className="eyebrow" style={{ color: "var(--red)" }}>Требует внимания</div>
              <h2>Что нужно сделать</h2>
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
            <h2>Мои заявки</h2>
            {apps && list.length === 0 && (
              <div className="empty">
                <div className="ico"><Wallet size={28} /></div>
                <h3>Заявок пока нет</h3>
                <p className="muted small">Расскажите, на что нужны деньги, — подберём продукт и покажем платёж ещё до подачи.</p>
                <Link to="/new" className="btn" style={{ marginTop: 8 }}>Подобрать кредит</Link>
              </div>
            )}
            {list.map((a) => (
              <div key={a.id} className="app-row reveal" onClick={() => nav(a.status.code === "DRAFT" ? `/new/${a.id}` : `/applications/${a.id}`)}>
                <div className="row between">
                  <div><b style={{ fontSize: 16 }}>{a.product_name || "Черновик"}</b> <span className="faint small">· {a.number} · {dt(a.created_at)}</span></div>
                  <StatusBadge status={a.status} />
                </div>
                <div className="small muted" style={{ marginTop: 4 }}>{a.amount ? `${money(a.amount)} на ${months(a.term_months)}` : "продолжите заполнение"}{a.purpose_title && ` · ${a.purpose_title}`}</div>
                {!a.status.final && a.status.code !== "DRAFT" && <Progress status={a.status} />}
              </div>
            ))}
          </div>

          {company?.loans?.length > 0 && (
            <div className="card reveal">
              <h2>Кредиты и графики платежей</h2>
              {company.loans.map((l: any) => (
                <details key={l.id} className="news-item">
                  <summary className="row between" style={{ display: "flex" }}>
                    <div><b>{l.contract_number}</b><div className="small muted">{money(l.amount)} · {l.rate}% · {months(l.term_months)}</div></div>
                    <div className="right"><div className="faint small">Платёж</div><b>{money(l.monthly_payment)}</b></div>
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
        <NewsFeed refreshKey={feedKey} />
      </div>
    </div>
  );
}
