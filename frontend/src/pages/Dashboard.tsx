import { ArrowRight, BadgePercent, CreditCard, Factory, FileText, PenLine, TrendingUp, Wallet, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, money, poll } from "../api";
import { useReveal } from "../anim";
import { StatusBadge } from "../components/Status";
import { useAuth } from "../main";

export const PRODUCT_ICONS: Record<string, any> = { EXPRESS: Zap, OVERDRAFT: Wallet, GROWTH: TrendingUp, INVEST: Factory, CARD: CreditCard };

function greeting() {
  const h = new Date().getHours();
  return h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

/** Строка заявки в списке — как в макете: иконка, название, номер и дата, статус, сумма. */
export function AppRow({ a }: { a: any }) {
  const nav = useNavigate();
  const Icon = PRODUCT_ICONS[a.product_code] || FileText;
  return (
    <div className="app-row reveal" onClick={() => nav(a.status.code === "DRAFT" ? `/cabinet/new/${a.id}` : `/cabinet/applications/${a.id}`)}>
      <span className="ar-ico"><Icon size={16} /></span>
      <div className="ar-main"><b>{a.product_name || "Черновик заявки"}</b><small>№ {a.number} · {new Date(a.created_at).toLocaleDateString("ru-RU")}</small></div>
      <StatusBadge status={a.status} />
      <div className="ar-sum">{a.amount ? money(a.amount) : "—"}</div>
    </div>
  );
}

export default function Dashboard() {
  const [apps, setApps] = useState<any[] | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const { user } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => poll(() => api("/api/applications").then(setApps), 4000), []);
  const feedKey = (apps || []).map((a) => a.status.code).join(",");
  useEffect(() => { api("/api/news/feed").then(setFeed).catch(() => {}); }, [feedKey]);
  useReveal(root, [apps === null, apps?.length, feed.length]);
  const list = apps || [];
  const todo = list.filter((a) => a.open_tasks > 0 || ["APPROVED", "COUNTER_OFFER", "SIGNING"].includes(a.status.code));
  const firstName = (user?.full_name || "").split(" ")[1] || "";

  return (
    <div className="page" ref={root}>
      <div className="page-title reveal">
        <h1>{greeting()}{firstName && `, ${firstName}`}!</h1>
        <p>Здесь вы можете управлять своими заявками и кредитами.</p>
      </div>

      <section className="promo reveal">
        <div className="promo-copy">
          <h2>Подберите кредит для вашего бизнеса</h2>
          <p>Рассчитайте условия и отправьте заявку онлайн</p>
          <Link to="/cabinet/new" className="btn btn-white">Рассчитать</Link>
        </div>
      </section>

      {todo.length > 0 && (
        <section className="block reveal">
          <div className="block-head"><h3>Требует внимания</h3></div>
          {todo.map((a) => (
            <Link key={a.id} to={`/cabinet/applications/${a.id}`} className="todo-row">
              <span className="ar-ico red">{a.open_tasks > 0 ? <FileText size={16} /> : a.status.code === "SIGNING" ? <PenLine size={16} /> : <BadgePercent size={16} />}</span>
              <div className="ar-main"><b>{a.open_tasks > 0 ? "Банк ждёт данные по заявке" : a.status.code === "SIGNING" ? "Подпишите договор" : "Рассмотрите предложение банка"}</b><small>№ {a.number} · {a.product_name} · {money(a.amount)}</small></div>
              <ArrowRight size={16} className="faint" />
            </Link>
          ))}
        </section>
      )}

      <section className="block reveal">
        <div className="block-head"><h3>Мои заявки</h3><Link to="/cabinet/applications" className="link-sm">Все заявки <ArrowRight size={13} /></Link></div>
        {apps && list.length === 0 && <div className="empty-row">Заявок пока нет. <Link to="/cabinet/new" className="link-sm">Подобрать кредит</Link></div>}
        {list.slice(0, 5).map((a) => <AppRow key={a.id} a={a} />)}
      </section>

      {feed.length > 0 && (
        <section className="block reveal">
          <div className="block-head"><h3>Новости для вашего бизнеса</h3><span className="faint small">подбираются по отрасли и стадии заявки</span></div>
          <div className="news-grid">
            {feed.slice(0, 6).map((n) => (
              <article key={n.id} className="news-card reveal" onClick={() => setOpen(open === n.id ? null : n.id)}>
                <div className="nc-top"><span className="tag">{n.category}</span><span className="faint small">{new Date(n.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span></div>
                <b>{n.title}</b>
                <p>{open === n.id ? n.body : n.summary}</p>
                <div className="why">Почему вы это видите: {n.why.join(" · ")}</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
