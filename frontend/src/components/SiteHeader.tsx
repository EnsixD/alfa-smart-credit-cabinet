import {
  CornerDownLeft,
  FileText,
  LogOut,
  Menu,
  Search,
  X,
  ArrowUpRight,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion } from "motion/react";
import { lockScroll } from "../scrollLock";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, money } from "../api";
import { homeOf, useAuth } from "../auth";

export const initials = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
export const BRAND = "Вектор";

/** Знак «Вектора»: стрелка вверх-вправо — движение бизнеса вперёд. */
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <img
      className="brand-mark vx-brand-mark"
      src="/img/vektor-monogram.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}

export function Logo({
  to = "/",
  light = false,
}: {
  to?: string;
  light?: boolean;
}) {
  return (
    <Link to={to} className={"brand" + (light ? " light" : "")}>
      <BrandMark />
      <span className="brand-name">
        {BRAND}
        <small>бизнес-кредит</small>
      </span>
    </Link>
  );
}

/** Плавная прокрутка к разделу; если плавная прокрутка не сработала (вкладка в фоне) — мгновенная. */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
  setTimeout(() => {
    if (Math.abs(el.getBoundingClientRect().top) > 80)
      el.scrollIntoView({ block: "start" });
  }, 800);
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

const NAV: [string, string][] = [
  ["Бизнесу", "business"],
  ["Кредиты", "credits"],
  ["Решения", "how"],
  ["Поддержка", "support"],
];

