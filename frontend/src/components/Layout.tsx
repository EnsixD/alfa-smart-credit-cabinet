import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { api, dt } from "../api";
import { replay } from "../anim";
import { useAuth } from "../main";
import Assistant from "./Assistant";

export const initials = (name = "") => name.split(" ").slice(0, 2).map((p) => p[0]).join("");

function Bell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const load = () => api("/api/notifications").then(setItems).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  useLayoutEffect(() => {
    if (open) replay(box.current, "pop-in");
  }, [open]);
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="notif-wrap">
      <button className="icon-btn" title="Уведомления" onClick={() => { setOpen(!open); if (!open && unread) api("/api/notifications/read", { method: "POST" }).then(load); }}>
        <Bell />{unread > 0 && <span className="dot">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown" ref={box}>
          <div className="n-head"><h3 style={{ margin: 0 }}>Уведомления</h3>{items.length > 0 && <button className="n-clear" onClick={() => api("/api/notifications", { method: "DELETE" }).then(load)}>Очистить все</button>}</div>
          {items.length === 0 && <div className="n muted">Пока ничего нового</div>}
          {items.map((n) => (
            <div key={n.id} className={"n" + (n.read ? "" : " unread")} onClick={() => { setOpen(false); n.application_id && nav(`/applications/${n.application_id}`); }}>
              <div className="n-body"><div>{n.text}</div><div className="faint small" style={{ marginTop: 4 }}>{dt(n.created_at)}</div></div>
              <button className="n-del" title="Удалить" onClick={(e) => { e.stopPropagation(); setItems((xs) => xs.filter((x) => x.id !== n.id)); api(`/api/notifications/${n.id}`, { method: "DELETE" }).catch(load); }}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const isClient = user?.role === "CLIENT";
  const loc = useLocation();
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    replay(main.current, "anim-in");
  }, [loc.pathname]);
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">А</span>
            <span>{isClient ? "Бизнес-кредит" : "Кредитный конвейер"}<small>{isClient ? "кабинет предпринимателя" : "рабочее место банка"}</small></span>
          </Link>
          <nav className="nav">
            {isClient ? (
              <>
                <NavLink to="/" end>Главная</NavLink>
                <NavLink to="/new">Новая заявка</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" end>Очередь заявок</NavLink>
                <NavLink to="/bank/analytics">Аналитика</NavLink>
              </>
            )}
          </nav>
          {isClient && <Notifications />}
          <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <div className="who">{user?.full_name}<small>{isClient ? user?.company?.name : user?.position}</small></div>
            <div className="avatar">{initials(user?.full_name)}</div>
          </div>
          <button className="btn secondary small" onClick={logout}>Выйти</button>
        </div>
      </header>
      <main className="container" ref={main}>
        <Outlet />
      </main>
      {isClient && <Assistant />}
    </>
  );
}
