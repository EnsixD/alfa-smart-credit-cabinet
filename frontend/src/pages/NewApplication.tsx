import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, CircleCheck, Clock, FileCheck2, FileText, Lock, Loader, MessageSquare, PartyPopper, PiggyBank, Rocket, Search, ShieldCheck, ShoppingCart, Sparkles, Truck, UploadCloud, Wallet, BarChart3, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, money, months } from "../api";
import { AnimatedNumber } from "../anim";
import { useAuth } from "../auth";
import { PRODUCT_ICONS } from "./Dashboard";
import BlurText from "../components/reactbits/BlurText";
import ClickSpark from "../components/reactbits/ClickSpark";
import Magnet from "../components/reactbits/Magnet";
import Particles from "../components/reactbits/Particles";
import ShinyText from "../components/reactbits/ShinyText";
import SpotlightCard from "../components/reactbits/SpotlightCard";

const STEPS = [
  { title: "Основные данные", hint: "Компания и цель", icon: Building2 },
  { title: "Финансы", hint: "Показатели и продукт", icon: BarChart3 },
  { title: "Документы", hint: "Файлы и согласия", icon: FileText },
  { title: "Результат", hint: "Отправка", icon: Send },
];
const PURPOSE_ICONS: Record<string, any> = { cash_gap: Clock, working_capital: Wallet, purchase: ShoppingCart, equipment: Truck, real_estate: Building2, development: Rocket };
const EASE = [0.2, 0.8, 0.2, 1] as const;
const stepVariants = {
  enter: (d: number) => ({ opacity: 0, x: d * 48, filter: "blur(6px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: (d: number) => ({ opacity: 0, x: d * -48, filter: "blur(6px)" }),
};
const list = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };
const OKVED_SPHERES: Record<string, string> = { food: "Общепит", trade: "Торговля", manufacturing: "Производство", construction: "Строительство", auto: "Автосервис", it: "IT и разработка", transport: "Перевозки" };

function Money({ label, value, onChange, hint }: { label: string; value: any; onChange: (v: number | null) => void; hint?: string }) {
  return (
    <label className="fld">
      <span>{label}</span>
      <input inputMode="numeric" value={value == null || value === "" ? "" : new Intl.NumberFormat("ru-RU").format(value)}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); onChange(d ? Number(d) : null); }} placeholder="0 ₽" />
      {hint && <small className="fld-hint">{hint}</small>}
    </label>
  );
}

