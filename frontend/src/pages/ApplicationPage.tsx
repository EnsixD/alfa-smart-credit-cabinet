import { ArrowRight, CalendarDays, CircleCheck, Clock, FileText, Loader, MessageSquare, PenLine, Percent, ShieldCheck, Upload, Wallet, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, dt, money, months, statusTone, subscribe } from "../api";
import { AnimatedNumber, celebrate, usePop } from "../anim";
import { CheckRow, Progress, StatusBadge, Timeline } from "../components/Status";
import { DisburseOverlay, DisbursedView } from "../components/Disbursed";
import { useAuth } from "../main";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
const IN_PROGRESS = ["SUBMITTED", "DATA_CHECK", "ENRICHMENT", "SCORING", "DECISION", "DISBURSING"];

/** Экран успеха: рисуется галочка, расходятся кольца, летят конфетти. */
function SuccessHero({ app, title, sub, children }: { app: any; title: string; sub: string; children?: any }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => celebrate(el), 450);
    return () => clearTimeout(t);
  }, [app.status.code]);
  return (
    <div className="success" ref={ref}>
      <div className="sx-badge">
        <span className="sx-ring" /><span className="sx-ring" />
        <div className="sx-circle"><svg viewBox="0 0 24 24" width="40" height="40"><path className="sx-check" d="M5 12.5l4.2 4.2L19 7" /></svg></div>
      </div>
      <div className="sx-item"><div className="eyebrow" style={{ color: "rgba(255,255,255,.7)" }}>Заявка {app.number}</div><h2>{title}</h2><p>{sub}</p></div>
      {children}
    </div>
  );
}

