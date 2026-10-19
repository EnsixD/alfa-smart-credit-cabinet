import { AlertTriangle, ArrowLeft, Check, Lock, CircleCheck, Loader, MessageSquare, Search, ShieldCheck, UploadCloud, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, money, months } from "../api";
import { AnimatedNumber, useStepTransition } from "../anim";
import { useAuth } from "../main";
import { PRODUCT_ICONS } from "./Dashboard";

const STEPS = ["Основные данные", "Финансы", "Документы", "Результат"];
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
  const panel = useRef<HTMLDivElement>(null);
  useStepTransition(panel, step);

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
    const r = await api(`/api/applications/${app.id}/documents`, { body: fd });
    setApp(await api(`/api/applications/${app.id}`));
    if (Object.keys(r.extracted || {}).length) set({ financials: { ...form.financials, ...r.extracted } });
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

  if (step === 3 && sent) {
    return (
      <div className="page center-page">
        <div className="sent-card pop-in">
          <div className="sent-check"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M5 12.5l4.2 4.2L19 7" /></svg></div>
          <h1>Заявка отправлена!</h1>
          <p className="muted">Мы уже начали проверку данных. Решение будет известно {sent.product?.decision_time ? `— обычно ${sent.product.decision_time}` : "в течение 1 рабочего дня"}.</p>
          <div className="sent-table">
            <div><span>Номер заявки</span><b>№ {sent.number}</b></div>
            <div><span>Продукт</span><b>{sent.product_name}</b></div>
            <div><span>Сумма</span><b>{money(sent.amount)}</b></div>
            <div><span>Срок рассмотрения</span><b>{sent.product?.decision_time || "до 1 дня"}</b></div>
          </div>
          <div className="sent-actions">
            <Link to={`/cabinet/applications/${sent.id}`} className="btn btn-lg">Перейти в кабинет</Link>
            <Link to="/cabinet" className="btn btn-lg btn-ghost">На главную</Link>
          </div>
          <div className="sent-note"><MessageSquare size={16} /> Мы сообщим вам о решении в личном кабинете — статус обновляется в реальном времени</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page wizard">
      <button className="back-link" onClick={() => (step > 0 ? setStep(step - 1) : nav("/cabinet"))}><ArrowLeft size={15} /> Назад</button>
      <h1>Заявка на кредит</h1>

      <div className="stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={"st " + (i < step ? "done" : i === step ? "on" : "")}>
            <div className="st-line"><span className="st-dot">{i < step ? <Check size={12} strokeWidth={3} /> : i + 1}</span><span className="st-bar"><i /></span></div>
            <div className="st-label">{s}</div>
          </div>
        ))}
      </div>

      <div className="wz-body" ref={panel}>
        {step === 0 && (
          <>
            <h2>Основные данные</h2>
            <p className="sub">Укажите информацию о вашей компании и цели финансирования</p>
            <div className="form">
              <p className="ro-note"><Lock size={13} /> Реквизиты подставлены из профиля компании — изменить их можно через поддержку</p>
              <label className="fld"><span>Юридическое название компании</span><input value={company?.name || ""} readOnly /></label>
              <label className="fld"><span>ИНН</span><input value={company?.inn || ""} readOnly /></label>
              <div className="fld-row">
                <label className="fld"><span>Форма собственности</span><input value={company?.legal_form === "ИП" ? "Индивидуальный предприниматель" : "Общество с ограниченной ответственностью"} readOnly /></label>
                <label className="fld"><span>Сфера деятельности</span><input value={`${OKVED_SPHERES[company?.industry] || ""} · ОКВЭД ${company?.okved || ""}`} readOnly title={company?.okved_name} /></label>
              </div>
              <div className={"verify " + (egrul ? (egrul.loading ? "loading" : egrul.error ? "warn" : "ok") : "")}>
                <span className="v-ico">{egrul?.loading ? <Loader size={16} className="spin-ico" /> : egrul ? (egrul.error ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />) : <Search size={16} />}</span>
                <div style={{ flex: 1 }}><b>{egrul?.loading ? "Идёт сверка с ЕГРЮЛ / ЕГРИП…" : egrul ? (egrul.error ? "Реестр недоступен" : `Найдено в реестре · ${egrul.status_text}`) : "Сверка с ЕГРЮЛ / ЕГРИП"}</b>
                  <small>{egrul?.loading ? "Запрашиваем данные о компании" : egrul ? (egrul.error || "Реквизиты совпадают с данными реестра") : "Реквизиты заполнены из профиля — можно сверить с госреестром"}</small></div>
                {(!egrul || egrul.error) && <button className="btn btn-ghost btn-sm" onClick={checkInn}>{egrul?.error ? "Повторить" : "Сверить"}</button>}
              </div>
              <div className="fld"><span>Цель финансирования</span>
                <div className="chips-select">{purposes.map((p) => <button key={p.code} className={form.purpose === p.code ? "on" : ""} onClick={() => set({ purpose: p.code })}>{p.title}</button>)}</div>
              </div>
              <div className="fld-row">
                <label className="fld"><span>Сумма, ₽</span>
                  <input inputMode="numeric" value={form.amount ? new Intl.NumberFormat("ru-RU").format(form.amount) : ""} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); set({ amount: d ? Number(d) : null }); }} />
                  <div className="presets">{[500_000, 1_000_000, 3_000_000, 10_000_000].map((v) => <button key={v} className={form.amount === v ? "on" : ""} onClick={() => animateAmount(v)}>{v >= 1e6 ? `${v / 1e6} млн` : `${v / 1e3} тыс`}</button>)}</div>
                </label>
                <label className="fld"><span>Срок: {months(form.term_months)}</span>
                  <input type="range" min={1} max={84} value={form.term_months} onChange={(e) => set({ term_months: Number(e.target.value) })} />
                  <small className="fld-hint">от 1 месяца до 7 лет</small>
                </label>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Финансы</h2>
            <p className="sub">Проверьте показатели и выберите продукт — оценка без запроса в бюро кредитных историй</p>
            <div className="form">
              <div className="fld-row">
                <Money label="Выручка за 12 месяцев" value={fin.annual_revenue} onChange={(v) => setFin("annual_revenue", v)} />
                <Money label="Расходы за 12 месяцев" value={fin.annual_expenses} onChange={(v) => setFin("annual_expenses", v)} />
              </div>
              <div className="fld-row">
                <Money label="Выручка за прошлый год" value={fin.prev_year_revenue} onChange={(v) => setFin("prev_year_revenue", v)} hint="Необязательно — покажет динамику" />
                <Money label="Платежи по кредитам в месяц" value={fin.monthly_debt_payments} onChange={(v) => setFin("monthly_debt_payments", v)} />
              </div>
              {fin.annual_revenue > 0 && <div className="hint-box">Свободный денежный поток ≈ <b>{money(net)}</b> в месяц</div>}
            </div>
            <div className="fld" style={{ marginTop: 20 }}><span>Подходящие продукты</span></div>
            {!recs && <div className="skeleton" style={{ height: 140 }} />}
            <div className="prod-list">
              {(recs || []).map((r) => {
                const Icon = PRODUCT_ICONS[r.product.code] || Wallet;
                const on = app?.product_code === r.product.code;
                return (
                  <button key={r.product.code} className={"prod" + (on ? " on" : "")} disabled={!r.eligible} onClick={() => choose(r)}>
                    <span className="prod-ico"><Icon size={18} /></span>
                    <span className="prod-main"><b>{r.product.name}{r.recommended && <em>Рекомендуем</em>}</b><small>{r.eligible ? `${money(r.amount)} на ${months(r.term_months)} · от ${r.rate_from}% · решение ${r.product.decision_time}` : r.notes.join(". ")}</small></span>
                    <span className="prod-pay"><b><AnimatedNumber value={r.monthly_payment} format={(v) => Math.round(v).toLocaleString("ru-RU") + " ₽"} /></b><small>в месяц · шанс {r.chance}</small></span>
                    <span className="prod-radio">{on && <Check size={13} strokeWidth={3} />}</span>
                  </button>
                );
              })}
            </div>
            {product?.collateral_required && (
              <div className="form" style={{ marginTop: 20 }}>
                <div className="fld-row">
                  <label className="fld"><span>Залог</span><select value={form.collateral.type || ""} onChange={(e) => set({ collateral: { ...form.collateral, type: e.target.value } })}><option value="">Выберите</option><option>Оборудование</option><option>Транспорт</option><option>Недвижимость</option></select></label>
                  <Money label="Оценочная стоимость" value={form.collateral.value} onChange={(v) => set({ collateral: { ...form.collateral, value: v } })} />
                </div>
                <label className="fld"><span>Описание залога</span><input value={form.collateral.description || ""} onChange={(e) => set({ collateral: { ...form.collateral, description: e.target.value } })} placeholder="Например: буровая установка 2023 г." /></label>
              </div>
            )}
          </>
        )}

        {step === 2 && app && (
          <>
            <h2>Документы</h2>
            <p className="sub">{product?.required_docs.length ? `Для продукта «${product.name}» нужны документы ниже — можно загрузить и позже` : "Для этого продукта документы не обязательны"}</p>
            <div className="form">
              {docs.map((d: any) => {
                const has = app.documents.filter((x: any) => x.doc_type === d.type);
                return (
                  <label key={d.type} className={"drop" + (has.length ? " done" : "")} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(d.type, f); }}>
                    <input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(d.type, e.target.files[0])} />
                    <span className="d-ico">{has.length ? <CircleCheck size={18} /> : <UploadCloud size={18} />}</span>
                    <span style={{ flex: 1 }}><b>{d.title}{d.optional && <small className="faint"> · необязательно</small>}</b>
                      <small>{has.length ? has.map((x: any) => x.filename).join(", ") + (Object.keys(has[0].extracted || {}).length ? " · показатели распознаны" : "") : "Перетащите файл или нажмите, чтобы выбрать"}</small></span>
                  </label>
                );
              })}
              <div className="summary-box">
                <div><span>Продукт</span><b>{product?.name}</b></div>
                <div><span>Сумма</span><b>{money(form.amount)}</b></div>
                <div><span>Срок</span><b>{months(form.term_months)}</b></div>
              </div>
              <label className="check"><input type="checkbox" checked={!!form.consents.pd} onChange={(e) => set({ consents: { ...form.consents, pd: e.target.checked } })} />Согласие на обработку персональных данных</label>
              <label className="check"><input type="checkbox" checked={!!form.consents.bki} onChange={(e) => set({ consents: { ...form.consents, bki: e.target.checked } })} />Согласие на запрос в бюро кредитных историй — запрос не ухудшает историю</label>
              {!user?.can_sign && <div className="alert warn">У вас нет права подписи: оформите заявку, а договор подпишет руководитель в своём кабинете.</div>}
            </div>
          </>
        )}

        {err && <div className="alert bad" style={{ marginTop: 16 }}>{err}</div>}
        <div className="wz-foot">
          {step === 0 && <button className="btn btn-lg" onClick={toFinance} disabled={busy}>{busy ? "Подбираем…" : "Далее"}</button>}
          {step === 1 && <button className="btn btn-lg" onClick={() => setStep(2)} disabled={!app?.product_code}>Далее</button>}
          {step === 2 && <button className="btn btn-lg" onClick={submit} disabled={busy || !form.consents.pd || !form.consents.bki}>{busy ? "Отправляем…" : "Отправить заявку"}</button>}
        </div>
      </div>
    </div>
  );
}
