import { LogOut, Search } from "lucide-react";
import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { homeOf, useAuth } from "../main";

export const initials = (name = "") => name.split(" ").slice(0, 2).map((p) => p[0]).join("");

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark">А</span>
      <span className="brand-name">Альфа Банк</span>
    </Link>
  );
}

const NAV = [["Бизнесу", "/#business"], ["Кредиты", "/#credits"], ["Решения", "/#how"], ["Поддержка", "/#support"]];

/** Шапка сайта: одинаковая на главной и в кабинете, как в макете. */
export default function SiteHeader({ right }: { right?: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="site-header">
      <div className="sh-inner">
        <Logo to="/" />
        <nav className="sh-nav">{NAV.map(([t, h]) => <a key={t} href={h}>{t}</a>)}</nav>
        <div className="sh-right">
          <button className="sh-icon" aria-label="Поиск"><Search size={18} /></button>
          {right}
          {user ? (
            <>
              <Link to={homeOf(user)} className="sh-user" title={user.full_name}>
                <span className="sh-avatar">{initials(user.full_name)}</span>
                <span className="sh-user-text"><b>{user.full_name.split(" ").slice(0, 2).join(" ")}</b><small>{user.role === "CLIENT" ? user.company?.name : user.position}</small></span>
              </Link>
              <button className="sh-icon" aria-label="Выйти" title="Выйти" onClick={() => { logout(); nav("/"); }}><LogOut size={18} /></button>
            </>
          ) : (
            <Link to="/login" className="btn btn-sm">Войти</Link>
          )}
        </div>
      </div>
    </header>
  );
}
