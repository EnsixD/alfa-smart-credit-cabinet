import {
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

/** Каркас кабинета: шапка сайта + боковое меню + контент, как в макете. */
export default function Shell() {
  const { user } = useAuth();
  const isClient = user?.role === "CLIENT";
  const loc = useLocation();
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    replay(main.current, "anim-in");
  }, [loc.pathname]);
  const menu: readonly (readonly [string, string, any, boolean])[] = isClient
    ? CLIENT_MENU
    : BANK_MENU;
  return (
    <div
      className={
        "app" +
        (/^\/cabinet\/applications\/[^/]+$/.test(loc.pathname)
          ? " vx-focus-app"
          : "")
      }
    >
      <SiteHeader cabinet right={isClient ? <Notifications /> : undefined} />
      <div className="app-body">
        <aside className="sidebar">
          {menu.map(([to, title, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className="side-link">
              <Icon size={17} />
              {title}
            </NavLink>
          ))}
          <div className="side-foot">
            {isClient ? user?.company?.name : user?.position}
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
