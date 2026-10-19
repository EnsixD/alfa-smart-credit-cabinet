import { Briefcase, Building2, Calculator, Car, CircleCheck, Coffee, FileText, Landmark, Loader, PhoneOff, Timer, Factory, Gavel, KeyRound, Laptop, Lock, ShieldCheck, Sparkles, Store, User, UserCog, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { gsap } from "../anim";
import { useAuth } from "../main";

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
  const page = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Вступление: контент проявляется CSS-анимацией (styles.css), здесь — только декоративная прорисовка сетки
      gsap.from(".grid-svg line:not(.accent)", { strokeDasharray: 1600, strokeDashoffset: 1600, duration: 1.4, stagger: 0.03, ease: "power2.inOut" });

      // 2. Цикл: заявка проходит конвейер внутри карточки (только прозрачность — текст не сдвигается)
      const STEPS = ["Проверяем полноту данных", "Сверяем с ЕГРЮЛ и ФНС", "Запрашиваем бюро историй", "Скоринг: рейтинг A", "Формируем решение", "Одобрено за 47 секунд"];
      const sum = { v: 0 };
      const sumEl = document.querySelector<HTMLElement>(".m-sum");
      const txt = document.querySelector<HTMLElement>(".m-text");
      const stepEl = document.querySelector<HTMLElement>(".m-step");
      const swap = (i: number) => { if (txt) txt.textContent = STEPS[i]; if (stepEl) stepEl.textContent = `Этап ${i + 1} из ${STEPS.length}`; };
      const loop = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 1.4 });
      loop.set(".m-bars b", { scaleX: 0 }).set(".m-check", { autoAlpha: 0.25 }).set(".m-badge.ok", { autoAlpha: 0 }).set(".m-badge.wip", { autoAlpha: 1 })
        .set(sum, { v: 0 }).call(swap, [0]).set(".m-line", { autoAlpha: 1 })
        .to(sum, { v: 2000000, duration: 1.2, ease: "power2.out", onUpdate: () => { if (sumEl) sumEl.textContent = Math.round(sum.v).toLocaleString("ru-RU") + " ₽"; } });
      STEPS.forEach((_, i) => {
        if (i > 0) loop.to(".m-line", { autoAlpha: 0, duration: 0.2 }, "+=0.55").call(swap, [i]).to(".m-line", { autoAlpha: 1, duration: 0.25 });
        loop.to(`.m-bars i:nth-child(${i + 1}) b`, { scaleX: 1, duration: 0.6, ease: "power2.inOut" }, "<");
        if (i >= 1 && i <= 3) loop.to(`.m-checks > div:nth-child(${i}) .m-check`, { autoAlpha: 1, duration: 0.3 }, "<0.2");
      });
      loop.to(".m-badge.wip", { autoAlpha: 0, duration: 0.2 }, "<").to(".m-badge.ok", { autoAlpha: 1, duration: 0.3 }, "<").to({}, { duration: 1.8 });

      // 3. Плитки: таймер решения и «без звонков»
      const t = { m: 0 };
      const minEl = document.querySelector<HTMLElement>(".t-min");
      gsap.timeline({ repeat: -1, repeatDelay: 1.5, delay: 1.4 })
        .fromTo(".rt-fg", { strokeDashoffset: 170 }, { strokeDashoffset: 0, duration: 2.4, ease: "power1.inOut" })
        .fromTo(t, { m: 0 }, { m: 5, duration: 2.4, ease: "power1.inOut", onUpdate: () => { if (minEl) minEl.textContent = String(Math.round(t.m)); } }, "<");
      gsap.fromTo(".p-ring", { scale: 1, autoAlpha: 0.5 }, { scale: 1.6, autoAlpha: 0, duration: 2, stagger: 1, repeat: -1, ease: "power1.out" });
      // акцентные линии: период штриха 400 = сдвиг за цикл, поэтому повтор бесшовный (без «телепортации»)
      gsap.set(".grid-svg .accent", { strokeDasharray: "80 320", strokeDashoffset: 0 });
      gsap.to(".grid-svg .accent", { strokeDashoffset: -400, duration: 5, repeat: -1, ease: "none" });
    }, page);
    return () => ctx.revert();
  }, []);

  const closeDemo = () => {
    setDemo(false);
  };

  const doLogin = async (l: string, p: string) => {
    setErr("");
    setBusy(l);
    try {
      const r = await api("/api/auth/login", { body: { login: l, password: p } });
      auth.login(r.token, r.user);
      nav("/");
    } catch (e: any) {
      setErr(e.message);
      setBusy("");
    }
  };

  const Acc = ({ a, bank, i = 0 }: { a: any; bank?: boolean; i?: number }) => {
    const Icon = a.icon;
    return (
      <button className={"choice acc" + (bank ? " bank" : "")} style={{ ["--d" as any]: `${0.1 + i * 0.03}s` }} onClick={() => doLogin(a.login, "demo123")} disabled={!!busy}>
        <div className="avatar">{busy === a.login ? <span className="spin" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Icon />}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{a.who}</div>
          <div className="small muted">{a.hint}</div>
          <div className="small faint" style={{ marginTop: 2 }}>{a.login}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="login" ref={page}>
      <div className="login-hero">
        <svg className="grid-svg" preserveAspectRatio="none" viewBox="0 0 800 900" aria-hidden>
          {[100, 200, 300, 400, 500, 600, 700].map((x) => <line key={"v" + x} x1={x} y1="0" x2={x} y2="900" />)}
          {[150, 300, 450, 600, 750].map((y) => <line key={"h" + y} x1="0" y1={y} x2="800" y2={y} />)}
          <line className="accent" x1="0" y1="450" x2="800" y2="450" />
          <line className="accent" x1="600" y1="0" x2="600" y2="900" />
        </svg>

        <div className="hero-panel" aria-hidden>
        <div className="mock">
          <div className="m-top">
            <span><FileText size={14} /> CR-2610-00042</span>
            <span className="m-badges"><span className="m-badge wip"><Loader size={12} /> В работе</span><span className="m-badge ok"><CircleCheck size={12} /> Одобрено</span></span>
          </div>
          <div className="m-sum">0 ₽</div>
          <div className="m-sub">Экспресс-кредит · 12 месяцев</div>
          <div className="m-bars">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i}><b /></i>)}</div>
          <div className="m-line"><div className="m-step">Этап 1 из 6</div><div className="m-text">Проверяем полноту данных</div></div>
          <div className="m-checks">
            <div><Building2 size={15} /><span>ЕГРЮЛ / ЕГРИП</span><CircleCheck size={16} className="m-check" /></div>
            <div><Landmark size={15} /><span>ФНС «Прозрачный бизнес»</span><CircleCheck size={16} className="m-check" /></div>
            <div><ShieldCheck size={15} /><span>Бюро кредитных историй</span><CircleCheck size={16} className="m-check" /></div>
          </div>
        </div>
        <div className="tiles">
          <div className="tile">
            <div className="t-ico"><svg className="ring-timer" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" className="rt-bg" /><circle cx="32" cy="32" r="27" className="rt-fg" /></svg><Timer size={16} /></div>
            <div><div className="t-big"><span className="t-min">0</span> мин</div><div className="t-sub">до решения</div></div>
          </div>
          <div className="tile">
            <div className="t-ico"><span className="p-ring" /><span className="p-ring" /><PhoneOff size={16} /></div>
            <div><div className="t-big">0 звонков</div><div className="t-sub">всё в кабинете</div></div>
          </div>
        </div>
        </div>

        <div className="logo" style={{ position: "relative", zIndex: 1 }}><span className="logo-mark">А</span><span>Бизнес-кредит<small style={{ color: "rgba(255,255,255,.5)" }}>прототип · Альфа Будущее</small></span></div>
        <h1>
          <span className="mask"><span>Деньги</span> <span>для</span> <span>бизнеса</span></span>
          <span className="mask"><span><em>без очередей</em></span></span>
          <span className="mask"><span>и звонков</span></span>
        </h1>
        <p className="hero-line">От задачи до зачисления в одном кабинете: подбор продукта, заявка за минуты, решение в реальном времени и понятные причины.</p>
        <div className="hero-stats">
          <div><b>5 мин</b><span>автоматическое решение</span></div>
          <div><b>6 этапов</b><span>прозрачный статус</span></div>
          <div><b>0 звонков</b><span>всё внутри продукта</span></div>
        </div>
      </div>

      <div className="login-side v2">
        <div className="login-card">
          <div className="eyebrow">Вход в кабинет</div>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>Добро пожаловать</h1>
          <p className="muted" style={{ marginBottom: 24 }}>Предприниматель или сотрудник банка — один вход для всех ролей.</p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); doLogin(login, password); }}>
            <div className="field-ico"><User size={18} /><input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Логин" autoComplete="username" /></div>
            <div className="field-ico"><Lock size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" autoComplete="current-password" /></div>
            {err && <div className="alert bad">{err}</div>}
            <button className="btn block" style={{ height: 54, fontSize: 16 }} disabled={!login || !password || !!busy}>
              {busy && busy === login ? <span className="spin" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,.4)", borderTopColor: "#fff" }} /> : <KeyRound size={18} />} Войти
            </button>
          </form>
          <div className="or">или</div>
          <button className="demo-btn" onClick={() => setDemo(true)}>
            <span className="ico"><Sparkles size={22} /></span>
            <span style={{ flex: 1 }}><b>Демо-аккаунты</b><span className="small muted" style={{ display: "block" }}>11 готовых сценариев: от автоодобрения до эскалации</span></span>
            <span style={{ fontSize: 20, color: "var(--red)" }}>→</span>
          </button>
          <p className="faint small" style={{ marginTop: 24 }}>Прототип на синтетических данных. Внешние системы смоделированы.</p>
        </div>
      </div>

      {demo && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && closeDemo()}>
          <div className="modal" ref={modal} role="dialog" aria-modal="true">
            <div className="modal-head">
              <div><div className="eyebrow">Демо-доступ · пароль demo123</div><h2 style={{ fontSize: 26, margin: 0 }}>Выберите сценарий</h2><p className="muted small" style={{ marginTop: 6 }}>Нажмите на карточку — вход выполнится автоматически.</p></div>
              <button className="icon-btn" onClick={closeDemo} aria-label="Закрыть"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <h3>Предприниматели</h3>
              <div className="acc-grid">{CLIENTS.map((a, i) => <Acc key={a.login} a={a} i={i} />)}</div>
              <h3 style={{ marginTop: 22 }}>Сотрудники банка</h3>
              <div className="acc-grid">{BANK.map((a, i) => <Acc key={a.login} a={a} bank i={i + 8} />)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
