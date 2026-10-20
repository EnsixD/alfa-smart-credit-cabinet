import {
  AlertTriangle,
  LifeBuoy,
  LogOut,
  Plus,
  BarChart3,
  Bell,
  CreditCard,
  FileText,
  Files,
  Home,
  Inbox,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import ClickSpark from "./reactbits/ClickSpark";
import "./Shell.css";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, dt, poll } from "../api";
import { replay } from "../anim";
import { useAuth } from "../auth";
import Assistant from "./Assistant";
import SiteHeader from "./SiteHeader";
import Notifications from "./Notifications";

const CLIENT_MENU = [
  ["/cabinet", "Главная", Home, true],
  ["/cabinet/applications", "Заявки", Files, false],
  ["/cabinet/loans", "Кредиты", CreditCard, false],
  ["/cabinet/documents", "Документы", FileText, false],
  ["/cabinet/settings", "Настройки", Settings, false],
] as const;
const BANK_MENU = [
  ["/bank", "Очередь заявок", Inbox, true],
  ["/bank/analytics", "Аналитика", BarChart3, false],
] as const;

function initials(name = "") {
  const w = name.replace(/[«»"]/g, "").replace(/^(ООО|ИП|АО|ПАО)\s+/i, "").split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase() || "В";
}

/** Каркас кабинета: шапка сайта + боковое меню + контент. */
export default function Shell() {
  const { user, logout } = useAuth();
  const isClient = user?.role === "CLIENT";
  const loc = useLocation();
  const nav = useNavigate();
  const main = useRef<HTMLElement>(null);
  const [apps, setApps] = useState<any[]>([]);
  useLayoutEffect(() => {
    replay(main.current, "anim-in");
  }, [loc.pathname]);
  useEffect(() => {
    if (!isClient) return;
    return poll(() => api("/api/applications").then(setApps).catch(() => {}), 10000);
  }, [isClient]);
  const menu: readonly (readonly [string, string, any, boolean])[] = isClient ? CLIENT_MENU : BANK_MENU;
  const attention = apps.filter((a) => a.open_tasks > 0 || ["APPROVED", "COUNTER_OFFER", "SIGNING"].includes(a.status.code)).length;
  const inWork = apps.filter((a) => !a.status.final && a.status.code !== "DRAFT").length;
  const badge = (to: string) => (to === "/cabinet/applications" ? (attention ? { n: attention, warn: true } : inWork ? { n: inWork, warn: false } : null) : null);
  const company = user?.company;
  return (
    <div className="app">
      <SiteHeader cabinet right={isClient ? <Notifications /> : undefined} />
      <div className="app-body">
        <aside className="sidebar sb">
          <div className="sb-org">
            <span className="sb-ava">{initials(isClient ? company?.name : user?.full_name)}</span>
            <div>
              <b>{isClient ? company?.name : "Кредитный отдел"}</b>
              <small>{isClient ? (company?.inn ? `ИНН ${company.inn}` : "Клиент") : user?.position}</small>
            </div>
          </div>

          {isClient && (
            <ClickSpark sparkColor={["#ef3124", "#ff8a80"]} sparkCount={10} className="sb-new-wrap">
              <button className="sb-new" onClick={() => nav("/cabinet/new")}>
                <span><Plus size={16} strokeWidth={2.6} /></span> Новая заявка
              </button>
            </ClickSpark>
          )}

          <span className="sb-label">{isClient ? "Кабинет" : "Банк"}</span>
          <nav className="sb-nav">
            {menu.map(([to, title, Icon, end]) => {
              const b = isClient ? badge(to) : null;
              return (
                <NavLink key={to} to={to} end={end} className="side-link sb-link">
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="sb-active" className="sb-active" transition={{ type: "spring", stiffness: 450, damping: 36 }} />}
                      <span className="sb-ico"><Icon size={18} /></span>
                      <span className="sb-txt">{title}</span>
                      {b && <motion.em key={b.n} className={b.warn ? "warn" : ""} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} title={b.warn ? "Требуют внимания" : "В работе"}>{b.n}</motion.em>}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {isClient && attention > 0 && (
            <motion.button className="sb-alert" onClick={() => nav("/cabinet")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <AlertTriangle size={16} />
              <span><b>Требует внимания</b><small>{attention} {attention === 1 ? "заявка ждёт" : "заявки ждут"} вашего действия</small></span>
            </motion.button>
          )}

          <div className="sb-foot">
            {isClient && (
              <button className="sb-help" onClick={() => window.dispatchEvent(new Event("assistant:open"))}>
                <span className="sb-help-ico"><LifeBuoy size={16} /></span>
                <div><b>Нужна помощь?</b><small>Спросите Помощника о заявке или продуктах</small></div>
              </button>
            )}
            <div className="sb-user">
              <span className="sb-ava small">{initials(user?.full_name)}</span>
              <div><b>{user?.full_name}</b><small>{user?.position}</small></div>
              <button onClick={() => { logout(); nav("/"); }} aria-label="Выйти" title="Выйти"><LogOut size={16} /></button>
            </div>
          </div>
        </aside>
        <main className="app-main" ref={main}>
          <Outlet />
        </main>
      </div>
      {isClient && <Assistant />}
    </div>
  );
}
