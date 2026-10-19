import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, DOC_TYPES, money, months } from "../api";
import { AnimatedNumber, useStepTransition } from "../anim";
import { AlertTriangle, ArrowLeft, Loader, ArrowRight, Search, Truck, UploadCloud, CircleCheck, ShieldCheck, Banknote, Building2, Check, Clock, CreditCard, Factory, FileText, Hourglass, Landmark, Package, Percent, RefreshCw, Rocket, Send, Sparkles, Star, Target, TrendingUp, Wallet, Zap } from "lucide-react";

const PURPOSES: Record<string, { icon: any; hint: string }> = {
  cash_gap: { icon: Hourglass, hint: "Покупатель платит позже, а платить нужно сейчас" },
  working_capital: { icon: RefreshCw, hint: "Деньги на текущую работу бизнеса" },
  purchase: { icon: Package, hint: "Партия товара, сырьё, сезонный запас" },
  equipment: { icon: Factory, hint: "Станки, техника, автомобили" },
  real_estate: { icon: Landmark, hint: "Офис, склад, производство" },
  development: { icon: Rocket, hint: "Новая точка, продукт или рынок" },
};
const PRODUCT_ICONS: Record<string, any> = { EXPRESS: Zap, OVERDRAFT: Wallet, GROWTH: TrendingUp, INVEST: Factory, CARD: CreditCard };
import { useAuth } from "../main";

const STEPS = ["Задача", "Продукт", "Компания", "Финансы", "Документы", "Отправка"];

function Num({ label, value, onChange, hint }: { label: string; value: any; onChange: (v: number | null) => void; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input inputMode="numeric" value={value == null || value === "" ? "" : new Intl.NumberFormat("ru-RU").format(value)}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); onChange(d ? Number(d) : null); }} />
      {hint && <span className="small faint" style={{ marginTop: 6 }}>{hint}</span>}
    </label>
  );
}