function OfferCard({ app, reload }: { app: any; reload: () => void }) {
  const o = app.offer;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isCounter = app.status.code === "COUNTER_OFFER";
  const act = async (path: string) => {
    setBusy(true); setErr("");
    try { await api(`/api/applications/${app.id}/${path}`, { method: "POST" }); reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const facts = (
    <div className="sx-facts sx-item">
      <div><Wallet size={16} /><span>Платёж</span><b><AnimatedNumber value={o.monthly_payment} format={rub} /></b></div>
      <div><CalendarDays size={16} /><span>Срок</span><b>{months(o.term_months)}</b></div>
      <div><Percent size={16} /><span>Ставка</span><b>{o.rate}%</b></div>
    </div>
  );
  const actions = (
    <div className="sx-actions sx-item">
      <button className="btn sx-primary" disabled={busy} onClick={() => act("accept")}>Принять и подписать <ArrowRight size={16} /></button>
      <button className="btn sx-ghost" disabled={busy} onClick={() => confirm("Отказаться от предложения? Заявка будет закрыта.") && act("cancel")}>Отказаться</button>
    </div>
  );
  if (!isCounter) {
    return (
      <SuccessHero app={app} title={`Одобрено ${money(o.amount)}`} sub={`${o.product_name} · предложение действует до ${new Date(o.valid_until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`}>
        {facts}{err && <div className="alert bad">{err}</div>}{actions}
      </SuccessHero>
    );
  }
  const ch = (a: any, b: any) => (a !== b ? "changed" : "");
  return (
    <div className="card action-card">
      <div className="ac-head"><div className="ac-ico warn"><Percent size={20} /></div><div><h2>Банк предлагает другие условия</h2><p className="muted small">{(app.decision?.reasons || []).join(". ")}</p></div></div>
      <div className="compare">
        <div><span>Вы запросили</span><b>{money(app.amount)}</b><small>{months(app.term_months)} · {app.product_name}</small></div>
        <ArrowRight size={20} className="faint" />
        <div className="new"><span>Предложение</span><b className={ch(o.amount, app.amount)}>{money(o.amount)}</b><small><span className={ch(o.term_months, app.term_months)}>{months(o.term_months)}</span> · <span className={ch(o.product_code, app.product_code)}>{o.product_name}</span></small></div>
      </div>
      <div className="facts-light">
        <div><span>Платёж</span><b>{money(o.monthly_payment)}</b></div>
        <div><span>Ставка</span><b>{o.rate}%</b></div>
        <div><span>Переплата</span><b>{money(o.overpayment)}</b></div>
      </div>
      {err && <div className="alert bad">{err}</div>}
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => act("accept")}>Принять условия <ArrowRight size={16} /></button>
        <button className="btn ghost" disabled={busy} onClick={() => confirm("Отказаться от предложения? Заявка будет закрыта.") && act("cancel")}>Отказаться</button>
      </div>
    </div>
  );
}

function SigningCard({ app, reload }: { app: any; reload: () => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  usePop(ref, "sign");
  const sign = async () => {
    setErr(""); setBusy(true);
    try { await api(`/api/applications/${app.id}/sign`, { body: { code } }); reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card action-card" ref={ref}>
      <div className="ac-head"><div className="ac-ico"><PenLine size={20} /></div><div><h2>Подпишите договор</h2><p className="muted small">{app.signing.contract_number} · последний шаг перед зачислением</p></div></div>
      <details className="doc-preview"><summary><FileText size={16} /> Текст договора</summary><p>{app.signing.document}</p></details>
      {user?.can_sign ? (
        <>
          <div className="code-row">
            <div><div className="faint small">Код подтверждения</div><div className="code-box">{app.signing.code}</div></div>
            <p className="small faint" style={{ maxWidth: 280, margin: 0 }}>Симуляция простой электронной подписи: в реальном продукте код приходит в защищённый канал приложения банка.</p>
          </div>
          <div className="row" style={{ flexWrap: "nowrap", maxWidth: 420 }}>
            <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" maxLength={6} inputMode="numeric" />
            <button className="btn" onClick={sign} disabled={code.length !== 6 || busy}>Подписать</button>
          </div>
        </>
      ) : <div className="alert warn">У вас нет права подписи — договор подпишет руководитель компании в своём кабинете.</div>}
      {err && <div className="alert bad">{err}</div>}
    </div>
  );
}

function Tasks({ app, reload }: { app: any; reload: () => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const open = app.tasks.filter((t: any) => t.status === "OPEN");
  const upload = async (t: any, f: File) => {
    setBusy(String(t.id));
    const fd = new FormData(); fd.append("doc_type", t.doc_type); fd.append("file", f);
    try { await api(`/api/applications/${app.id}/documents`, { body: fd }); await reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  };
  const answer = async (t: any) => {
    try { await api(`/api/applications/${app.id}/tasks/${t.id}/complete`, { body: { answer: answers[t.id] || "" } }); reload(); } catch (e: any) { setErr(e.message); }
  };
  const resubmit = async () => {
    setBusy("submit");
    try { await api(`/api/applications/${app.id}/submit`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID?.() || String(Date.now()) } }); reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(""); }
  };
  return (
    <div className="card action-card">
      <div className="ac-head"><div className="ac-ico warn"><FileText size={20} /></div><div><h2>{open.length ? "Банку нужно ещё немного данных" : "Всё готово"}</h2><p className="muted small">{open.length ? `Осталось: ${open.length}` : "Отправьте заявку на повторную проверку"}</p></div></div>
      {open.map((t: any) => (
        <div key={t.id} className="task">
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{t.title}</b>
            <div className="small faint">{t.description} · запросил: {t.created_by}</div>
            {t.kind === "INFO" && t.created_by !== "Система" && (
              <div className="row" style={{ marginTop: 10, flexWrap: "nowrap" }}>
                <input value={answers[t.id] || ""} onChange={(e) => setAnswers({ ...answers, [t.id]: e.target.value })} placeholder="Ваш ответ" />
                <button className="btn small" onClick={() => answer(t)}>Ответить</button>
              </div>
            )}
          </div>
          {t.kind === "DOCUMENT" && (
            <label className="btn small">{busy === String(t.id) ? <Loader size={14} className="spin-ico" /> : <Upload size={14} />} Загрузить<input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(t, e.target.files[0])} /></label>
          )}
          {t.kind === "INFO" && t.created_by === "Система" && <Link className="btn small secondary" to={`/new/${app.id}`}>Исправить</Link>}
        </div>
      ))}
      {err && <div className="alert bad">{err}</div>}
      <div className="row">
        <button className="btn" onClick={resubmit} disabled={open.some((t: any) => t.kind === "DOCUMENT") || busy === "submit"}>Отправить повторно</button>
        <Link className="btn ghost" to={`/new/${app.id}`}>Изменить анкету</Link>
      </div>
    </div>
  );
}

function Details({ app, reload }: { app: any; reload: () => void }) {
  const [tab, setTab] = useState(app.checks.length ? "checks" : "chat");
  const [text, setText] = useState("");
  const send = async () => { if (!text.trim()) return; await api(`/api/applications/${app.id}/messages`, { body: { text } }); setText(""); reload(); };
  const se = app.score_explained;
  return (
    <div className="card">
      <div className="tabs" style={{ marginBottom: 16 }}>
        <span className={"t " + (tab === "checks" ? "on" : "")} onClick={() => setTab("checks")}><ShieldCheck size={14} style={{ verticalAlign: -2 }} /> Проверки <span className="cnt">{app.checks.length}</span></span>
        {se && <span className={"t " + (tab === "score" ? "on" : "")} onClick={() => setTab("score")}>Оценка</span>}
        <span className={"t " + (tab === "chat" ? "on" : "")} onClick={() => setTab("chat")}><MessageSquare size={14} style={{ verticalAlign: -2 }} /> Чат {app.messages.length > 0 && <span className="cnt">{app.messages.length}</span>}</span>
      </div>
      {tab === "checks" && (app.checks.length ? app.checks.map((c: any, i: number) => <CheckRow key={i} c={c} />) : <div className="faint small">Проверки начнутся сразу после отправки.</div>)}
      {tab === "score" && se && (
        <div className="grid grid-2e">
          <div><h3 className="pos">Помогло</h3>{se.positive.map((x: string) => <div key={x} className="factor"><span>{x}</span><CircleCheck size={16} className="pos" /></div>)}</div>
          <div><h3 className="neg">Снизило оценку</h3>{se.negative.length ? se.negative.map((x: string) => <div key={x} className="factor"><span>{x}</span><X size={16} className="neg" /></div>) : <div className="small faint">Ничего — отличный результат</div>}</div>
        </div>
      )}
      {tab === "chat" && (
        <>
          <div style={{ maxHeight: 280, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {app.messages.length === 0 && <div className="faint small">Задайте вопрос — ответит кредитный специалист.</div>}
            {app.messages.map((m: any) => (
              <div key={m.id} className={"bubble " + (m.author_role === "CLIENT" ? "me" : "bot")}><div className="small" style={{ opacity: .7, marginBottom: 2 }}>{m.author_name} · {dt(m.created_at)}</div>{m.text}</div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: "nowrap" }}>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение банку" />
            <button className="btn dark" onClick={send}>Отправить</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ApplicationPage() {
  const { id } = useParams();
  const [app, setApp] = useState<any>(null);
  const [overlay, setOverlay] = useState(false);
  const [details, setDetails] = useState(false);
  const reload = () => api(`/api/applications/${id}`).then(setApp);
  // полноэкранная анимация зачисления: показываем один раз, когда заявка впервые видна выданной
  useEffect(() => {
    if (app?.status.code !== "DISBURSED") return;
    const key = `payout-seen-${app.id}`;
    let seen = false;
    try { seen = !!localStorage.getItem(key); localStorage.setItem(key, "1"); } catch { /* без хранилища просто покажем */ }
    if (!seen) setOverlay(true);
  }, [app?.status.code, app?.id]);
  useEffect(() => {
    reload();
    // события конвейера приходят по SSE — карточка обновляется без перезагрузки
    return subscribe(Number(id), () => { reload(); });
  }, [id]);
  if (!app) return <div className="grid grid-2"><div className="stack"><div className="skeleton" style={{ height: 180 }} /><div className="skeleton" style={{ height: 260 }} /></div><div className="skeleton" style={{ height: 360 }} /></div>;
  const s = app.status.code;
  const live = IN_PROGRESS.includes(s);
  const tone = statusTone(s);

  if (s === "DISBURSED" && !details) {
    return (
      <>
        <DisbursedView app={app} onReplay={() => setOverlay(true)} onDetails={() => setDetails(true)} />
        {overlay && <DisburseOverlay app={app} onClose={() => setOverlay(false)} />}
      </>
    );
  }

  return (
    <div className="grid grid-2">
      <div className="stack">
        <div className="card status-card">
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div><div className="eyebrow">Заявка {app.number}</div><h1 style={{ margin: 0, fontSize: 28 }}>{app.product_name}</h1>
              <div className="muted" style={{ marginTop: 4 }}>{money(app.amount)} · {months(app.term_months)} · {app.purpose_title}</div></div>
            <StatusBadge status={app.status} />
          </div>
          <Progress status={app.status} />
          <div className={"status-line " + tone}>
            {live ? <span className="spin" style={{ width: 18, height: 18, borderWidth: 2.5 }} /> : <Clock size={18} />}
            <div><b>{app.status.title}</b><span>{app.status.hint}</span></div>
          </div>
        </div>

        {s === "NEEDS_INFO" && <Tasks app={app} reload={reload} />}
        {(s === "APPROVED" || s === "COUNTER_OFFER") && app.offer && <OfferCard app={app} reload={reload} />}
        {s === "SIGNING" && <SigningCard app={app} reload={reload} />}
        {s === "DISBURSED" && <button className="btn secondary" style={{ alignSelf: "flex-start" }} onClick={() => setDetails(false)}>← К итогам выдачи</button>}
        {s === "REJECTED" && app.decision && (
          <div className="card action-card">
            <div className="ac-head"><div className="ac-ico bad"><X size={20} /></div><div><h2>Сейчас не можем выдать кредит</h2><p className="muted small">Это не окончательно — вот что поможет</p></div></div>
            <div className="reasons">{app.decision.reasons.map((r: string) => <div key={r}><X size={15} className="neg" />{r}</div>)}</div>
            {app.decision.recommendations?.length > 0 && <div className="reasons ok">{app.decision.recommendations.map((r: string) => <div key={r}><ArrowRight size={15} className="pos" />{r}</div>)}</div>}
            <div><Link className="btn" to="/new">Подобрать другой вариант</Link></div>
          </div>
        )}
        <Details app={app} reload={reload} />
      </div>
      <div>
        <div className="card" style={{ position: "sticky", top: 86 }}>
          <div className="row between"><h2 style={{ margin: 0 }}>История</h2>{live && <span className="badge ok live">online</span>}</div>
          <div style={{ marginTop: 16, maxHeight: "55vh", overflow: "auto" }}><Timeline items={app.timeline} /></div>
          {!app.status.final && !["DISBURSING", "SIGNING"].includes(s) && (
            <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => confirm("Отменить заявку?") && api(`/api/applications/${app.id}/cancel`, { method: "POST" }).then(reload)}>Отменить заявку</button>
          )}
        </div>
      </div>
    </div>
  );
}
