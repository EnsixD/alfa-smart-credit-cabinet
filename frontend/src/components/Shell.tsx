import { BarChart3, Bell, CreditCard, FileText, Files, Home, Inbox, Settings, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, dt, poll } from "../api";
import { replay } from "../anim";
import { useAuth } from "../main";
import Assistant from "./Assistant";
import SiteHeader from "./SiteHeader";

function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const load = () => api("/api/notifications").then(setItems).catch(() => {});
  useEffect(() => poll(load, 5000), []);
  useLayoutEffect(() => { if (open) replay(box.current, "pop-in"); }, [open]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (open && wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="notif-wrap" ref={wrap}>
      <button className="sh-icon" aria-label="Уведомления" onClick={() => { setOpen(!open); if (!open && unread) api("/api/notifications/read", { method: "POST" }).then(load); }}>
        <Bell size={18} />{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown" ref={box}>
          <div className="n-head"><b>Уведомления</b>{items.length > 0 && <button className="n-clear" onClick={() => api("/api/notifications", { method: "DELETE" }).then(load)}>Очистить все</button>}</div>
          {items.length === 0 && <div className="n muted">Пока ничего нового</div>}
          {items.map((n) => (
            <div key={n.id} className={"n" + (n.read ? "" : " unread")} onClick={() => { setOpen(false); n.application_id && nav(`/cabinet/applications/${n.application_id}`); }}>
              <div className="n-body"><div>{n.text}</div><div className="faint small" style={{ marginTop: 4 }}>{dt(n.created_at)}</div></div>
              <button className="n-del" title="Удалить" onClick={(e) => { e.stopPropagation(); setItems((xs) => xs.filter((x) => x.id !== n.id)); api(`/api/notifications/${n.id}`, { method: "DELETE" }).catch(load); }}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CLIENT_MENU = [
  ["/cabinet", "Главная", Home, true], ["/cabinet/applications", "Заявки", Files, false], ["/cabinet/loans", "Кредиты", CreditCard, false],
  ["/cabinet/documents", "Документы", FileText, false], ["/cabinet/settings", "Настройки", Settings, false],
] as const;
const BANK_MENU = [["/bank", "Очередь заявок", Inbox, true], ["/bank/analytics", "Аналитика", BarChart3, false]] as const;

/** Каркас кабинета: шапка сайта + боковое меню + контент, как в макете. */
export default function Shell() {
  const { user } = useAuth();
  const isClient = user?.role === "CLIENT";
  const loc = useLocation();
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => { replay(main.current, "anim-in"); }, [loc.pathname]);
  const menu: readonly (readonly [string, string, any, boolean])[] = isClient ? CLIENT_MENU : BANK_MENU;
  return (
    <div className="app">
      <SiteHeader right={isClient ? <Notifications /> : undefined} />
      <div className="app-body">
        <aside className="sidebar">
          {menu.map(([to, title, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className="side-link"><Icon size={17} />{title}</NavLink>
          ))}
          <div className="side-foot">{isClient ? user?.company?.name : user?.position}</div>
        </aside>
        <main className="app-main" ref={main}><Outlet /></main>
      </div>
      {isClient && <Assistant />}
    </div>
  );
}
