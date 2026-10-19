import { CornerDownLeft, FileText, LogOut, Search, X } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, money } from "../api";
import { homeOf, useAuth } from "../main";

export const initials = (name = "") => name.split(" ").slice(0, 2).map((p) => p[0]).join("");
export const BRAND = "Вектор";

/** Знак «Вектора»: стрелка вверх-вправо — движение бизнеса вперёд. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path d="M10.5 21.5 21 11M13 10.5h8.5V19" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = "/", light = false }: { to?: string; light?: boolean }) {
  return (
    <Link to={to} className={"brand" + (light ? " light" : "")}>
      <BrandMark />
      <span className="brand-name">{BRAND}<small>бизнес-кредит</small></span>
    </Link>
  );
}

/** Плавная прокрутка к разделу; если плавная прокрутка не сработала (вкладка в фоне) — мгновенная. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => { if (Math.abs(el.getBoundingClientRect().top) > 80) el.scrollIntoView({ block: "start" }); }, 800);
}

/** Переход к разделу главной; с других страниц — сначала на главную. */
export function useSectionNav() {
  const nav = useNavigate();
  const loc = useLocation();
  return (id: string) => {
    if (loc.pathname === "/") scrollToId(id);
    else nav(`/#${id}`);
  };
}

const NAV: [string, string][] = [["Бизнесу", "business"], ["Кредиты", "credits"], ["Решения", "how"], ["Поддержка", "support"]];

/** Палитра поиска: разделы сайта и заявки пользователя, Ctrl+K. */
function SearchPalette({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const go = useSectionNav();
  const [q, setQ] = useState("");
  const [apps, setApps] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); if (user?.role === "CLIENT") api("/api/applications").then(setApps).catch(() => {}); }, []);
  const items = useMemo(() => {
    const pages: { title: string; hint: string; run: () => void }[] = [
      { title: "Как это работает", hint: "Раздел главной", run: () => go("how") },
      { title: "Кредитные продукты", hint: "Раздел главной", run: () => go("credits") },
      { title: "Вопросы и поддержка", hint: "Раздел главной", run: () => go("support") },
    ];
    if (!user) pages.unshift({ title: "Войти в кабинет", hint: "Страница входа", run: () => nav("/login") });
    if (user?.role === "CLIENT") pages.unshift(
      { title: "Новая заявка", hint: "Подобрать кредит", run: () => nav("/cabinet/new") },
      { title: "Мои заявки", hint: "Кабинет", run: () => nav("/cabinet/applications") },
      { title: "Кредиты и графики платежей", hint: "Кабинет", run: () => nav("/cabinet/loans") },
      { title: "Документы", hint: "Кабинет", run: () => nav("/cabinet/documents") },
      { title: "Настройки", hint: "Кабинет", run: () => nav("/cabinet/settings") },
    );
    if (user && user.role !== "CLIENT") pages.unshift(
      { title: "Очередь заявок", hint: "Рабочее место", run: () => nav("/bank") },
      { title: "Аналитика конвейера", hint: "Рабочее место", run: () => nav("/bank/analytics") },
    );
    const appItems = apps.map((a) => ({ title: `Заявка ${a.number} — ${a.product_name || "черновик"}`, hint: `${a.status.title}, ${money(a.amount)}`, run: () => nav(a.status.code === "DRAFT" ? `/cabinet/new/${a.id}` : `/cabinet/applications/${a.id}`) }));
    const all = [...pages, ...appItems];
    const s = q.trim().toLowerCase();
    return s ? all.filter((x) => (x.title + " " + x.hint).toLowerCase().includes(s)) : all;
  }, [q, apps, user]);
  useEffect(() => setI(0), [q]);
  const run = (k: number) => { const it = items[k]; if (it) { onClose(); it.run(); } };
  return (
    <div className="palette-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Поиск">
        <div className="pal-input">
          <Search size={18} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по сайту и заявкам"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)); }
              if (e.key === "Enter") run(i);
              if (e.key === "Escape") onClose();
            }} />
          <button className="sh-icon" onClick={onClose} aria-label="Закрыть"><X size={16} /></button>
        </div>
        <div className="pal-list">
          {items.length === 0 && <div className="pal-empty">Ничего не нашлось. Попробуйте номер заявки или название раздела.</div>}
          {items.map((it, k) => (
            <button key={it.title} className={"pal-item" + (k === i ? " on" : "")} onMouseEnter={() => setI(k)} onClick={() => run(k)}>
              <FileText size={16} /><span><b>{it.title}</b><small>{it.hint}</small></span>{k === i && <CornerDownLeft size={14} className="faint" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Шапка сайта: одинаковая на главной и в кабинете. */
export default function SiteHeader({ right }: { right?: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const go = useSectionNav();
  const [search, setSearch] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch(true); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <header className="site-header">
      <div className="sh-inner">
        <Logo to="/" />
        <nav className="sh-nav">{NAV.map(([t, id]) => <button key={id} onClick={() => go(id)}>{t}</button>)}</nav>
        <div className="sh-right">
          <button className="sh-search" onClick={() => setSearch(true)} aria-label="Поиск"><Search size={16} /><span>Поиск</span><kbd>Ctrl K</kbd></button>
          {right}
          {user ? (
            <>
              <Link to={homeOf(user)} className="sh-user" title="Перейти в кабинет">
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
      {search && <SearchPalette onClose={() => setSearch(false)} />}
    </header>
  );
}
