import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Building2,
  Calculator,
  Car,
  Check,
  Coffee,
  Eye,
  EyeOff,
  Factory,
  Gavel,
  Laptop,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  UserCog,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import BrandField from "../components/BrandField";
import SplitText from "../components/reactbits/SplitText";
import { AnimatePresence, motion } from "motion/react";
import { lockScroll } from "../scrollLock";
import { Logo } from "../components/SiteHeader";
import { homeOf, useAuth } from "../auth";

const CLIENTS = [
  {
    login: "client_good",
    icon: Coffee,
    who: "ИП, кофейня",
    hint: "Автоодобрение, подпись и выдача",
  },
  {
    login: "client_counter",
    icon: Store,
    who: "ООО «ТоргСнаб», опт",
    hint: "Встречное предложение банка",
  },
  {
    login: "client_info",
    icon: Factory,
    who: "ООО «ЭкоПласт», директор",
    hint: "Банк запрашивает документы",
  },
  {
    login: "accountant_info",
    icon: Calculator,
    who: "ООО «ЭкоПласт», бухгалтер",
    hint: "Оформляет без права подписи",
  },
  {
    login: "client_manual",
    icon: Building2,
    who: "ООО «СтройМаш»",
    hint: "40 млн: специалист и руководитель",
  },
  {
    login: "client_reject",
    icon: Car,
    who: "ИП, автосервис",
    hint: "Отказ с рекомендациями",
  },
  {
    login: "client_liquidated",
    icon: Gavel,
    who: "ООО «Ромашка»",
    hint: "Ликвидация в ЕГРЮЛ",
  },
  {
    login: "client_young",
    icon: Laptop,
    who: "ИП, веб-студия, 2 месяца",
    hint: "Молодой бизнес, другая лента",
  },
];
const BANK = [
  {
    login: "underwriter",
    icon: Briefcase,
    who: "Кредитный аналитик",
    hint: "Очередь и решения до 30 млн ₽",
  },
  {
    login: "approver",
    icon: ShieldCheck,
    who: "Руководитель",
    hint: "Согласование крупных заявок",
  },
  {
    login: "admin",
    icon: UserCog,
    who: "Администратор",
    hint: "Симулятор сбоев интеграций",
  },
];

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [demo, setDemo] = useState(false);
  const [role, setRole] = useState("client");
  const dialog = useRef<HTMLDialogElement>(null);
  const accountObserver = useRef<ResizeObserver | null>(null);
  const [accountsHeight, setAccountsHeight] = useState<number | null>(null);
  const measureAccounts = useCallback((node: HTMLDivElement | null) => {
    accountObserver.current?.disconnect();
    if (!node) return;
    const measure = () => {
      if (node.offsetHeight) setAccountsHeight(node.offsetHeight);
    };
    measure();
    accountObserver.current = new ResizeObserver(measure);
    accountObserver.current.observe(node);
  }, []);
  const auth = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (demo && !el.open) el.showModal();
    if (!el.open) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animation = el.animate(
      demo
        ? [
            { opacity: 0, transform: "translateY(25px) scale(.97)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ]
        : [
            { opacity: 1, transform: "translateY(0) scale(1)" },
            { opacity: 0, transform: "translateY(15px) scale(.98)" },
          ],
      {
        duration: reduce ? 1 : demo ? 380 : 220,
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "both",
      },
    );
    animation.finished
      .then(() => {
        if (!demo) el.close();
      })
      .catch(() => {});
    return () => animation.cancel();
  }, [demo]);
  useEffect(() => {
    if (demo) return lockScroll();
  }, [demo]);
  const doLogin = async (l: string, p: string) => {
    if (busy) return;
    setErr("");
    setBusy(l);
    try {
      const r = await api("/api/auth/login", {
        body: { login: l, password: p },
      });
      auth.login(r.token, r.user);
      nav(homeOf(r.user));
    } catch (e: any) {
      setErr(
        e.status === 401
          ? "Не удалось войти. Проверьте логин и пароль или выберите демо-аккаунт."
          : e.message,
      );
      setBusy("");
    }
  };
  return (
    <div className="studio-login">
      <aside className="st-login-story vx-login-story">
        <div className="vx-login-field" aria-hidden="true">
          <BrandField />
        </div>
        <header>
          <Logo light />
          <span>Кредитный кабинет</span>
        </header>
        <div className="st-login-editorial">
          <span className="st-kicker">На стороне вашего бизнеса</span>
          <h1>
            <SplitText
              text="Ваше дело."
              tag="span"
              textAlign="left"
              trigger="load"
              effect="rise"
              mask={false}
              duration={0.9}
            />
            <br />
            <SplitText
              text="Ваш вектор."
              tag="span"
              textAlign="left"
              trigger="load"
              effect="rise"
              mask={false}
              duration={1.1}
            />
          </h1>
          <p>
            От первой заявки до больших планов.
            <br />
            Всё, что нужно для финансирования,
            <br />
            собрано в одном кабинете.
          </p>
        </div>
        <div className="st-login-route">
          <div>
            <span>01</span>
            <b>Выберите</b>
            <p>Кредит под задачу</p>
          </div>
          <ArrowRight size={20} />
          <div>
            <span>02</span>
            <b>Оформите</b>
            <p>Заявку онлайн</p>
          </div>
          <ArrowRight size={20} />
          <div>
            <span>03</span>
            <b>Действуйте</b>
            <p>С поддержкой банка</p>
          </div>
        </div>
        <footer>
          <span>ВЕКТОР / БИЗНЕС</span>
          <ArrowUpRight size={24} />
        </footer>
      </aside>
      <main className="st-login-main">
        <Link className="st-login-back" to="/">
          <ArrowLeft size={18} /> На главную
        </Link>
        <div className="st-login-form-wrap">
          <div className="st-login-lock">
            <LockKeyhole size={20} />
            <span>Защищённый вход</span>
          </div>
          <span className="st-kicker">Ваш кредитный кабинет</span>
          <h2>Продолжим?</h2>
          <p className="st-login-intro">
            Войдите, чтобы работать с заявками,
            <br className="st-desktop" /> документами и финансами компании.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doLogin(login.trim(), password);
            }}
            className="st-login-form"
          >
            <label htmlFor="st-login">Логин</label>
            <div className="st-input">
              <User size={20} />
              <input
                id="st-login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                placeholder="Введите ваш логин"
                required
              />
            </div>
            <label htmlFor="st-password">Пароль</label>
            <div className="st-input">
              <LockKeyhole size={20} />
              <input
                id="st-password"
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Введите пароль"
                required
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
              >
                {visible ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {err && (
              <p className="st-login-error" role="alert">
                {err}
              </p>
            )}
            <button
              className="st-button st-login-submit"
              type="submit"
              disabled={!login.trim() || !password || !!busy}
            >
              {busy ? "Входим…" : "Войти в кабинет"}
              <ArrowRight size={20} />
            </button>
          </form>
          <div className="st-login-divider">
            <span>или познакомьтесь с продуктом</span>
          </div>
          <button
            className="st-login-demo"
            onClick={() => {
              setErr("");
              setDemo(true);
            }}
          >
            <span className="st-demo-icon">
              <Sparkles size={23} />
            </span>
            <span>
              <b>Открыть демоверсию</b>
              <small>11 сценариев для бизнеса и банка</small>
            </span>
            <ArrowUpRight size={21} />
          </button>
          <p className="st-login-note">
            <ShieldCheck size={17} />
            <span>
              Прототип на синтетических данных.
              <br />
              Демо-пароль: <code>demo123</code>
            </span>
          </p>
        </div>
        <footer className="st-login-footer">
          <span>© 2026 Вектор</span>
          <Link to="/">
            О платформе <ArrowUpRight size={16} />
          </Link>
        </footer>
      </main>
      <dialog
        ref={dialog}
        className="st-demo-dialog"
        onCancel={(e) => {
          e.preventDefault();
          setDemo(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDemo(false);
        }}
        aria-labelledby="st-demo-title"
      >
        <div className="st-demo-head">
          <div>
            <span className="st-kicker">Попробуйте в деле</span>
            <h2 id="st-demo-title">Выберите свой сценарий</h2>
            <p>Вход выполнится сразу после выбора аккаунта.</p>
          </div>
          <button
            className="st-icon-button"
            onClick={() => setDemo(false)}
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>
        <div className="st-filters" role="group" aria-label="Тип демо-аккаунта">
          <button
            className={role === "client" ? "active" : ""}
            aria-pressed={role === "client"}
            onClick={() => setRole("client")}
          >
            {role === "client" && (
              <motion.i
                layoutId="demo-role-active"
                className="vf-demo-role-active"
              />
            )}
            <b>
              Предприниматели <span>8</span>
            </b>
          </button>
          <button
            className={role === "bank" ? "active" : ""}
            aria-pressed={role === "bank"}
            onClick={() => setRole("bank")}
          >
            {role === "bank" && (
              <motion.i
                layoutId="demo-role-active"
                className="vf-demo-role-active"
              />
            )}
            <b>
              Команда банка <span>3</span>
            </b>
          </button>
        </div>
        {err && (
          <p className="st-login-error" role="alert">
            {err}
          </p>
        )}
        <motion.div
          className="vf-demo-window"
          animate={{ height: accountsHeight ?? "auto" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="st-demo-accounts"
              ref={measureAccounts}
              key={`${role}-${demo}`}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.045 } },
                exit: { opacity: 0, y: -8, transition: { duration: 0.17 } },
              }}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {(role === "client" ? CLIENTS : BANK).map((a) => {
                const Icon = a.icon;
                return (
                  <motion.button
                    variants={{
                      hidden: { opacity: 0, y: 14 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.35 },
                      },
                    }}
                    key={a.login}
                    disabled={!!busy}
                    onClick={() => doLogin(a.login, "demo123")}
                  >
                    <span className="st-demo-account-icon">
                      <Icon size={24} />
                    </span>
                    <span>
                      <b>{a.who}</b>
                      <small>
                        {busy === a.login ? "Входим в кабинет…" : a.hint}
                      </small>
                      <code>{a.login}</code>
                    </span>
                    <ArrowUpRight size={19} />
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <div className="st-demo-footer">
          <ShieldCheck size={16} />
          <span>Все компании и заявки в демо — вымышленные.</span>
        </div>
      </dialog>
    </div>
  );
}
