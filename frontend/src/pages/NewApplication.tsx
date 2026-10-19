import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, DOC_TYPES, money, months } from "../api";
import { useStepTransition } from "../anim";
import { Banknote, Building2, Check, Clock, CreditCard, Factory, FileText, Hourglass, Landmark, Package, Percent, RefreshCw, Rocket, Send, Sparkles, Star, Target, TrendingUp, Wallet, Zap } from "lucide-react";

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
  const [form, setForm] = useState<any>({ purpose: "", amount: 1_000_000, term_months: 12, purpose_text: "", financials: {}, collateral: {}, consents: {}, contact: {} });
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
    try { setEgrul(await api(`/api/company/lookup/${company.inn}`)); } catch (e: any) { setEgrul({ error: e.message }); }
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
              <div className="presets">{[500_000, 1_000_000, 3_000_000, 10_000_000].map((v) => <button key={v} className={form.amount === v ? "on" : ""} onClick={() => set({ amount: v })}>{v >= 1e6 ? `${v / 1e6} млн` : `${v / 1e3} тыс`}</button>)}</div>
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
                  <div><span className="rate">{money(r.monthly_payment)}</span><span className="faint small"> в месяц</span></div>
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

      {step === 2 && company && (
        <div className="card stack">
          <h2>Данные компании</h2>
          <p className="muted small">Мы уже знаем вашу компанию — заполнять реквизиты не нужно. Можно сверить их с госреестром.</p>
          <dl className="kv">
            <dt>Название</dt><dd>{company.name}</dd><dt>ИНН / ОГРН</dt><dd>{company.inn} / {company.ogrn}</dd>
            <dt>ОКВЭД</dt><dd>{company.okved} — {company.okved_name}</dd><dt>Дата регистрации</dt><dd>{company.reg_date}</dd>
            <dt>Адрес</dt><dd>{company.address}</dd><dt>Руководитель</dt><dd>{company.director}</dd>
          </dl>
          <div><button className="btn secondary" onClick={checkInn}>Сверить с ЕГРЮЛ/ЕГРИП</button></div>
          {egrul && (egrul.error ? <div className="alert warn">{egrul.error}</div> :
            <div className="alert ok">Найдено в реестре: {egrul.name}, статус — {egrul.status_text}. Источник: {egrul.source}</div>)}
          <h3>Контактное лицо по заявке</h3>
          <div className="grid grid-3">
            <label className="field"><span>ФИО</span><input value={form.contact.name || ""} onChange={(e) => set({ contact: { ...form.contact, name: e.target.value } })} /></label>
            <label className="field"><span>Должность</span><input value={form.contact.position || ""} onChange={(e) => set({ contact: { ...form.contact, position: e.target.value } })} /></label>
          </div>
          {!user?.can_sign && <div className="alert warn">У вас нет права подписи: вы можете оформить заявку, а договор подпишет руководитель в своём кабинете.</div>}
          <div><button className="btn" onClick={() => setStep(3)}>Далее</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="card stack">
          <h2>Финансовые показатели</h2>
          <p className="muted small">Мы подставили значения из оборотов по вашему счёту. Проверьте и при необходимости поправьте.</p>
          <div className="grid grid-2e">
            <Num label="Выручка за последние 12 месяцев, ₽" value={fin.annual_revenue} onChange={(v) => setFin("annual_revenue", v)} />
            <Num label="Расходы за последние 12 месяцев, ₽" value={fin.annual_expenses} onChange={(v) => setFin("annual_expenses", v)} />
            <Num label="Выручка за предыдущий год, ₽ (необязательно)" value={fin.prev_year_revenue} onChange={(v) => setFin("prev_year_revenue", v)} hint="Помогает показать динамику бизнеса" />
            <Num label="Платежи по текущим кредитам в месяц, ₽" value={fin.monthly_debt_payments} onChange={(v) => setFin("monthly_debt_payments", v)} />
          </div>
          {fin.annual_revenue > 0 && (
            <div className="alert info">Свободный денежный поток ≈ {money(netMonth)} в месяц. Платёж по кредиту ≈ {money(app?.offer?.monthly_payment || null) !== "—" ? money(app.offer.monthly_payment) : "рассчитаем после отправки"}.</div>
          )}
          {product?.collateral_required && (
            <>
              <h3>Залог</h3>
              <div className="grid grid-3">
                <label className="field"><span>Тип имущества</span>
                  <select value={form.collateral.type || ""} onChange={(e) => set({ collateral: { ...form.collateral, type: e.target.value } })}>
                    <option value="">Выберите…</option><option>Оборудование</option><option>Транспорт</option><option>Недвижимость</option>
                  </select></label>
                <label className="field"><span>Описание</span><input value={form.collateral.description || ""} onChange={(e) => set({ collateral: { ...form.collateral, description: e.target.value } })} /></label>
                <Num label="Оценочная стоимость, ₽" value={form.collateral.value} onChange={(v) => set({ collateral: { ...form.collateral, value: v } })} />
              </div>
            </>
          )}
          <div><button className="btn" onClick={() => setStep(4)}>Далее</button></div>
        </div>
      )}

      {step === 4 && app && (
        <div className="card stack">
          <h2>Документы</h2>
          {product?.required_docs.length ? (
            <p className="muted small">Для продукта «{product.name}» нужны документы ниже. Можно загрузить сейчас или позже — банк напомнит в кабинете.</p>
          ) : <div className="alert ok">Для этого продукта документы не нужны — мы используем данные вашего счёта и госреестров.</div>}
          {[...(product?.required_docs || []), { type: "OTHER", title: "Дополнительный документ (необязательно)" }].map((d: any) => {
            const has = app.documents.filter((x: any) => x.doc_type === d.type);
            return (
              <div key={d.type} className="row between news-item">
                <div>
                  <b>{d.title}</b>
                  {has.map((x: any) => <div key={x.id} className="small pos">✓ {x.filename}{Object.keys(x.extracted || {}).length ? " — показатели распознаны" : ""}</div>)}
                </div>
                <label className="btn secondary small">Загрузить<input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(d.type, e.target.files[0])} /></label>
              </div>
            );
          })}
          <p className="small muted">Подсказка: в текстовом файле отчётности строки вида «Выручка: 85 000 000» распознаются автоматически.</p>
          <div><button className="btn" onClick={() => setStep(5)}>Далее</button></div>
        </div>
      )}

      {step === 5 && app && (
        <div className="card stack">
          <h2>Проверьте и отправьте</h2>
          <dl className="kv">
            <dt>Продукт</dt><dd>{product?.name}</dd><dt>Сумма</dt><dd>{money(form.amount)}</dd>
            <dt>Срок</dt><dd>{months(form.term_months)}</dd><dt>Цель</dt><dd>{app.purpose_title}</dd>
            <dt>Выручка / расходы</dt><dd>{money(fin.annual_revenue)} / {money(fin.annual_expenses)}</dd>
            <dt>Документы</dt><dd>{app.documents.length ? app.documents.map((d: any) => DOC_TYPES[d.doc_type]).join(", ") : "нет"}</dd>
          </dl>
          <label className="check"><input type="checkbox" checked={!!form.consents.pd} onChange={(e) => set({ consents: { ...form.consents, pd: e.target.checked } })} />Согласие на обработку персональных данных</label>
          <label className="check"><input type="checkbox" checked={!!form.consents.bki} onChange={(e) => set({ consents: { ...form.consents, bki: e.target.checked } })} />Согласие на запрос в бюро кредитных историй (обязательно)</label>
          <div className="row">
            <button className="btn" disabled={busy || !form.consents.bki || !form.consents.pd} onClick={submit}>Отправить заявку</button>
            <span className="muted small">Статус заявки будет обновляться в кабинете в реальном времени.</span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
