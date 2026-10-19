import { FileText, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, dt, money, months, statusTone, subscribe } from "../api";
import { AnimatedNumber, usePop, useReveal } from "../anim";
import { CheckRow, Progress, StatusBadge, Timeline } from "../components/Status";
import { useAuth } from "../main";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
const ICONS: Record<string, string> = { ok: "✓", warn: "!", bad: "✕", muted: "·", info: "" };

function OfferCard({ app, reload }: { app: any; reload: () => void }) {
  const o = app.offer;
  const ref = useRef<HTMLDivElement>(null);
  usePop(ref, app.status.code);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isCounter = app.status.code === "COUNTER_OFFER";
  const act = async (path: string) => {
    setBusy(true); setErr("");
    try { await api(`/api/applications/${app.id}/${path}`, { method: "POST" }); reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const ch = (a: any, b: any) => (isCounter && a !== b ? "changed" : "");
  return (
    <div className="card offer stack" ref={ref}>
      <div>
        <div className="eyebrow" style={{ color: "var(--red)" }}>{isCounter ? "Встречное предложение" : "Решение банка"}</div>
        <h2 style={{ fontSize: 26, margin: 0 }}>{isCounter ? "Можем выдать на других условиях" : "Кредит одобрен"}</h2>
        {isCounter && <p className="muted" style={{ marginTop: 8 }}>Отличия от вашего запроса выделены красным.</p>}
      </div>
      <div className="offer-hero pop-item">
        <div><div className="lbl">Сумма</div><div className={"huge " + ch(o.amount, app.amount)}><AnimatedNumber value={o.amount} format={rub} /></div></div>
        <div><div className="lbl">Платёж в месяц</div><div className="big"><AnimatedNumber value={o.monthly_payment} format={rub} /></div></div>
      </div>
      <table className="cmp pop-item">
        <thead><tr><th>Условие</th>{isCounter && <th>Вы запросили</th>}<th>Предложение</th></tr></thead>
        <tbody>
          <tr><td>Продукт</td>{isCounter && <td>{app.product_name}</td>}<td className={ch(o.product_code, app.product_code)}>{o.product_name}</td></tr>
          <tr><td>Сумма</td>{isCounter && <td>{money(app.amount)}</td>}<td className={ch(o.amount, app.amount)}>{money(o.amount)}</td></tr>
          <tr><td>Срок</td>{isCounter && <td>{months(app.term_months)}</td>}<td className={ch(o.term_months, app.term_months)}>{months(o.term_months)}</td></tr>
          <tr><td>Ставка</td>{isCounter && <td>—</td>}<td>{o.rate}% годовых</td></tr>
          <tr><td>Переплата за срок</td>{isCounter && <td>—</td>}<td>{money(o.overpayment)}</td></tr>
        </tbody>
      </table>
      {app.decision?.reasons?.length > 0 && isCounter && <div className="alert info pop-item">{app.decision.reasons.join(". ")}</div>}
      <div className="faint small">Предложение действует до {new Date(o.valid_until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</div>
      {err && <div className="alert bad">{err}</div>}
      <div className="row pop-item">
        <button className="btn" disabled={busy} onClick={() => act("accept")}>Принять и подписать</button>
        <button className="btn ghost" disabled={busy} onClick={() => confirm("Отказаться от предложения? Заявка будет закрыта.") && act("cancel")}>Отказаться</button>
      </div>
    </div>
  );
}

function SigningCard({ app, reload }: { app: any; reload: () => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  usePop(ref, "sign");
  const sign = async () => {
    setErr("");
    try { await api(`/api/applications/${app.id}/sign`, { body: { code } }); reload(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="card offer stack" ref={ref}>
      <div><div className="eyebrow" style={{ color: "var(--red)" }}>Последний шаг</div><h2 style={{ fontSize: 24, margin: 0 }}>Подпишите договор</h2></div>
      <div className="card flat small pop-item" style={{ background: "var(--surface-2)", boxShadow: "none", lineHeight: 1.6 }}>{app.signing.document}</div>
      {user?.can_sign ? (
        <div className="stack pop-item">
          <p className="small muted">Код подтверждения простой электронной подписи (симуляция: в реальном продукте код приходит в защищённый канал приложения банка, а не по SMS):</p>
          <div className="code-box">{app.signing.code}</div>
          <div className="row" style={{ flexWrap: "nowrap", maxWidth: 380 }}>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="Код из 6 цифр" maxLength={6} inputMode="numeric" style={{ letterSpacing: 4, fontWeight: 700 }} />
            <button className="btn" onClick={sign} disabled={code.length !== 6}>Подписать</button>
          </div>
        </div>
      ) : <div className="alert warn">У вас нет права подписи. Договор подпишет руководитель компании в своём кабинете — заявка уже ждёт его.</div>}
      {err && <div className="alert bad">{err}</div>}
    </div>
  );
}

function Tasks({ app, reload }: { app: any; reload: () => void }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  usePop(ref, "tasks");
  const open = app.tasks.filter((t: any) => t.status === "OPEN");
  const upload = async (t: any, f: File) => {
    const fd = new FormData(); fd.append("doc_type", t.doc_type); fd.append("file", f);
    try { await api(`/api/applications/${app.id}/documents`, { body: fd }); reload(); } catch (e: any) { setErr(e.message); }
  };
  const answer = async (t: any) => {
    try { await api(`/api/applications/${app.id}/tasks/${t.id}/complete`, { body: { answer: answers[t.id] || "" } }); reload(); } catch (e: any) { setErr(e.message); }
  };
  const resubmit = async () => {
    try { await api(`/api/applications/${app.id}/submit`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID?.() || String(Date.now()) } }); reload(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="card stack" ref={ref} style={{ boxShadow: "0 0 0 2px var(--warn), var(--shadow-2)" }}>
      <div><div className="eyebrow" style={{ color: "var(--warn)" }}>Нужны уточнения</div><h2 style={{ margin: 0 }}>Банку не хватает данных</h2></div>
      {open.map((t: any) => (
        <div key={t.id} className="todo pop-item">
          <div className="ico" style={{ background: "var(--warn-bg)" }}>{t.kind === "DOCUMENT" ? <FileText size={20} color="var(--warn)" /> : <PenLine size={20} color="var(--warn)" />}</div>
          <div style={{ flex: 1 }}>
            <b>{t.title}</b>
            <div className="small muted">{t.description} Запросил: {t.created_by}</div>
            {t.kind === "INFO" && t.created_by !== "Система" && (
              <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
                <input value={answers[t.id] || ""} onChange={(e) => setAnswers({ ...answers, [t.id]: e.target.value })} placeholder="Ваш ответ" />
                <button className="btn small" onClick={() => answer(t)}>Ответить</button>
              </div>
            )}
          </div>
          {t.kind === "DOCUMENT" && <label className="btn small">Загрузить<input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(t, e.target.files[0])} /></label>}
          {t.kind === "INFO" && t.created_by === "Система" && <Link className="btn small secondary" to={`/new/${app.id}`}>Исправить</Link>}
        </div>
      ))}
      {open.length === 0 && <div className="alert ok">Всё готово — отправьте заявку на повторную проверку.</div>}
      {err && <div className="alert bad">{err}</div>}
      <div className="row">
        <button className="btn" onClick={resubmit} disabled={open.some((t: any) => t.kind === "DOCUMENT")}>Отправить повторно</button>
        <Link className="btn ghost" to={`/new/${app.id}`}>Изменить анкету</Link>
      </div>
    </div>
  );
}

function Chat({ app, reload }: { app: any; reload: () => void }) {
  const [text, setText] = useState("");
  const send = async () => { if (!text.trim()) return; await api(`/api/applications/${app.id}/messages`, { body: { text } }); setText(""); reload(); };
  return (
    <div className="card reveal">
      <h2>Чат с банком</h2>
      <div className="stack" style={{ maxHeight: 280, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {app.messages.length === 0 && <div className="faint small">Задайте вопрос по заявке — ответит кредитный специалист.</div>}
        {app.messages.map((m: any) => (
          <div key={m.id} className={"bubble " + (m.author_role === "CLIENT" ? "me" : "bot")} style={{ marginTop: 0 }}>
            <div className="small" style={{ opacity: .7, marginBottom: 2 }}>{m.author_name} · {dt(m.created_at)}</div>{m.text}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12, flexWrap: "nowrap" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Сообщение" />
        <button className="btn dark" onClick={send}>Отправить</button>
      </div>
    </div>
  );
}

export default function ApplicationPage() {
  const { id } = useParams();
  const [app, setApp] = useState<any>(null);
  const [live, setLive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);
  const reload = () => api(`/api/applications/${id}`).then(setApp);
  useEffect(() => {
    reload();
    // события конвейера приходят по SSE — карточка обновляется без перезагрузки страницы
    return subscribe(Number(id), () => { setLive(true); reload(); });
  }, [id]);
  useReveal(root, [app?.status.code, app?.checks.length]);
  usePop(done, app?.status.code === "DISBURSED");
  if (!app) return <div className="row muted"><span className="spin" /> Загрузка заявки…</div>;
  const s = app.status.code;
  const inProgress = ["SUBMITTED", "DATA_CHECK", "ENRICHMENT", "SCORING", "DECISION", "DISBURSING"].includes(s);
  const tone = statusTone(s);

  return (
    <div className="grid grid-2" ref={root}>
      <div className="stack">
        <div className="card reveal">
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div><div className="eyebrow">Заявка {app.number}</div><h1 style={{ margin: 0, fontSize: 28 }}>{app.product_name}</h1>
              <div className="muted" style={{ marginTop: 4 }}>{money(app.amount)} · {months(app.term_months)} · {app.purpose_title}</div></div>
            <StatusBadge status={app.status} />
          </div>
          <Progress status={app.status} />
          <div className="status-hero" style={{ marginTop: 20 }}>
            <div className={"status-ico " + tone}>{inProgress ? <span className="spin" /> : ICONS[tone] || "•"}</div>
            <div><b style={{ fontSize: 17 }}>{app.status.title}</b><div className="muted small" style={{ marginTop: 2 }}>{app.status.hint}</div></div>
          </div>
        </div>

        {s === "NEEDS_INFO" && <Tasks app={app} reload={reload} />}
        {(s === "APPROVED" || s === "COUNTER_OFFER") && app.offer && <OfferCard app={app} reload={reload} />}
        {s === "SIGNING" && <SigningCard app={app} reload={reload} />}
        {s === "DISBURSED" && (
          <div className="balance-card" ref={done}>
            <div className="muted small pop-item">Деньги на счёте</div>
            <div className="huge pop-item" style={{ margin: "10px 0 14px" }}>+<AnimatedNumber value={app.offer.amount} format={rub} duration={1.4} /></div>
            <div className="pop-item" style={{ color: "rgba(255,255,255,.75)" }}>Ежемесячный платёж {money(app.offer.monthly_payment)} · {app.offer.rate}% · {months(app.offer.term_months)}</div>
            <Link to="/" className="btn pop-item" style={{ marginTop: 18 }}>График платежей</Link>
          </div>
        )}
        {s === "REJECTED" && app.decision && (
          <div className="card stack reveal">
            <div><div className="eyebrow" style={{ color: "var(--bad)" }}>Решение банка</div><h2 style={{ margin: 0 }}>Сейчас не можем выдать кредит</h2></div>
            <div><h3>Причины</h3>{app.decision.reasons.map((r: string) => <div key={r} className="todo"><div className="ico" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>✕</div><div>{r}</div></div>)}</div>
            {app.decision.recommendations?.length > 0 && <div><h3>Что поможет в следующий раз</h3>{app.decision.recommendations.map((r: string) => <div key={r} className="todo"><div className="ico" style={{ background: "var(--ok-bg)", color: "var(--ok)" }}>→</div><div>{r}</div></div>)}</div>}
            <div><Link className="btn" to="/new">Подобрать другой вариант</Link></div>
          </div>
        )}

        {app.score_explained && (
          <div className="card reveal">
            <h2>Как банк оценил заявку</h2>
            <div className="grid grid-2e">
              <div><h3 className="pos">Помогло</h3>{app.score_explained.positive.map((x: string) => <div key={x} className="factor"><span>{x}</span><span className="pos pts">+</span></div>)}</div>
              <div><h3 className="neg">Снизило оценку</h3>{app.score_explained.negative.length ? app.score_explained.negative.map((x: string) => <div key={x} className="factor"><span>{x}</span><span className="neg pts">−</span></div>) : <div className="small faint">Ничего — отличный результат</div>}</div>
            </div>
          </div>
        )}

        <div className="card reveal">
          <h2>Проверки</h2>
          {app.checks.length === 0 && <div className="faint small">Начнутся сразу после отправки заявки.</div>}
          {app.checks.map((c: any, i: number) => <CheckRow key={i} c={c} />)}
        </div>
        <Chat app={app} reload={reload} />
      </div>
      <div>
        <div className="card reveal" style={{ position: "sticky", top: 88 }}>
          <div className="row between"><h2 style={{ margin: 0 }}>История</h2>{live && <span className="badge ok live">online</span>}</div>
          <div style={{ marginTop: 16 }}><Timeline items={app.timeline} /></div>
          {!app.status.final && !["DISBURSING", "SIGNING"].includes(s) && (
            <button className="btn ghost small" onClick={() => confirm("Отменить заявку?") && api(`/api/applications/${app.id}/cancel`, { method: "POST" }).then(reload)}>Отменить заявку</button>
          )}
        </div>
      </div>
    </div>
  );
}