/** Палитра поиска: разделы сайта и заявки пользователя, Ctrl+K. */
function SearchPalette({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const go = useSectionNav();
  const [q, setQ] = useState("");
  const [apps, setApps] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const unlock = lockScroll();
    const focused = document.activeElement as HTMLElement | null;
    return () => {
      unlock();
      focused?.focus();
    };
  }, []);
  useEffect(() => {
    input.current?.focus();
    if (user?.role === "CLIENT")
      api("/api/applications")
        .then(setApps)
        .catch(() => {});
  }, []);
  const items = useMemo(() => {
    const pages: { title: string; hint: string; run: () => void }[] = [
      {
        title: "Как это работает",
        hint: "Раздел главной",
        run: () => go("how"),
      },
      {
        title: "Кредитные продукты",
        hint: "Раздел главной",
        run: () => go("credits"),
      },
      {
        title: "Вопросы и поддержка",
        hint: "Раздел главной",
        run: () => go("support"),
      },
    ];
    if (!user)
      pages.unshift({
        title: "Войти в кабинет",
        hint: "Страница входа",
        run: () => nav("/login"),
      });
    if (user?.role === "CLIENT")
      pages.unshift(
        {
          title: "Новая заявка",
          hint: "Подобрать кредит",
          run: () => nav("/cabinet/new"),
        },
        {
          title: "Мои заявки",
          hint: "Кабинет",
          run: () => nav("/cabinet/applications"),
        },
        {
          title: "Кредиты и графики платежей",
          hint: "Кабинет",
          run: () => nav("/cabinet/loans"),
        },
        {
          title: "Документы",
          hint: "Кабинет",
          run: () => nav("/cabinet/documents"),
        },
        {
          title: "Настройки",
          hint: "Кабинет",
          run: () => nav("/cabinet/settings"),
        },
      );
    if (user && user.role !== "CLIENT")
      pages.unshift(
        {
          title: "Очередь заявок",
          hint: "Рабочее место",
          run: () => nav("/bank"),
        },
        {
          title: "Аналитика конвейера",
          hint: "Рабочее место",
          run: () => nav("/bank/analytics"),
        },
      );
    const appItems = apps.map((a) => ({
      title: `Заявка ${a.number} — ${a.product_name || "черновик"}`,
      hint: `${a.status.title}, ${money(a.amount)}`,
      run: () =>
        nav(
          a.status.code === "DRAFT"
            ? `/cabinet/new/${a.id}`
            : `/cabinet/applications/${a.id}`,
        ),
    }));
    const all = [...pages, ...appItems];
    const s = q.trim().toLowerCase();
    return s
      ? all.filter((x) => (x.title + " " + x.hint).toLowerCase().includes(s))
      : all;
  }, [q, apps, user]);
  useEffect(() => setI(0), [q]);
  const run = (k: number) => {
    const it = items[k];
    if (it) {
      onClose();
      it.run();
    }
  };
  return createPortal(
    <div
      className="palette-back"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key !== "Tab") return;
        const nodes = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>("input,button,a[href]"),
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск"
      >
        <div className="pal-input">
          <Search size={18} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по сайту и заявкам"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((x) => Math.min(x + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => Math.max(x - 1, 0));
              }
              if (e.key === "Enter") run(i);
              if (e.key === "Escape") onClose();
            }}
          />
          <button className="sh-icon" onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>
        <div className="pal-list">
          {items.length === 0 && (
            <div className="pal-empty">
              Ничего не нашлось. Попробуйте номер заявки или название раздела.
            </div>
          )}
          {items.map((it, k) => (
            <button
              key={it.title}
              className={"pal-item" + (k === i ? " on" : "")}
              onMouseEnter={() => setI(k)}
              onClick={() => run(k)}
            >
              <FileText size={16} />
              <span>
                <b>{it.title}</b>
                <small>{it.hint}</small>
              </span>
              {k === i && <CornerDownLeft size={14} className="faint" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FullscreenMenu({
  onClose,
  onGo,
  user,
}: {
  onClose: () => void;
  onGo: (id: string) => void;
  user: any;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    box.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      unlock();
      previous?.focus();
    };
  }, []);
  return (
    <motion.div
      ref={box}
      className="vf-mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Навигация"
      initial={{
        opacity: 0,
        clipPath: "inset(0 0 100% 0 round 0 0 40px 40px)",
      }}
      animate={{ opacity: 1, clipPath: "inset(0 0 0% 0 round 0 0 0px 0px)" }}
      exit={{ opacity: 0, clipPath: "inset(0 0 100% 0 round 0 0 40px 40px)" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const nodes = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>("a,button"),
          );
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div className="vf-mobile-top">
        <Logo />
        <button onClick={onClose} aria-label="Закрыть меню">
          <X size={25} />
        </button>
      </div>
      <nav id="site-mobile-navigation" aria-label="Разделы сайта">
        {NAV.map(([label, id], i) => (
          <motion.button
            key={id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.07, duration: 0.5 }}
            onClick={() => {
              onClose();
              onGo(id);
            }}
          >
            <span>0{i + 1}</span>
            <b>{label}</b>
            <ArrowUpRight size={30} />
          </motion.button>
        ))}
      </nav>
      <motion.div
        className="vf-mobile-bottom"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <span>
          Ваш бизнес.
          <br />
          Ваше направление.
        </span>
        <Link
          to={user ? homeOf(user) : "/login"}
          className="st-button"
          onClick={onClose}
        >
          В кабинет <ArrowUpRight size={20} />
        </Link>
      </motion.div>
    </motion.div>
  );
}

/** Шапка сайта: одинаковая на главной и в кабинете. */
export default function SiteHeader({
  right,
  cabinet = false,
}: {
  right?: ReactNode;
  cabinet?: boolean;
}) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const go = useSectionNav();
  const [activeSection, setActiveSection] = useState("business");
  useEffect(() => {
    if (cabinet) return;
    const update = () => {
      let current = "business";
      for (const [, id] of NAV) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= window.innerHeight * .35) current = id;
      }
      setActiveSection(current);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, [cabinet]);
  const [search, setSearch] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMobile(false);
        setSearch(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <header className={"site-header" + (cabinet ? " vf-cabinet-header" : "")}>
      <div className="sh-inner">
        <Logo to="/" />
        {!cabinet && (
          <nav id="site-navigation" className="sh-nav vf-desktop-nav vf-clean-nav" aria-label="Главная навигация">
            {NAV.map(([label, id]) => (
              <button key={id} type="button" aria-current={activeSection === id ? "location" : undefined}
                onClick={() => { setActiveSection(id); go(id); }}>
                {activeSection === id && <motion.span className="vf-nav-active" layoutId="public-navigation" transition={{ duration: .3, ease: [.22, 1, .36, 1] }} />}
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
        {cabinet && (
          <span className="vf-cabinet-header-label">
            {user?.role === "CLIENT"
              ? "Личный кабинет"
              : "Рабочее пространство"}
          </span>
        )}
        <div className="sh-right">
          <button
            className="sh-search"
            onClick={() => setSearch(true)}
            aria-label="Поиск"
          >
            <Search size={16} />
            <span>Поиск</span>
            <kbd>Ctrl K</kbd>
          </button>
          {right}
          {user ? (
            <>
              <Link
                to={homeOf(user)}
                className="sh-user"
                title="Перейти в кабинет"
              >
                <span className="sh-avatar">{initials(user.full_name)}</span>
                <span className="sh-user-text">
                  <b>{user.full_name.split(" ").slice(0, 2).join(" ")}</b>
                  <small>
                    {user.role === "CLIENT"
                      ? user.company?.name
                      : user.position}
                  </small>
                </span>
              </Link>
              <button
                className="sh-icon"
                aria-label="Выйти"
                title="Выйти"
                onClick={() => {
                  logout();
                  nav("/");
                }}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-sm">
              Войти
            </Link>
          )}
          {!cabinet && (
            <button
              className="sh-menu"
              aria-label={mobile ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobile}
              aria-controls="site-mobile-navigation"
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}
        </div>
      </div>
      {search && <SearchPalette onClose={() => setSearch(false)} />}
      {createPortal(
        <AnimatePresence>
          {mobile && (
            <FullscreenMenu
              onClose={() => setMobile(false)}
              onGo={go}
              user={user}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </header>
  );
}