export default function NewApplication() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[] | null>(null);
  const [app, setApp] = useState<any>(null);
  const [company, setCompany] = useState<any>(user?.company || null);
  const [egrul, setEgrul] = useState<any>(null);
  const [form, setForm] = useState<any>({ purpose: new URLSearchParams(window.location.search).get("purpose") || "", amount: 1_000_000, term_months: 12, purpose_text: "", financials: {}, collateral: {}, consents: {}, contact: { name: user?.full_name, position: user?.position } });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<any>(null);
  const timer = useRef<any>();
  const raf = useRef<number>();
  const [dir, setDir] = useState(1);
  const [uploading, setUploading] = useState<string | null>(null);
  const [reached, setReached] = useState(0);
  useEffect(() => setReached((r) => Math.max(r, step)), [step]);
  const prevStep = useRef(step);
  if (prevStep.current !== step) { setDir(step > prevStep.current ? 1 : -1); prevStep.current = step; }

  useEffect(() => {
    api("/api/catalog/purposes").then(setPurposes);
    api("/api/company").then((c) => {
      setCompany(c.company);
      setForm((f: any) => ({ ...f, financials: Object.keys(f.financials).length ? f.financials : { annual_revenue: c.company.annual_revenue, annual_expenses: c.company.annual_expenses, monthly_debt_payments: c.company.monthly_debt_payments } }));
    });
    if (id) {
      api(`/api/applications/${id}`).then((a) => {
        if (a.status.code !== "DRAFT" && a.status.code !== "NEEDS_INFO") return nav(`/cabinet/applications/${a.id}`);
        setApp(a);
        setForm((f: any) => ({ ...f, purpose: a.purpose || "", amount: a.amount || f.amount, term_months: a.term_months || f.term_months, purpose_text: a.purpose_text, financials: a.financials || {}, collateral: a.collateral || {}, consents: a.consents || {}, contact: a.contact || f.contact }));
        setStep(a.product_code ? 2 : 1);
      });
    }
  }, [id]);

  const save = (next: any, a = app) => {
    if (!a) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { purpose, amount, term_months, purpose_text, financials, collateral, consents, contact } = next;
      api(`/api/applications/${a.id}`, { method: "PATCH", body: { purpose: purpose || null, amount, term_months, purpose_text, financials, collateral, consents, contact } }).then(setApp).catch(() => {});
    }, 700);
  };
  const set = (patch: any) => setForm((f: any) => { const next = { ...f, ...patch }; save(next); return next; });
  const setFin = (k: string, v: any) => set({ financials: { ...form.financials, [k]: v } });

  const animateAmount = (to: number) => {
    cancelAnimationFrame(raf.current!);
    const from = Number(form.amount) || 0, start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 500), e = 1 - Math.pow(1 - p, 3);
      if (p < 1) { setForm((f: any) => ({ ...f, amount: Math.round(from + (to - from) * e) })); raf.current = requestAnimationFrame(tick); }
      else set({ amount: to });
    };
    raf.current = requestAnimationFrame(tick);
    // страховка: если вкладка в фоне и кадры не идут, итоговая сумма всё равно применится
    setTimeout(() => { cancelAnimationFrame(raf.current!); setForm((f: any) => (f.amount === to ? f : (save({ ...f, amount: to }), { ...f, amount: to }))); }, 650);
  };

  const checkInn = async () => {
    setEgrul({ loading: true });
    const pause = new Promise((r) => setTimeout(r, 900));
    try { const [res] = await Promise.all([api(`/api/company/lookup/${company.inn}`), pause]); setEgrul(res); }
    catch (e: any) { await pause; setEgrul({ error: e.message }); }
  };

  // шаг 1 → 2: создаём черновик и подбираем продукты
  const toFinance = async () => {
    setErr("");
    if (!form.purpose) return setErr("Выберите цель финансирования");
    if (!form.amount) return setErr("Укажите сумму");
    setBusy(true);
    try {
      const body = { purpose: form.purpose, amount: form.amount, term_months: form.term_months, purpose_text: form.purpose_text, contact: form.contact, financials: form.financials };
      const a = app ? await api(`/api/applications/${app.id}`, { method: "PATCH", body }) : await api("/api/applications", { body });
      setApp(a);
      if (!id) window.history.replaceState(null, "", `/cabinet/new/${a.id}`);
      setRecs(await api("/api/catalog/recommend", { body: { purpose: form.purpose, amount: form.amount, term_months: form.term_months } }));
      setStep(1);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { if (step === 1 && !recs && form.purpose) api("/api/catalog/recommend", { body: { purpose: form.purpose, amount: form.amount, term_months: form.term_months } }).then(setRecs); }, [step]);

  const choose = async (r: any) => {
    const a = await api(`/api/applications/${app.id}`, { method: "PATCH", body: { product_code: r.product.code, amount: r.amount, term_months: r.term_months } });
    setApp(a);
    setForm((f: any) => ({ ...f, amount: r.amount, term_months: r.term_months }));
  };

  const upload = async (docType: string, file: File) => {
    const fd = new FormData(); fd.append("doc_type", docType); fd.append("file", file);
    setUploading(docType);
    try {
      const r = await api(`/api/applications/${app.id}/documents`, { body: fd });
      setApp(await api(`/api/applications/${app.id}`));
      if (Object.keys(r.extracted || {}).length) set({ financials: { ...form.financials, ...r.extracted } });
    } catch (e: any) { setErr(e.message); } finally { setUploading(null); }
  };

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      clearTimeout(timer.current);
      const { purpose, amount, term_months, purpose_text, financials, collateral, consents, contact } = form;
      await api(`/api/applications/${app.id}`, { method: "PATCH", body: { purpose, amount, term_months, purpose_text, financials, collateral, consents, contact } });
      const res = await api(`/api/applications/${app.id}/submit`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID?.() || String(Date.now()) } });
      setSent(res); setStep(3);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const product = app?.product;
  const fin = form.financials || {};
  const net = ((fin.annual_revenue || 0) - (fin.annual_expenses || 0)) / 12;
  const docs = [...(product?.required_docs || []), { type: "OTHER", title: "Дополнительный документ", optional: true }];
  const chosen = (recs || []).find((r) => r.product.code === app?.product_code);
  const purposeTitle = purposes.find((p) => p.code === form.purpose)?.title;
  const view = step === 3 && sent ? 3 : step;
  // перейти можно на любой уже пройденный шаг (кроме результата) — данные сохраняются
  const canGo = (i: number) => view < 3 && i !== view && i < 3 && i <= reached && (i === 0 || !!app);
  const goTo = (i: number) => { if (!canGo(i)) return; setErr(""); if (view === 0) return toFinance(); if (i === 2 && !app?.product_code) return setStep(1); setStep(i); };
  const progress = (view / (STEPS.length - 1)) * 100;
  const termPct = ((form.term_months - 1) / 83) * 100;
  const loadPct = fin.annual_revenue > 0 ? Math.min(100, Math.max(0, ((fin.annual_expenses || 0) / fin.annual_revenue) * 100)) : 0;

  return (
    <div className="page wz2">
      <div className="wz2-glow" aria-hidden="true" />
      {view < 3 && (
        <motion.header className="wz2-head" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <button className="wz2-back" onClick={() => (step > 0 ? setStep(step - 1) : nav("/cabinet"))}><ArrowLeft size={15} /> {step > 0 ? "Назад" : "В кабинет"}</button>
          <div className="wz2-title">
            <span className="wz2-eyebrow"><Sparkles size={13} /> Новая заявка {app?.number ? `· № ${app.number}` : ""}</span>
            <BlurText text="Заявка на кредит" className="wz2-h1" animateBy="words" delay={90} trigger="load" />
            <p>Черновик сохраняется автоматически — можно вернуться в любой момент</p>
          </div>
        </motion.header>
      )}

      {view < 3 && (
        <nav className="wz2-steps" aria-label="Шаги заявки">
          <div className="wz2-track"><motion.i animate={{ width: `${progress}%` }} transition={{ duration: 0.6, ease: EASE }} /></div>
          {STEPS.map((s, i) => {
            const st = i < view ? "done" : i === view ? "on" : "";
            return (
              <button type="button" key={s.title} className={"wz2-step " + st + (canGo(i) ? " go" : "")} aria-current={i === view ? "step" : undefined} disabled={!canGo(i)} onClick={() => goTo(i)} title={canGo(i) ? `Вернуться: ${s.title}` : undefined}>
                <span className="wz2-dot">
                  {i === view && <motion.span layoutId="wz2-halo" className="wz2-halo" transition={{ type: "spring", stiffness: 300, damping: 28 }} />}
                  <AnimatePresence mode="wait" initial={false}>
                    {i < view
                      ? <motion.span key="ok" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Check size={15} strokeWidth={3} /></motion.span>
                      : <motion.span key="ico" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><s.icon size={16} /></motion.span>}
                  </AnimatePresence>
                </span>
                <span className="wz2-step-txt"><b>{s.title}</b><small>{i < view ? "Изменить" : s.hint}</small></span>
              </button>
            );
          })}
        </nav>
      )}

      <div className={"wz2-grid" + (view === 3 ? " full" : "")}>
        <div className="wz2-main">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={view} custom={dir} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.38, ease: EASE }}>
              {view === 0 && (
                <motion.div variants={list} initial="hidden" animate="show" className="wz2-stack">
                  <motion.div variants={item}>
                    <SpotlightCard theme="light" spotlightColor="rgba(239,49,36,0.10)" className="wz2-card wz2-company">
                      <div className="wz2-card-head">
                        <span className="wz2-badge-ico"><Building2 size={18} /></span>
                        <div><h2>Компания</h2><p><Lock size={12} /> Реквизиты из профиля — изменить можно через поддержку</p></div>
                      </div>
                      <div className="wz2-facts">
                        <div className="wide"><span>Юридическое название</span><b>{company?.name || "—"}</b></div>
                        <div><span>ИНН</span><b className="mono">{company?.inn || "—"}</b></div>
                        <div><span>Форма</span><b>{company?.legal_form === "ИП" ? "Индивидуальный предприниматель" : "ООО"}</b></div>
                        <div title={company?.okved_name}><span>Сфера · ОКВЭД</span><b>{OKVED_SPHERES[company?.industry] || "—"} · {company?.okved || ""}</b></div>
                      </div>
                      <div className={"wz2-verify " + (egrul ? (egrul.loading ? "loading" : egrul.error ? "warn" : "ok") : "")}>
                        <span className="v-ico">{egrul?.loading ? <Loader size={16} className="spin-ico" /> : egrul ? (egrul.error ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />) : <Search size={16} />}</span>
                        <div className="v-txt">
                          <b>{egrul?.loading ? "Идёт сверка с ЕГРЮЛ / ЕГРИП…" : egrul ? (egrul.error ? "Реестр недоступен" : `Найдено в реестре · ${egrul.status_text}`) : "Сверка с ЕГРЮЛ / ЕГРИП"}</b>
                          <small>{egrul?.loading ? "Запрашиваем данные о компании" : egrul ? (egrul.error || "Реквизиты совпадают с данными реестра") : "Проверим, что данные совпадают с госреестром"}</small>
                        </div>
                        {(!egrul || egrul.error) && <button className="wz2-ghost-btn" onClick={checkInn}>{egrul?.error ? "Повторить" : "Сверить"}</button>}
                        {egrul?.loading && <motion.i className="v-scan" initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />}
                      </div>
                    </SpotlightCard>
                  </motion.div>

                  <motion.section variants={item} className="wz2-card">
                    <div className="wz2-card-head"><span className="wz2-badge-ico"><Rocket size={18} /></span><div><h2>Цель финансирования</h2><p>От цели зависят подходящие продукты и ставка</p></div></div>
                    <motion.div className="wz2-purposes" variants={list} initial="hidden" animate="show">
                      {purposes.length === 0 && [0, 1, 2, 3, 4, 5].map((k) => <div key={k} className="skeleton" style={{ height: 88, borderRadius: 16 }} />)}
                      {purposes.map((p) => {
                        const Icon = PURPOSE_ICONS[p.code] || Sparkles;
                        const on = form.purpose === p.code;
                        return (
                          <motion.button variants={item} key={p.code} className={"wz2-purpose" + (on ? " on" : "")} onClick={() => set({ purpose: p.code })} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} aria-pressed={on}>
                            {on && <motion.span layoutId="wz2-purpose-bg" className="wz2-purpose-bg" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                            <span className="pi"><Icon size={20} /></span>
                            <span className="pt">{p.title}</span>
                            <span className="pc">{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={12} strokeWidth={3} /></motion.span>}</span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.section>

                  <motion.section variants={item} className="wz2-card">
                    <div className="wz2-card-head"><span className="wz2-badge-ico"><Wallet size={18} /></span><div><h2>Сумма и срок</h2><p>Точные условия покажем на следующем шаге</p></div></div>
                    <div className="wz2-amount">
                      <label className="wz2-amount-field">
                        <span>Сумма кредита</span>
                        <div><input inputMode="numeric" value={form.amount ? new Intl.NumberFormat("ru-RU").format(form.amount) : ""} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); set({ amount: d ? Number(d) : null }); }} placeholder="0" /><em>₽</em></div>
                      </label>
                      <div className="wz2-presets">
                        {[500_000, 1_000_000, 3_000_000, 10_000_000].map((v) => (
                          <motion.button key={v} whileTap={{ scale: 0.94 }} className={form.amount === v ? "on" : ""} onClick={() => animateAmount(v)}>{v >= 1e6 ? `${v / 1e6} млн` : `${v / 1e3} тыс`}</motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="wz2-term">
                      <div className="wz2-term-top"><span>Срок</span><motion.b key={form.term_months} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{months(form.term_months)}</motion.b></div>
                      <input type="range" min={1} max={84} value={form.term_months} style={{ ["--p" as any]: `${termPct}%` }} onChange={(e) => set({ term_months: Number(e.target.value) })} aria-label="Срок кредита" />
                      <div className="wz2-ticks">{[["1 мес", 1], ["1 год", 12], ["3 года", 36], ["5 лет", 60], ["7 лет", 84]].map(([t, m]) => <button key={t} onClick={() => set({ term_months: m })} className={form.term_months === m ? "on" : ""}>{t}</button>)}</div>
                    </div>
                  </motion.section>
                </motion.div>
              )}

              {view === 1 && (
                <motion.div variants={list} initial="hidden" animate="show" className="wz2-stack">
                  <motion.section variants={item} className="wz2-card">
                    <div className="wz2-card-head"><span className="wz2-badge-ico"><BarChart3 size={18} /></span><div><h2>Финансовые показатели</h2><p>Подставили из профиля — оценка без запроса в бюро кредитных историй</p></div></div>
                    <div className="fld-row">
                      <Money label="Выручка за 12 месяцев" value={fin.annual_revenue} onChange={(v) => setFin("annual_revenue", v)} />
                      <Money label="Расходы за 12 месяцев" value={fin.annual_expenses} onChange={(v) => setFin("annual_expenses", v)} />
                    </div>
                    <div className="fld-row">
                      <Money label="Выручка за прошлый год" value={fin.prev_year_revenue} onChange={(v) => setFin("prev_year_revenue", v)} hint="Необязательно — покажет динамику" />
                      <Money label="Платежи по кредитам в месяц" value={fin.monthly_debt_payments} onChange={(v) => setFin("monthly_debt_payments", v)} />
                    </div>
                    <AnimatePresence>
                      {fin.annual_revenue > 0 && (
                        <motion.div className="wz2-flow" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                          <div className="wz2-flow-in">
                            <div><span>Свободный денежный поток</span><b className={net < 0 ? "neg" : ""}><AnimatedNumber value={net} format={(v) => money(v)} /> <small>в месяц</small></b></div>
                            <div className="wz2-bar" title="Доля расходов в выручке"><motion.i animate={{ width: `${loadPct}%` }} transition={{ duration: 0.7, ease: EASE }} /></div>
                            <small className="faint">Расходы — {Math.round(loadPct)}% выручки</small>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>

                  <motion.section variants={item} className="wz2-card">
                    <div className="wz2-card-head"><span className="wz2-badge-ico"><PiggyBank size={18} /></span><div><h2>Подходящие продукты</h2><p>Выберите вариант — платёж пересчитан под вашу сумму и срок</p></div></div>
                    {!recs && <div className="wz2-prods">{[0, 1, 2].map((k) => <div key={k} className="skeleton" style={{ height: 86, borderRadius: 18 }} />)}</div>}
                    <motion.div className="wz2-prods" variants={list} initial="hidden" animate="show">
                      {(recs || []).map((r) => {
                        const Icon = PRODUCT_ICONS[r.product.code] || Wallet;
                        const on = app?.product_code === r.product.code;
                        return (
                          <motion.button variants={item} layout key={r.product.code} className={"wz2-prod" + (on ? " on" : "")} disabled={!r.eligible} onClick={() => choose(r)} whileHover={r.eligible ? { y: -2 } : undefined} whileTap={r.eligible ? { scale: 0.985 } : undefined}>
                            <span className="prod-ico"><Icon size={20} /></span>
                            <span className="prod-main"><b>{r.product.name}{r.recommended && <em><ShinyText text="Рекомендуем" color="#ef3124" shineColor="#ffb3ab" speed={2.5} /></em>}</b><small>{r.eligible ? `${money(r.amount)} на ${months(r.term_months)} · от ${r.rate_from}% · решение ${r.product.decision_time}` : r.notes.join(". ")}</small>
                              {r.eligible && <span className="wz2-chance"><i style={{ width: r.chance === "высокий" ? "90%" : r.chance === "средний" ? "60%" : "30%" }} /> шанс {r.chance}</span>}</span>
                            <span className="prod-pay"><b><AnimatedNumber value={r.monthly_payment} format={(v) => Math.round(v).toLocaleString("ru-RU") + " ₽"} /></b><small>в месяц</small></span>
                            <span className="prod-radio">{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}><Check size={13} strokeWidth={3} /></motion.span>}</span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </motion.section>

                  <AnimatePresence>
                    {product?.collateral_required && (
                      <motion.section className="wz2-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
                        <div className="wz2-card-head"><span className="wz2-badge-ico"><ShieldCheck size={18} /></span><div><h2>Залог</h2><p>Для этого продукта нужно обеспечение</p></div></div>
                        <div className="fld-row">
                          <label className="fld"><span>Тип залога</span><select value={form.collateral.type || ""} onChange={(e) => set({ collateral: { ...form.collateral, type: e.target.value } })}><option value="">Выберите</option><option>Оборудование</option><option>Транспорт</option><option>Недвижимость</option></select></label>
                          <Money label="Оценочная стоимость" value={form.collateral.value} onChange={(v) => set({ collateral: { ...form.collateral, value: v } })} />
                        </div>
                        <label className="fld"><span>Описание залога</span><input value={form.collateral.description || ""} onChange={(e) => set({ collateral: { ...form.collateral, description: e.target.value } })} placeholder="Например: буровая установка 2023 г." /></label>
                      </motion.section>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {view === 2 && app && (
                <motion.div variants={list} initial="hidden" animate="show" className="wz2-stack">
                  <motion.section variants={item} className="wz2-card">
                    <div className="wz2-card-head"><span className="wz2-badge-ico"><UploadCloud size={18} /></span><div><h2>Документы</h2><p>{product?.required_docs.length ? `Для «${product.name}» — можно загрузить и позже. Показатели распознаем автоматически` : "Для этого продукта документы не обязательны"}</p></div></div>
                    <motion.div className="wz2-docs" variants={list} initial="hidden" animate="show">
                      {docs.map((d: any) => {
                        const has = app.documents.filter((x: any) => x.doc_type === d.type);
                        const busyDoc = uploading === d.type;
                        return (
                          <motion.label variants={item} key={d.type} className={"wz2-drop" + (has.length ? " done" : "") + (busyDoc ? " busy" : "")} onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("over"); }} onDragLeave={(e) => e.currentTarget.classList.remove("over")} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("over"); const f = e.dataTransfer.files?.[0]; if (f) upload(d.type, f); }} whileHover={{ y: -2 }}>
                            <input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(d.type, e.target.files[0])} />
                            <span className="d-ico">
                              <AnimatePresence mode="wait" initial={false}>
                                {busyDoc ? <motion.span key="l" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Loader size={18} className="spin-ico" /></motion.span>
                                  : has.length ? <motion.span key="d" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><FileCheck2 size={18} /></motion.span>
                                  : <motion.span key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><UploadCloud size={18} /></motion.span>}
                              </AnimatePresence>
                            </span>
                            <span className="d-txt"><b>{d.title}{d.optional && <small className="faint"> · необязательно</small>}</b>
                              <small>{busyDoc ? "Загружаем и распознаём…" : has.length ? has.map((x: any) => x.filename).join(", ") + (Object.keys(has[0].extracted || {}).length ? " · показатели распознаны" : "") : "Перетащите файл или нажмите, чтобы выбрать"}</small></span>
                            <span className="d-act">{has.length ? "Заменить" : "Выбрать"}</span>
                            {busyDoc && <motion.i className="d-progress" initial={{ width: "0%" }} animate={{ width: "90%" }} transition={{ duration: 2.5, ease: "easeOut" }} />}
                          </motion.label>
                        );
                      })}
                    </motion.div>
                  </motion.section>

                  <motion.section variants={item} className="wz2-card">
                    <div className="wz2-card-head"><span className="wz2-badge-ico"><ShieldCheck size={18} /></span><div><h2>Согласия</h2><p>Нужны, чтобы банк мог принять решение</p></div></div>
                    {[["pd", "Обработка персональных данных", "В соответствии с 152-ФЗ"], ["bki", "Запрос в бюро кредитных историй", "Запрос не ухудшает кредитную историю"]].map(([k, t, h]) => {
                      const on = !!form.consents[k];
                      return (
                        <button key={k} className={"wz2-consent" + (on ? " on" : "")} onClick={() => set({ consents: { ...form.consents, [k]: !on } })} aria-pressed={on}>
                          <span className="sw"><motion.i layout transition={{ type: "spring", stiffness: 600, damping: 32 }} /></span>
                          <span><b>{t}</b><small>{h}</small></span>
                        </button>
                      );
                    })}
                    {!user?.can_sign && <div className="alert warn" style={{ marginTop: 12 }}>У вас нет права подписи: оформите заявку, а договор подпишет руководитель в своём кабинете.</div>}
                  </motion.section>
                </motion.div>
              )}

              {view === 3 && sent && (
                <div className="wz2-sent">
                  <div className="wz2-sent-particles" aria-hidden="true">
                    <Particles particleCount={160} particleSpread={10} speed={0.12} particleColors={["#ef3124", "#ff8a80", "#ffd6d2"]} particleBaseSize={90} alphaParticles moveParticlesOnHover particleHoverFactor={0.6} />
                  </div>
                  <motion.div className="wz2-sent-card" initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                    <div className="wz2-sent-check">
                      <motion.span className="halo" initial={{ scale: 0.4, opacity: 0.8 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.6 }} />
                      <motion.div className="disc" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}>
                        <svg viewBox="0 0 24 24" width="40" height="40"><motion.path d="M5 12.5l4.2 4.2L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }} /></svg>
                      </motion.div>
                    </div>
                    <span className="wz2-eyebrow center"><PartyPopper size={13} /> Шаг 4 из 4 · Результат</span>
                    <BlurText text="Заявка отправлена!" className="wz2-sent-h" animateBy="words" delay={120} trigger="load" />
                    <motion.p className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>Мы уже начали проверку данных. Решение будет известно {sent.product?.decision_time ? `— обычно ${sent.product.decision_time}` : "в течение 1 рабочего дня"}.</motion.p>
                    <motion.div className="wz2-sent-table" variants={list} initial="hidden" animate="show">
                      {[["Номер заявки", `№ ${sent.number}`], ["Продукт", sent.product_name], ["Сумма", money(sent.amount)], ["Рассмотрение", sent.product?.decision_time || "до 1 дня"]].map(([k, v]) => (
                        <motion.div variants={item} key={k}><span>{k}</span><b>{v}</b></motion.div>
                      ))}
                    </motion.div>
                    <motion.ol className="wz2-next" variants={list} initial="hidden" animate="show">
                      {[["Проверка данных", "сейчас", true], ["Скоринг и решение", sent.product?.decision_time || "до 1 дня", false], ["Подписание и выдача", "после одобрения", false]].map(([t, h, on], i) => (
                        <motion.li variants={item} key={String(t)} className={on ? "on" : ""}><span>{on ? <Loader size={13} className="spin-ico" /> : i + 1}</span><b>{t}</b><small>{h}</small></motion.li>
                      ))}
                    </motion.ol>
                    <div className="wz2-sent-actions">
                      <Magnet padding={30} magnetStrength={5}>
                        <ClickSpark sparkColor={["#ef3124", "#ff8a80"]} sparkCount={12}>
                          <Link to={`/cabinet/applications/${sent.id}`} className="wz2-primary">Следить за заявкой <ArrowRight size={17} /></Link>
                        </ClickSpark>
                      </Magnet>
                      <Link to="/cabinet" className="wz2-secondary">На главную</Link>
                    </div>
                    <div className="wz2-note"><MessageSquare size={15} /> Статус обновляется в кабинете в реальном времени</div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {view < 3 && (
            <>
              <AnimatePresence>{err && <motion.div className="alert bad" style={{ marginTop: 16 }} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }}>{err}</motion.div>}</AnimatePresence>
              <div className="wz2-foot">
                <span className="faint wz2-foot-hint">Шаг {view + 1} из 4</span>
                <ClickSpark sparkColor={["#ef3124", "#ff8a80"]} sparkCount={10} sparkRadius={24}>
                  {step === 0 && <button className="wz2-primary" onClick={toFinance} disabled={busy}>{busy ? <><Loader size={16} className="spin-ico" /> Подбираем продукты…</> : <>Далее: финансы <ArrowRight size={17} /></>}</button>}
                  {step === 1 && <button className="wz2-primary" onClick={() => setStep(2)} disabled={!app?.product_code}>{app?.product_code ? <>Далее: документы <ArrowRight size={17} /></> : "Выберите продукт"}</button>}
                  {step === 2 && <button className="wz2-primary" onClick={submit} disabled={busy || !form.consents.pd || !form.consents.bki}>{busy ? <><Loader size={16} className="spin-ico" /> Отправляем…</> : <><Send size={16} /> Отправить заявку</>}</button>}
                </ClickSpark>
              </div>
            </>
          )}
        </div>

        {view < 3 && (
          <motion.aside className="wz2-aside" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.15, ease: EASE }}>
            <div className="wz2-summary">
              <span className="wz2-eyebrow light">Ваша заявка</span>
              <div className="wz2-sum"><AnimatedNumber value={Number(form.amount) || 0} format={(v) => Math.round(v).toLocaleString("ru-RU")} duration={0.5} /><em>₽</em></div>
              <div className="wz2-sum-sub">на {months(form.term_months)}</div>
              <div className="wz2-sum-rows">
                <div><span>Цель</span><b>{purposeTitle || "не выбрана"}</b></div>
                <div><span>Продукт</span><b>{product?.name || "подберём на шаге 2"}</b></div>
                <AnimatePresence>
                  {chosen && (
                    <motion.div className="pay" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <span>Платёж в месяц</span><b><AnimatedNumber value={chosen.monthly_payment} format={(v) => Math.round(v).toLocaleString("ru-RU") + " ₽"} /></b>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <ul className="wz2-check">
                {[["Компания проверена", !!egrul && !egrul.error && !egrul.loading], ["Цель выбрана", !!form.purpose], ["Продукт выбран", !!app?.product_code], ["Согласия даны", !!form.consents.pd && !!form.consents.bki]].map(([t, ok]) => (
                  <li key={String(t)} className={ok ? "ok" : ""}><span>{ok ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={11} strokeWidth={3.5} /></motion.span> : null}</span>{t}</li>
                ))}
              </ul>
            </div>
            <div className="wz2-help"><ShieldCheck size={16} /> Данные защищены. Подбор продукта не влияет на кредитную историю.</div>
          </motion.aside>
        )}
      </div>
    </div>
  );
}
