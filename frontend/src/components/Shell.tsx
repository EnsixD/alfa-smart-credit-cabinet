import {
  AlertTriangle,
  LifeBuoy,
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
import "./Shell.css";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, dt, poll } from "../api";
import { replay } from "../anim";
import { useAuth } from "../auth";
import Assistant from "./Assistant";
import SiteHeader from "./SiteHeader";
import Notifications from "./Notifications";

const CLIENT_MENU = [
  ["/cabinet", "Главная", Home, true, "Обзор и новости"],
  ["/cabinet/applications", "Заявки", Files, false, "Статусы и проверки"],
  ["/cabinet/loans", "Кредиты", CreditCard, false, "Графики платежей"],
  ["/cabinet/documents", "Документы", FileText, false, "Загруженные файлы"],
  ["/cabinet/settings", "Настройки", Settings, false, "Профиль и компания"],
] as const;
const BANK_MENU = [
  ["/bank", "Очередь заявок", Inbox, true, "Заявки на рассмотрении"],
  ["/bank/analytics", "Аналитика", BarChart3, false, "Показатели портфеля"],
] as const;

/** Каркас кабинета: шапка сайта + боковое меню + контент. */
export default function Shell() {
  const { user } = useAuth();
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
  const menu: readonly (readonly [string, string, any, boolean, string])[] = isClient ? CLIENT_MENU : BANK_MENU;
  // активный пункт: точное совпадение для «главной», иначе по началу пути (заявка → «Заявки»)
  const activeIndex = menu.findIndex(([to, , , end]) => (end ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/")));
  const attention = apps.filter((a) => a.open_tasks > 0 || ["APPROVED", "COUNTER_OFFER", "SIGNING"].includes(a.status.code)).length;
  const inWork = apps.filter((a) => !a.status.final && a.status.code !== "DRAFT").length;
  const badge = (to: string) => (to === "/cabinet/applications" ? (attention ? { n: attention, warn: true } : inWork ? { n: inWork, warn: false } : null) : null);
  return (
    <div className="app">
      <SiteHeader cabinet right={isClient ? <Notifications /> : undefined} />
      <div className="app-body">
        <aside className="sidebar sb">
          <span className="sb-label">{isClient ? "Кабинет" : "Банк"}</span>
          <nav className="sb-nav">
            {/* одна подложка ездит внутри меню по номеру пункта — не зависит от прокрутки страницы */}
            {activeIndex >= 0 && (
              <motion.span className="sb-active" initial={false} animate={{ y: activeIndex * 64 }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            {menu.map(([to, title, Icon, end, hint]) => {
              const b = isClient ? badge(to) : null;
              return (
                <NavLink key={to} to={to} end={end} className="side-link sb-link">
                  <span className="sb-ico"><Icon size={19} /></span>
                  <span className="sb-txt"><b>{title}</b><small>{hint}</small></span>
                  {b && <motion.em key={b.n} className={b.warn ? "warn" : ""} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} title={b.warn ? "Требуют внимания" : "В работе"}>{b.n}</motion.em>}
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

          {isClient && (
            <div className="sb-foot">
              <button className="sb-help" onClick={() => window.dispatchEvent(new Event("assistant:open"))}>
                <span className="sb-help-ico"><LifeBuoy size={16} /></span>
                <div><b>Нужна помощь?</b><small>Спросите Помощника о заявке или продуктах</small></div>
              </button>
            </div>
          )}
        </aside>
        <main className="app-main" ref={main}>
          <Outlet />
        </main>
      </div>
      {isClient && <Assistant />}
    </div>
  );
}
