import { ArrowLeft, Briefcase, Building2, Calculator, Car, Coffee, Factory, Gavel, Laptop, Lock, ShieldCheck, Sparkles, Store, User, UserCog, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import SiteHeader from "../components/SiteHeader";
import { homeOf, useAuth } from "../main";

const CLIENTS = [
  { login: "client_good", icon: Coffee, who: "ИП · кофейня", hint: "Автоодобрение → подпись → выдача" },
  { login: "client_counter", icon: Store, who: "ООО «ТоргСнаб» · опт", hint: "Встречное предложение" },
  { login: "client_info", icon: Factory, who: "ООО «ЭкоПласт» · директор", hint: "Банк запрашивает документы" },
  { login: "accountant_info", icon: Calculator, who: "ООО «ЭкоПласт» · бухгалтер", hint: "Оформляет, без права подписи" },
  { login: "client_manual", icon: Building2, who: "ООО «СтройМаш»", hint: "40 млн → специалист → руководитель" },
  { login: "client_reject", icon: Car, who: "ИП · автосервис", hint: "Отказ с рекомендациями" },
  { login: "client_liquidated", icon: Gavel, who: "ООО «Ромашка»", hint: "Ликвидация в ЕГРЮЛ — стоп-фактор" },
  { login: "client_young", icon: Laptop, who: "ИП · веб-студия, 2 мес.", hint: "Молодой бизнес: другая лента" },
];
const BANK = [
  { login: "underwriter", icon: Briefcase, who: "Кредитный аналитик", hint: "Очередь и решения до 30 млн ₽" },
  { login: "approver", icon: ShieldCheck, who: "Руководитель", hint: "Согласование крупных заявок" },
  { login: "admin", icon: UserCog, who: "Администратор", hint: "Симулятор сбоев интеграций" },
];

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [demo, setDemo] = useState(false);
  const auth = useAuth();
  const nav = useNavigate();

  const doLogin = async (l: string, p: string) => {
    setErr("");
    setBusy(l);
    try {
      const r = await api("/api/auth/login", { body: { login: l, password: p } });
      auth.login(r.token, r.user);
      nav(homeOf(r.user));
    } catch (e: any) {
      setErr(e.message);
      setBusy("");
    }
  };

  const Acc = ({ a, i }: { a: any; i: number }) => {
    const Icon = a.icon;
    return (
      <button className="acc" style={{ ["--d" as any]: `${0.05 + i * 0.025}s` }} onClick={() => doLogin(a.login, "demo123")} disabled={!!busy}>
        <span className="acc-ico">{busy === a.login ? <span className="spin" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Icon size={18} />}</span>
        <span className="acc-text"><b>{a.who}</b><small>{a.hint}</small><em>{a.login}</em></span>
      </button>
    );
  };

  return (
    <div className="landing">
      <SiteHeader />
      <div className="auth">
        <div className="auth-card anim-hero">
          <Link to="/" className="back-link"><ArrowLeft size={15} /> На главную</Link>
          <h1>Вход в кабинет</h1>
          <p className="muted">Предприниматель или сотрудник банка — один вход для всех ролей.</p>
          <form className="form" onSubmit={(e) => { e.preventDefault(); doLogin(login, password); }}>
            <label className="fld"><span>Логин</span><div className="fld-ico"><User size={16} /><input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Введите логин" autoComplete="username" /></div></label>
            <label className="fld"><span>Пароль</span><div className="fld-ico"><Lock size={16} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" autoComplete="current-password" /></div></label>
            {err && <div className="alert bad">{err}</div>}
            <button className="btn btn-lg btn-block" disabled={!login || !password || !!busy}>Войти</button>
          </form>
          <div className="or">или</div>
          <button className="demo-btn" onClick={() => setDemo(true)}>
            <span className="ico"><Sparkles size={20} /></span>
            <span style={{ flex: 1, textAlign: "left" }}><b>Демо-аккаунты</b><small>11 готовых сценариев: от автоодобрения до эскалации</small></span>
            <span className="arrow">→</span>
          </button>
          <p className="faint small" style={{ marginTop: 20 }}>Прототип на синтетических данных. Пароль демо-учёток: demo123</p>
        </div>
      </div>

      {demo && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setDemo(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <div><h2>Выберите сценарий</h2><p className="muted small">Нажмите на карточку — вход выполнится автоматически.</p></div>
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