export default function NewApplication() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [app, setApp] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [egrul, setEgrul] = useState<any>(null);
  const [form, setForm] = useState<any>({ purpose: new URLSearchParams(window.location.search).get("purpose") || "", amount: 1_000_000, term_months: 12, purpose_text: "", financials: {}, collateral: {}, consents: {}, contact: {} });
  const [saved, setSaved] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<any>();
  const panel = useRef<HTMLDivElement>(null);
  useStepTransition(panel, step);

  useEffect(() => {
    api("/api/catalog/purposes").then(setPurposes);
    api("/api/company").then((c) => setCompany(c.company));
    if (id) {
      api(`/api/applications/${id}`).then((a) => {
        if (a.status.code !== "DRAFT" && a.status.code !== "NEEDS_INFO") return nav(`/applications/${a.id}`);
        setApp(a);
        setForm({ purpose: a.purpose || "", amount: a.amount, term_months: a.term_months, purpose_text: a.purpose_text, financials: a.financials || {}, collateral: a.collateral || {}, consents: a.consents || {}, contact: a.contact || {} });
        setStep(a.product_code ? 2 : 1);
      });
    }
  }, [id]);

  // автосохранение черновика через 800 мс после последнего изменения
  const set = (patch: any) => {
    setForm((f: any) => {
      const next = { ...f, ...patch };
      if (app) {
        clearTimeout(timer.current);
        setSaved("Сохраняем…");
        timer.current = setTimeout(() => {
          const { purpose, amount, term_months, purpose_text, financials, collateral, consents, contact } = next;
          api(`/api/applications/${app.id}`, { method: "PATCH", body: { purpose: purpose || null, amount, term_months, purpose_text, financials, collateral, consents, contact } })
            .then((a) => { setApp(a); setSaved("Черновик сохранён"); })
            .catch((e) => setSaved("Не сохранено: " + e.message));
        }, 800);
      }
      return next;
    });
  };
  // плавный «перерасчёт» суммы при выборе пресета
  const raf = useRef<number>();
  const animateAmount = (to: number) => {
    cancelAnimationFrame(raf.current!);
    const from = Number(form.amount) || 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 550);
      const e = 1 - Math.pow(1 - p, 3);
      if (p < 1) { setForm((f: any) => ({ ...f, amount: Math.round(from + (to - from) * e) })); raf.current = requestAnimationFrame(tick); }
      else set({ amount: to });
    };
    raf.current = requestAnimationFrame(tick);
  };
  const setFin = (k: string, v: any) => set({ financials: { ...form.financials, [k]: v } });

  const findProducts = async () => {
    setErr("");
    if (!form.purpose) return setErr("Выберите, на что нужны деньги");
    setBusy(true);
    try {
      setRecs(await api("/api/catalog/recommend", { body: { purpose: form.purpose, amount: form.amount, term_months: form.term_months } }));
      setStep(1);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const chooseProduct = async (r: any) => {
    const body = { product_code: r.product.code, amount: r.amount, term_months: r.term_months, purpose: form.purpose, purpose_text: form.purpose_text };
    const a = app ? await api(`/api/applications/${app.id}`, { method: "PATCH", body }) : await api("/api/applications", { body });
    setApp(a);
    setForm((f: any) => ({ ...f, amount: r.amount, term_months: r.term_months, financials: a.financials, contact: a.contact }));
    if (!id) window.history.replaceState(null, "", `/new/${a.id}`);
    setStep(2);
  };

  const checkInn = async () => {
    setEgrul({ loading: true });
    const pause = new Promise((r) => setTimeout(r, 900)); // даём увидеть, что идёт сверка
    try { const [res] = await Promise.all([api(`/api/company/lookup/${company.inn}`), pause]); setEgrul(res); }
    catch (e: any) { await pause; setEgrul({ error: e.message }); }
  };

  const upload = async (docType: string, file: File) => {
    const fd = new FormData();
    fd.append("doc_type", docType);
    fd.append("file", file);
    const r = await api(`/api/applications/${app.id}/documents`, { body: fd });
    const a = await api(`/api/applications/${app.id}`);
    setApp(a);
    const ex = r.extracted || {};
    if (Object.keys(ex).length) {
      set({ financials: { ...form.financials, ...ex } });
      setSaved("Показатели распознаны из документа и подставлены в анкету");
    }
  };

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      clearTimeout(timer.current);
      const { purpose, amount, term_months, purpose_text, financials, collateral, consents, contact } = form;
      await api(`/api/applications/${app.id}`, { method: "PATCH", body: { purpose, amount, term_months, purpose_text, financials, collateral, consents, contact } });
      await api(`/api/applications/${app.id}/submit`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID?.() || String(Date.now()) } });
      nav(`/applications/${app.id}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const product = app?.product;
  const fin = form.financials || {};
  const netMonth = ((fin.annual_revenue || 0) - (fin.annual_expenses || 0)) / 12;

  const STEP_ICONS = [Target, Sparkles, Building2, TrendingUp, FileText, Send];
  const StepIcon = STEP_ICONS[step];
  return (
    <div>
      <div className="banner">
        <span className="shape s1" /><span className="shape s2" /><span className="shape s3" />
        <div className="glyph"><StepIcon size={40} /></div>
        {saved && <span className="badge saved">{saved}</span>}
        <div className="eyebrow">{app ? `Заявка ${app.number}` : "Новая заявка на финансирование"}</div>
        <h1>{["На что нужны деньги?", "Подходящие варианты", "Ваша компания", "Финансы бизнеса", "Документы", "Проверка и отправка"][step]}</h1>
        <p>{["Выберите задачу — подберём продукт и покажем платёж ещё до подачи заявки.", "Предварительная оценка по данным вашего счёта. Запрос в бюро кредитных историй не делается.", "Реквизиты уже заполнены — заново вводить ничего не нужно.", "Мы подставили показатели из оборотов по вашему счёту — проверьте их.", "Загрузите документы сейчас или позже — банк напомнит в кабинете.", "Проверьте данные и дайте согласия — решение придёт в кабинет в реальном времени."][step]}</p>
        <div className="steps">
          {STEPS.map((s, i) => (
            <span key={s} className={"s " + (i === step ? "on" : i < step ? "done" : "")} style={{ cursor: i < step || (app && i > 1) ? "pointer" : "default" }}
              onClick={() => (i < step || (app && i > 1)) && setStep(i)}><span className="n">{i < step ? <Check size={12} /> : i + 1}</span>{s}</span>
          ))}
        </div>
      </div>
      {err && <div className="alert bad" style={{ marginBottom: 12 }}>{err}</div>}
      <div ref={panel}>

      {step === 0 && (
        <div className="stack">
          <div className="grid grid-3">
            {purposes.map((p) => {
              const P = PURPOSES[p.code] || PURPOSES.cash_gap;
              const Icon = P.icon;
              return (
                <button key={p.code} className={"choice purpose " + (form.purpose === p.code ? "on" : "")} onClick={() => set({ purpose: p.code })}>
                  <div className="ico"><Icon size={24} /></div>
                  <div><b>{p.title}</b><small>{P.hint}</small></div>
                  <span className="tick"><Check size={13} /></span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-3">
            <div className="amount-box">
              <div className="lbl">Сколько нужно</div>
              <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
                <input inputMode="numeric" value={form.amount ? new Intl.NumberFormat("ru-RU").format(form.amount) : ""} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); set({ amount: d ? Number(d) : null }); }} />
                <span style={{ fontSize: 28, fontWeight: 800 }}>₽</span>
              </div>
              <div className="presets">{[500_000, 1_000_000, 3_000_000, 10_000_000].map((v) => <button key={v} className={form.amount === v ? "on" : ""} onClick={() => animateAmount(v)}>{v >= 1e6 ? `${v / 1e6} млн` : `${v / 1e3} тыс`}</button>)}</div>
            </div>
            <div className="card flat">
              <div className="faint small">На какой срок</div>
              <div className="term-val">{months(form.term_months)}</div>
              <input type="range" min={1} max={84} value={form.term_months} onChange={(e) => set({ term_months: Number(e.target.value) })} />
              <div className="row between faint small"><span>1 мес</span><span>7 лет</span></div>
            </div>
            <div className="card flat">
              <label className="field"><span>Коротко о задаче (необязательно)</span><textarea value={form.purpose_text} onChange={(e) => set({ purpose_text: e.target.value })} placeholder="Например: закупка кофе к сезону" style={{ minHeight: 86 }} /></label>
            </div>
          </div>
          <div><button className="btn" style={{ height: 54, padding: "0 28px", fontSize: 16 }} onClick={findProducts} disabled={busy}>{busy ? <span className="spin" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,.4)", borderTopColor: "#fff" }} /> : <Sparkles size={18} />} Подобрать варианты</button></div>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <div className="grid grid-3">
            {recs.map((r) => {
              const Icon = PRODUCT_ICONS[r.product.code] || Wallet;
              const ch = ({ высокий: "h", средний: "m" } as Record<string, string>)[r.chance] || "l";
              return (
                <div key={r.product.code} className={"card product hover" + (r.recommended ? " best" : "")} style={{ opacity: r.eligible ? 1 : 0.55 }}>
                  <div className="row between">
                    <div className="p-ico"><Icon size={24} /></div>
                    {r.recommended && <span className="badge red plain"><Star size={12} /> Лучший выбор</span>}
                  </div>
                  <div><h3 style={{ margin: 0, fontSize: 18 }}>{r.product.name}</h3><div className="small muted" style={{ marginTop: 4 }}>{r.product.short}</div></div>
                  <div><span className="rate"><AnimatedNumber value={r.monthly_payment} format={(v) => Math.round(v).toLocaleString("ru-RU") + " ₽"} /></span><span className="faint small"> в месяц</span></div>
                  <div className="feat"><Banknote size={16} />{money(r.amount)} на {months(r.term_months)}</div>
                  <div className="feat"><Percent size={16} />ставка от {r.rate_from}% годовых</div>
                  <div className="feat"><Clock size={16} />решение {r.product.decision_time}</div>
                  {r.product.required_docs.length > 0 && <div className="feat"><FileText size={16} />{r.product.required_docs.map((d: any) => d.title).join(", ")}</div>}
                  <div className="row between"><span className="small muted">Шанс одобрения: <b style={{ color: "var(--text)" }}>{r.chance}</b></span><span className={"chance " + ch}><i /><i /><i /></span></div>
                  {r.notes.map((n: string) => <div key={n} className="small faint">• {n}</div>)}
                  <div className="spacer" />
                  <button className={"btn block" + (r.recommended ? "" : " secondary")} disabled={!r.eligible} onClick={() => chooseProduct(r)}>{r.eligible ? "Выбрать" : "Пока недоступен"}</button>
                </div>
              );
            })}
          </div>
          <button className="btn secondary" onClick={() => setStep(0)}>← Изменить параметры</button>
        </div>
      )}

      {step >= 2 && (
        <div className="wz">
          <div className="wz-main">
            {step === 2 && (
              <div className="card wz-card">
                {!company ? <div className="skeleton" style={{ height: 220 }} /> : (
                  <>
                    <div className="wz-head"><div className="wz-ico"><Building2 size={20} /></div><div><h2>Реквизиты компании</h2><p className="muted small">Заполнены из профиля — вводить заново не нужно</p></div></div>
                    <div className="info-grid">
                      <div className="info wide"><span>Компания</span><b>{company.name}</b></div>
                      <div className="info"><span>ИНН</span><b>{company.inn}</b></div>
                      <div className="info"><span>ОГРН</span><b>{company.ogrn}</b></div>
                      <div className="info wide"><span>Вид деятельности</span><b>{company.okved} · {company.okved_name}</b></div>
                      <div className="info"><span>Дата регистрации</span><b>{new Date(company.reg_date).toLocaleDateString("ru-RU")}</b></div>
                      <div className="info"><span>Руководитель</span><b>{company.director}</b></div>
                    </div>
                    <div className={"verify " + (egrul ? (egrul.loading ? "loading" : egrul.error ? "warn" : "ok") : "")}>
                      <div className="v-ico">{egrul?.loading ? <Loader size={18} className="spin-ico" /> : egrul ? (egrul.error ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />) : <Search size={18} />}</div>
                      <div style={{ flex: 1 }}>
                        <b>{egrul?.loading ? "Идёт сверка с ЕГРЮЛ / ЕГРИП…" : egrul ? (egrul.error ? "Реестр недоступен" : `Найдено в реестре · ${egrul.status_text}`) : "Сверка с ЕГРЮЛ / ЕГРИП"}</b>
                        <div className="small muted">{egrul?.loading ? "Запрашиваем данные о компании в госреестре" : egrul ? (egrul.error || "Реквизиты совпадают с данными реестра") : "Проверим, что данные совпадают с госреестром"}</div>
                      </div>
                      {(!egrul || egrul.error) && <button className="btn secondary small" onClick={checkInn}>{egrul?.error ? "Повторить" : "Сверить"}</button>}
                    </div>
                    <h3 style={{ marginTop: 8 }}>Контактное лицо</h3>
                    <div className="grid grid-2e" style={{ gap: 12 }}>
                      <label className="field"><span>ФИО</span><input value={form.contact.name || ""} onChange={(e) => set({ contact: { ...form.contact, name: e.target.value } })} /></label>
                      <label className="field"><span>Должность</span><input value={form.contact.position || ""} onChange={(e) => set({ contact: { ...form.contact, position: e.target.value } })} /></label>
                    </div>
                    {!user?.can_sign && <div className="alert warn">У вас нет права подписи: оформите заявку, а договор подпишет руководитель в своём кабинете.</div>}
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="card wz-card">
                <div className="wz-head"><div className="wz-ico"><TrendingUp size={20} /></div><div><h2>Финансы бизнеса</h2><p className="muted small">Подставили из оборотов по счёту — проверьте значения</p></div></div>
                <div className="grid grid-2e" style={{ gap: 12 }}>
                  <Num label="Выручка за 12 месяцев, ₽" value={fin.annual_revenue} onChange={(v) => setFin("annual_revenue", v)} />
                  <Num label="Расходы за 12 месяцев, ₽" value={fin.annual_expenses} onChange={(v) => setFin("annual_expenses", v)} />
                  <Num label="Выручка за прошлый год, ₽" value={fin.prev_year_revenue} onChange={(v) => setFin("prev_year_revenue", v)} hint="Необязательно — покажет динамику" />
                  <Num label="Платежи по кредитам в месяц, ₽" value={fin.monthly_debt_payments} onChange={(v) => setFin("monthly_debt_payments", v)} />
                </div>
                {fin.annual_revenue > 0 && (
                  <div className="metrics">
                    <div><span>Свободный поток</span><b className={netMonth > 0 ? "pos" : "neg"}>{money(netMonth)}<small>/мес</small></b></div>
                    <div><span>Рентабельность</span><b>{Math.round(((fin.annual_revenue - (fin.annual_expenses || 0)) / fin.annual_revenue) * 100)}%</b></div>
                    <div><span>Долговая нагрузка</span><b>{netMonth > 0 ? Math.round(((fin.monthly_debt_payments || 0) / netMonth) * 100) : 0}%</b></div>
                  </div>
                )}
                {product?.collateral_required && (
                  <>
                    <h3 style={{ marginTop: 8 }}>Залог</h3>
                    <div className="seg-choice">
                      {[["Оборудование", Factory], ["Транспорт", Truck], ["Недвижимость", Landmark]].map(([t, I]: any) => (
                        <button key={t} className={form.collateral.type === t ? "on" : ""} onClick={() => set({ collateral: { ...form.collateral, type: t } })}><I size={18} />{t}</button>
                      ))}
                    </div>
                    <div className="grid grid-2e" style={{ gap: 12 }}>
                      <label className="field"><span>Описание</span><input value={form.collateral.description || ""} onChange={(e) => set({ collateral: { ...form.collateral, description: e.target.value } })} placeholder="Например: буровая установка 2023 г." /></label>
                      <Num label="Оценочная стоимость, ₽" value={form.collateral.value} onChange={(v) => set({ collateral: { ...form.collateral, value: v } })} />
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 4 && app && (
              <div className="card wz-card">
                <div className="wz-head"><div className="wz-ico"><FileText size={20} /></div><div><h2>Документы</h2><p className="muted small">{product?.required_docs.length ? "Можно загрузить сейчас или позже — банк напомнит в кабинете" : "Для этого продукта документы не нужны"}</p></div></div>
                {[...(product?.required_docs || []), { type: "OTHER", title: "Дополнительный документ", optional: true }].map((d: any) => {
                  const has = app.documents.filter((x: any) => x.doc_type === d.type);
                  return (
                    <label key={d.type} className={"drop " + (has.length ? "done" : "")}
                      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(d.type, f); }}>
                      <input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(d.type, e.target.files[0])} />
                      <div className="d-ico">{has.length ? <CircleCheck size={22} /> : <UploadCloud size={22} />}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{d.title}</b>{d.optional && <span className="faint small"> · необязательно</span>}
                        {has.length ? has.map((x: any) => <div key={x.id} className="small pos">{x.filename}{Object.keys(x.extracted || {}).length ? " · показатели распознаны" : ""}</div>)
                          : <div className="small muted">Перетащите файл сюда или нажмите, чтобы выбрать</div>}
                      </div>
                    </label>
                  );
                })}
                <p className="small faint">Строки вида «Выручка: 85 000 000» в отчётности распознаются автоматически и попадают в анкету.</p>
              </div>
            )}

            {step === 5 && app && (
              <div className="card wz-card">
                <div className="wz-head"><div className="wz-ico"><Send size={20} /></div><div><h2>Всё готово к отправке</h2><p className="muted small">Решение придёт в кабинет — статус будет обновляться в реальном времени</p></div></div>
                <div className="review">
                  {[
                    [Target, "Цель", app.purpose_title, 0], [Building2, "Компания", company?.name, 2],
                    [TrendingUp, "Выручка / расходы", `${money(fin.annual_revenue)} / ${money(fin.annual_expenses)}`, 3],
                    [FileText, "Документы", app.documents.length ? app.documents.map((d: any) => DOC_TYPES[d.doc_type]).join(", ") : "не загружены", 4],
                  ].map(([I, k, v, s]: any) => (
                    <div key={k} className="review-row"><I size={18} /><span>{k}</span><b>{v}</b><button className="link small" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => setStep(s)}>Изменить</button></div>
                  ))}
                </div>
                <label className="switch"><input type="checkbox" checked={!!form.consents.pd} onChange={(e) => set({ consents: { ...form.consents, pd: e.target.checked } })} /><i /><span>Согласие на обработку персональных данных</span></label>
                <label className="switch"><input type="checkbox" checked={!!form.consents.bki} onChange={(e) => set({ consents: { ...form.consents, bki: e.target.checked } })} /><i /><span>Согласие на запрос в бюро кредитных историй — запрос не ухудшает историю</span></label>
              </div>
            )}

            <div className="wz-nav">
              <button className="btn ghost" onClick={() => setStep(step - 1 === 1 && !recs.length ? 0 : step - 1)}><ArrowLeft size={16} /> Назад</button>
              {step < 5
                ? <button className="btn" onClick={() => setStep(step + 1)}>Далее <ArrowRight size={16} /></button>
                : <button className="btn" style={{ minWidth: 220 }} disabled={busy || !form.consents.bki || !form.consents.pd} onClick={submit}>{busy ? <span className="spin" style={{ width: 18, height: 18, borderColor: "rgba(255,255,255,.4)", borderTopColor: "#fff" }} /> : <Send size={16} />} Отправить заявку</button>}
            </div>
          </div>

          <aside className="wz-aside">
            <div className="summary">
              <div className="small" style={{ opacity: .6 }}>Ваша заявка</div>
              <div className="s-prod">{product ? (() => { const I = PRODUCT_ICONS[product.code] || Wallet; return <><span className="s-ico"><I size={18} /></span>{product.name}</>; })() : "—"}</div>
              <div className="s-sum">{money(form.amount)}</div>
              <div className="s-row"><span>Срок</span><b>{months(form.term_months || 0)}</b></div>
              <div className="s-row"><span>Ставка</span><b>от {product?.base_rate}%</b></div>
              <div className="s-row"><span>Решение</span><b>{product?.decision_time}</b></div>
              <div className="s-steps">{STEPS.map((s, i) => <div key={s} className={i < step ? "done" : i === step ? "on" : ""}><span>{i < step ? <Check size={11} /> : i + 1}</span>{s}</div>)}</div>
            </div>
          </aside>
        </div>
      )}
      </div>
    </div>
  );
}
