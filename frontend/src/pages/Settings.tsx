import {
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  Check,
  Copy,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, money } from "../api";
import { AnimatedNumber } from "../anim";
import { useAuth } from "../auth";
import BlurText from "../components/reactbits/BlurText";
import SpotlightCard from "../components/reactbits/SpotlightCard";
import { getPrefs, setPrefs, type Prefs } from "../prefs";
import "./Settings.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const SEGMENTS: Record<string, string> = { micro: "Микробизнес", small: "Малый бизнес", medium: "Средний бизнес" };
const item = { h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

function initials(name = "") {
  const w = name.split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase();
}

function yearsSince(iso?: string) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86400000));
  const y = Math.floor(m / 12);
  const w = (n: number, a: string, b: string, c: string) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
  return y ? `${y} ${w(y, "год", "года", "лет")} на рынке` : `${m} ${w(m, "месяц", "месяца", "месяцев")} на рынке`;
}

/** Строка реквизита с копированием в один клик. */
function Field({ label, value, mono, icon: Icon }: { label: string; value?: string; mono?: boolean; icon?: any }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* буфер недоступен */ }
  };
  return (
    <div className="st-field">
      <span className="st-field-label">{Icon && <Icon size={13} />} {label}</span>
      <div className="st-field-val">
        <b className={mono ? "mono" : ""}>{value || "—"}</b>
        {value && (
          <button onClick={copy} aria-label={`Скопировать: ${label}`} className={done ? "done" : ""}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={done ? "ok" : "c"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                {done ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, title, text, icon: Icon }: { on: boolean; onChange: (v: boolean) => void; title: string; text: string; icon: any }) {
  return (
    <button className={"st-toggle" + (on ? " on" : "")} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="st-toggle-ico"><Icon size={17} /></span>
      <span className="st-toggle-txt"><b>{title}</b><small>{text}</small></span>
      <span className="st-switch"><motion.i layout transition={{ type: "spring", stiffness: 600, damping: 34 }} /></span>
    </button>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [company, setCompany] = useState<any>(user?.company || null);
  const [prefs, setP] = useState<Prefs>(getPrefs());
  useEffect(() => { api("/api/company").then((r) => setCompany(r.company)).catch(() => {}); }, []);
  const c = company;
  const update = (patch: Partial<Prefs>) => setP(setPrefs(patch));
  const fin = c ? [
    { label: "Выручка за год", value: c.annual_revenue, icon: BarChart3 },
    { label: "Расходы за год", value: c.annual_expenses, icon: BarChart3 },
    { label: "Платежи по кредитам в месяц", value: c.monthly_debt_payments, icon: KeyRound },
    { label: "Оборот по счёту в месяц", value: c.account_turnover_month, icon: Sparkles },
  ] : [];

  return (
    <motion.div className="page st" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.07 } } }}>
      <motion.header className="st-hero" variants={item}>
        <span className="st-ava">{initials(user?.full_name)}</span>
        <div className="st-hero-main">
          <span className="st-eyebrow">Настройки</span>
          <BlurText text={user?.full_name || "Профиль"} className="st-h1" animateBy="words" delay={40} stepDuration={0.2} trigger="load" />
          <div className="st-chips">
            <span>{user?.position}</span>
            <span className={user?.can_sign ? "ok" : "warn"}>{user?.can_sign ? <><PenLine size={13} /> Право подписи</> : <><ShieldAlert size={13} /> Без права подписи</>}</span>
            <span className="muted"><UserRound size={13} /> {user?.login}</span>
          </div>
        </div>
        <div className="st-hero-org">
          <Building2 size={16} />
          <div><b>{c?.name}</b><small>{yearsSince(c?.reg_date)}{c?.segment ? ` · ${SEGMENTS[c.segment] || c.segment}` : ""}</small></div>
        </div>
      </motion.header>

      <div className="st-grid">
        <div className="st-col">
          <motion.section className="st-card" variants={item}>
            <div className="st-card-head">
              <span className="st-ico"><Building2 size={18} /></span>
              <div><h2>Реквизиты компании</h2><p><Lock size={12} /> Из ЕГРЮЛ — изменить можно через поддержку</p></div>
            </div>
            <div className="st-fields">
              <div className="wide"><Field label="Полное название" value={c?.name} /></div>
              <Field label="ИНН" value={c?.inn} mono />
              <Field label="ОГРН" value={c?.ogrn} mono />
              <div className="wide"><Field label="Вид деятельности" value={c ? `${c.okved} · ${c.okved_name}` : ""} /></div>
              <div className="wide"><Field label="Юридический адрес" value={c?.address} icon={MapPin} /></div>
              <Field label="Руководитель" value={c?.director} />
              <Field label="Дата регистрации" value={c?.reg_date ? new Date(c.reg_date).toLocaleDateString("ru-RU") : ""} mono />
            </div>
          </motion.section>

          <motion.section className="st-card" variants={item}>
            <div className="st-card-head">
              <span className="st-ico"><BarChart3 size={18} /></span>
              <div><h2>Финансовый профиль</h2><p>По этим данным подбираем продукты и предзаполняем заявку</p></div>
            </div>
            <div className="st-fin">
              {fin.map((f, i) => (
                <SpotlightCard key={f.label} theme="light" spotlightColor="rgba(239,49,36,0.10)" className="st-fin-card">
                  <span className="st-fin-ico"><f.icon size={15} /></span>
                  <small>{f.label}</small>
                  <strong><AnimatedNumber value={f.value || 0} format={money} duration={0.8 + i * 0.1} /></strong>
                </SpotlightCard>
              ))}
            </div>
          </motion.section>
        </div>

        <div className="st-col">
          <motion.section className="st-card" variants={item}>
            <div className="st-card-head">
              <span className="st-ico"><PenLine size={18} /></span>
              <div><h2>Доступ и подпись</h2><p>Что вы можете делать в кабинете</p></div>
            </div>
            <ul className="st-rights">
              {[
                ["Оформлять и отправлять заявки", true],
                ["Общаться с банком и загружать документы", true],
                ["Принимать предложения банка", true],
                ["Подписывать кредитный договор", !!user?.can_sign],
              ].map(([t, ok]) => (
                <li key={String(t)} className={ok ? "ok" : "no"}><span>{ok ? <Check size={12} strokeWidth={3.2} /> : "—"}</span>{t}</li>
              ))}
            </ul>
            {!user?.can_sign && <p className="st-note">Договор подпишет руководитель компании в своём кабинете — вы увидите статус в заявке.</p>}
          </motion.section>

          <motion.section className="st-card" variants={item}>
            <div className="st-card-head">
              <span className="st-ico"><Wand2 size={18} /></span>
              <div><h2>Уведомления и интерфейс</h2><p>Сохраняется в этом браузере</p></div>
            </div>
            <Toggle icon={Bell} on={prefs.toasts} onChange={(v) => update({ toasts: v })} title="Всплывающие уведомления" text="Карточка справа сверху, когда меняется статус заявки" />
            <Toggle icon={Sparkles} on={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} title="Упрощённые анимации" text="Меньше движения на страницах — удобно на слабых устройствах" />
          </motion.section>

          <motion.section className="st-card st-security" variants={item}>
            <div className="st-card-head">
              <span className="st-ico dark"><ShieldCheck size={18} /></span>
              <div><h2>Безопасность</h2><p>Как защитить доступ к кабинету</p></div>
            </div>
            <ul className="st-tips">
              <li><BadgeCheck size={15} /> Банк никогда не просит коды подтверждения по телефону</li>
              <li><BadgeCheck size={15} /> Все действия по заявке — только в этом кабинете</li>
              <li><BadgeCheck size={15} /> Не передавайте логин и пароль сотрудникам — у каждого свой доступ</li>
            </ul>
            <button className="st-logout" onClick={() => { logout(); nav("/"); }}><LogOut size={16} /> Выйти из кабинета</button>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}
