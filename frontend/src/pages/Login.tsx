import { ArrowLeft, Briefcase, Building2, Calculator, Car, Check, Coffee, Factory, Gavel, Laptop, Lock, ShieldCheck, Sparkles, Store, User, UserCog, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { AnimatedNumber } from "../anim";
import { BRAND, Logo } from "../components/SiteHeader";
import { homeOf, useAuth } from "../main";

const CLIENTS = [
  { login: "client_good", icon: Coffee, who: "ИП, кофейня", hint: "Автоодобрение, подпись и выдача" },
  { login: "client_counter", icon: Store, who: "ООО «ТоргСнаб», опт", hint: "Встречное предложение банка" },
  { login: "client_info", icon: Factory, who: "ООО «ЭкоПласт», директор", hint: "Банк запрашивает документы" },
  { login: "accountant_info", icon: Calculator, who: "ООО «ЭкоПласт», бухгалтер", hint: "Оформляет без права подписи" },
  { login: "client_manual", icon: Building2, who: "ООО «СтройМаш»", hint: "40 млн: специалист и руководитель" },
  { login: "client_reject", icon: Car, who: "ИП, автосервис", hint: "Отказ с рекомендациями" },
  { login: "client_liquidated", icon: Gavel, who: "ООО «Ромашка»", hint: "Ликвидация в ЕГРЮЛ" },
  { login: "client_young", icon: Laptop, who: "ИП, веб-студия, 2 месяца", hint: "Молодой бизнес, другая лента" },
];
const BANK = [
  { login: "underwriter", icon: Briefcase, who: "Кредитный аналитик", hint: "Очередь и решения до 30 млн ₽" },
  { login: "approver", icon: ShieldCheck, who: "Руководитель", hint: "Согласование крупных заявок" },
  { login: "admin", icon: UserCog, who: "Администратор", hint: "Симулятор сбоев интеграций" },
];
const STAGES = ["Заявка принята", "Проверка в ЕГРЮЛ и ФНС", "Бюро кредитных историй", "Скоринг и решение", "Договор подписан", "Деньги на счёте"];

/** Живая карточка заявки: этапы конвейера проходят по кругу. */
function PipelineCard() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStage((s) => (s >= STAGES.length + 2 ? 0 : s + 1)), 1100);
    return () => clearInterval(t);
  }, []);
  const done = stage >= STAGES.length;
  return (
    <div className={"pipe" + (done ? " done" : "")}>
      <div className="pipe-top"><span>Заявка 2610-00042</span><span className="pipe-badge">{done ? "Выдано" : "В работе"}</span></div>
      <div className="pipe-sum"><AnimatedNumber value={stage === 0 ? 0 : 2_000_000} format={(v) => Math.round(v).toLocaleString("ru-RU") + " ₽"} duration={1} /></div>
      <div className="pipe-sub">Экспресс-кредит на 12 месяцев</div>
      <div className="pipe-bar"><i style={{ transform: `scaleX(${Math.min(stage, STAGES.length) / STAGES.length})` }} /></div>
      <ul>
        {STAGES.map((s, i) => (
          <li key={s} className={i < stage ? "ok" : i === stage ? "now" : ""}>
            <span className="pipe-dot">{i < stage ? <Check size={12} strokeWidth={3} /> : null}</span>{s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [demo, setDemo] = useState(false);
  const auth = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && setDemo(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const doLogin = async (l: string, p: string) => {
    setErr("");
    setBusy(l);
    try {
      const r = await api("/api/auth/login", { body: { login: l, password: p } });
      auth.login(r.token, r.user);
      nav(homeOf(r.user));
    } catch (e: any) {
      setErr(e.status === 401 ? "Неверный логин или пароль. Проверьте раскладку или войдите через демо-аккаунт." : e.message);
      setBusy("");
    }
  };

  const Acc = ({ a, i }: { a: any; i: number }) => {
    const Icon = a.icon;
    return (
      <button className="acc" style={{ ["--d" as any]: `${0.04 + i * 0.025}s` }} onClick={() => doLogin(a.login, "demo123")} disabled={!!busy}>
        <span className="acc-ico">{busy === a.login ? <span className="spin" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Icon size={18} />}</span>
        <span className="acc-text"><b>{a.who}</b><small>{a.hint}</small><em>{a.login}</em></span>
      </button>
    );
  };

  return (
    <div className="signin page-enter">
      <aside className="si-art">
        <div className="si-grid" aria-hidden />
        <div className="si-glow" aria-hidden />
        <Logo light />
        <div className="si-center"><PipelineCard /></div>
        <div className="si-copy">
          <h2>Кредит для бизнеса проходит путь от заявки до денег у вас на глазах</h2>
          <p>Каждый этап виден в кабинете в реальном времени: проверки, решение, подписание и зачисление.</p>
        </div>
      </aside>

      <main className="si-main">
        <Link to="/" className="back-link"><ArrowLeft size={15} /> На главную</Link>
        <div className="si-form">
          <h1>Вход в кабинет</h1>
          <p className="muted">Один вход для предпринимателей и сотрудников банка.</p>
          <form className="form" onSubmit={(e) => { e.preventDefault(); doLogin(login, password); }}>
            <label className="fld"><span>Логин</span><div className="fld-ico"><User size={16} /><input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Например, client_good" autoComplete="username" /></div></label>
            <label className="fld"><span>Пароль</span><div className="fld-ico"><Lock size={16} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" autoComplete="current-password" /></div></label>
            {err && <div className="alert bad">{err}</div>}
            <button className="btn btn-lg btn-block" disabled={!login || !password || !!busy}>{busy && busy === login ? "Входим…" : "Войти"}</button>
          </form>
          <div className="or">или</div>
          <button className="demo-btn" onClick={() => setDemo(true)}>
            <span className="ico"><Sparkles size={20} /></span>
            <span style={{ flex: 1, textAlign: "left" }}><b>Войти через демо-аккаунт</b><small>11 готовых сценариев — от автоодобрения до эскалации</small></span>
          </button>
          <p className="faint small" style={{ marginTop: 20 }}>{BRAND} — прототип на синтетических данных. Пароль всех демо-аккаунтов: demo123</p>
        </div>
      </main>

      {demo && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setDemo(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="demo-title">
            <div className="modal-head">
              <div><h2 id="demo-title">Выберите сценарий</h2><p className="muted small">Вход выполнится сразу после выбора.</p></div>
              <button className="sh-icon" onClick={() => setDemo(false)} aria-label="Закрыть"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="modal-group">Предприниматели</div>
              <div className="acc-grid">{CLIENTS.map((a, i) => <Acc key={a.login} a={a} i={i} />)}</div>
              <div className="modal-group">Сотрудники банка</div>
              <div className="acc-grid">{BANK.map((a, i) => <Acc key={a.login} a={a} i={i + 8} />)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
