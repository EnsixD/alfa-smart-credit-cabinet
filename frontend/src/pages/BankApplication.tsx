import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, DOC_TYPES, dt, getToken, money, months, subscribe } from "../api";
import { CheckRow, StatusBadge, Timeline } from "../components/Status";
import { useReveal } from "../anim";
import { gradeTone } from "./BankQueue";
import { useAuth } from "../main";

const FACTOR_TITLES: Record<string, string> = {
  business_age_months: "Возраст бизнеса, мес.", profit_margin: "Рентабельность", revenue_trend: "Динамика выручки",
  dscr: "DSCR (покрытие долга)", amount_to_revenue: "Сумма / выручка", bki_overdue_12m: "Просрочки за 12 мес.",
  bki_history_months: "Кредитная история, мес.", bank_client: "Обороты в банке", industry_risk: "Риск отрасли",
};

function DecisionPanel({ app, reload }: { app: any; reload: () => void }) {
  const { user } = useAuth();
  const [action, setAction] = useState("approve");
  const [comment, setComment] = useState("");
  const [amount, setAmount] = useState<number>(app.offer?.amount || app.amount);
  const [term, setTerm] = useState<number>(app.offer?.term_months || app.term_months);
  const [rate, setRate] = useState<number>(app.offer?.rate || app.product?.base_rate);
  const [task, setTask] = useState({ kind: "DOCUMENT", doc_type: "BANK_STATEMENT", title: "" });
  const [err, setErr] = useState("");
  const escalated = app.status.code === "ESCALATED";
  const canDecide = !escalated || user?.role !== "UNDERWRITER";

  const send = async () => {
    setErr("");
    const body: any = { action, comment };
    if (action === "approve" || action === "counter") Object.assign(body, { amount, term_months: term, rate });
    if (action === "request_info") body.tasks = [{ ...task, title: task.title || (task.kind === "DOCUMENT" ? DOC_TYPES[task.doc_type] : "Уточните информацию"), doc_type: task.kind === "DOCUMENT" ? task.doc_type : null }];
    try { await api(`/api/bank/applications/${app.id}/decision`, { body }); reload(); } catch (e: any) { setErr(e.message); }
  };
  if (!canDecide) return <div className="alert info">Заявка на согласовании у руководителя.</div>;
  return (
    <div className="card stack reveal" style={{ boxShadow: "0 0 0 2px var(--red), var(--shadow-2)" }}>
      <div><div className="eyebrow" style={{ color: "var(--red)" }}>Ваше решение</div><h2 style={{ margin: 0 }}>Решение специалиста</h2></div>
      <div className="tabs">
        {[["approve", "Одобрить"], ["counter", "Контрпредложение"], ["request_info", "Запросить данные"], ["reject", "Отказать"], ...(escalated ? [] : [["escalate", "Эскалировать"]])].map(([v, t]) => (
          <span key={v} className={"t " + (action === v ? "on" : "")} onClick={() => setAction(v)}>{t}</span>
        ))}
      </div>
      {(action === "approve" || action === "counter") && (
        <div className="grid grid-3">
          <label className="field"><span>Сумма, ₽</span><input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
          <label className="field"><span>Срок, мес.</span><input type="number" value={term} onChange={(e) => setTerm(Number(e.target.value))} /></label>
          <label className="field"><span>Ставка, %</span><input type="number" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>
        </div>
      )}
      {action === "request_info" && (
        <div className="grid grid-3">
          <label className="field"><span>Тип запроса</span><select value={task.kind} onChange={(e) => setTask({ ...task, kind: e.target.value })}><option value="DOCUMENT">Документ</option><option value="INFO">Вопрос</option></select></label>
          {task.kind === "DOCUMENT" && <label className="field"><span>Документ</span><select value={task.doc_type} onChange={(e) => setTask({ ...task, doc_type: e.target.value })}>{Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
          <label className="field"><span>Текст для клиента</span><input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Что нужно сделать" /></label>
        </div>
      )}
      {action === "approve" && user?.role === "UNDERWRITER" && amount > 30_000_000 && <div className="alert warn">Сумма выше полномочий аналитика (30 млн ₽) — используйте «Эскалировать».</div>}
      <label className="field"><span>Комментарий (обязателен, сохраняется в аудите; для отказа — виден клиенту)</span><textarea value={comment} onChange={(e) => setComment(e.target.value)} /></label>
      {err && <div className="alert bad">{err}</div>}
      <div><button className="btn" onClick={send} disabled={comment.trim().length < 3}>Принять решение</button></div>
    </div>
  );
}

export default function BankApplication() {
  const { id } = useParams();
  const [app, setApp] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const reload = () => api(`/api/bank/applications/${id}`).then(setApp);
  useEffect(() => { reload(); return subscribe(Number(id), reload); }, [id]);
  useReveal(root, [app?.status.code]);
  if (!app) return <div className="row muted"><span className="spin" /> Загрузка…</div>;
  const sc = app.score;
  const d = app.decision_full;
  const needDecision = ["MANUAL_REVIEW", "ESCALATED"].includes(app.status.code);
  const download = async (doc: any) => {
    const r = await fetch(`/api/bank/applications/${app.id}/documents/${doc.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = doc.filename; a.click();
  };

  return (
    <div className="stack" ref={root}>
      <div className="page-head reveal">
        <div><Link to="/" className="link small">← Очередь заявок</Link><h1 style={{ margin: "8px 0 4px" }}>{app.company.name}</h1>
          <div className="muted">{app.number} · {app.product_name} · <b>{money(app.amount)}</b> · {months(app.term_months)} · {app.purpose_title}</div></div>
        <div className="row"><StatusBadge status={app.status} />{!app.assigned_to && <button className="btn secondary small" onClick={() => api(`/api/bank/applications/${app.id}/assign`, { method: "POST" }).then(reload)}>Взять в работу</button>}</div>
      </div>

      <div className="grid grid-2">
        <div className="stack">
          {needDecision && d?.reasons?.length > 0 && (
            <div className="alert warn reveal"><b>Почему заявка у специалиста:</b><ul style={{ margin: "6px 0 0" }}>{d.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul></div>
          )}
          {needDecision && <DecisionPanel app={app} reload={reload} />}

          {sc && (
            <div className="card reveal">
              <div className="row" style={{ gap: 16, marginBottom: 8 }}>
                <div className={"grade " + sc.grade}>{sc.grade}</div>
                <div style={{ flex: 1 }}><h2 style={{ margin: 0 }}>Скоринг · {sc.points} баллов</h2><div className="faint small">правила v{sc.version} · <span className={"badge plain " + gradeTone(sc.grade)}>риск {({ A: "низкий", B: "низкий", C: "средний" } as any)[sc.grade] || "высокий"}</span></div>
                  <div className="meter"><i style={{ left: `${Math.min(100, Math.max(0, (sc.points - 400) / 5))}%` }} /></div></div>
              </div>
              <div className="grid grid-2e">
                <div>{sc.factors.map((f: any) => (
                  <div key={f.factor} className="factor"><span>{FACTOR_TITLES[f.factor] || f.factor}: <b>{String(f.value)}</b><div className="small muted">{f.label}</div></span><span className={"pts " + (f.points >= 0 ? "pos" : "neg")}>{f.points > 0 ? "+" : ""}{f.points}</span></div>
                ))}</div>
                <dl className="kv">
                  <dt>DSCR</dt><dd>{sc.metrics.dscr}</dd><dt>Рентабельность</dt><dd>{(sc.metrics.profit_margin * 100).toFixed(1)}%</dd>
                  <dt>Чистый поток/мес</dt><dd>{money(sc.metrics.monthly_net_income)}</dd><dt>Новый платёж</dt><dd>{money(sc.metrics.new_monthly_payment)}</dd>
                  <dt>Сумма/выручка</dt><dd>{(sc.metrics.amount_to_revenue * 100).toFixed(0)}%</dd><dt>Правила</dt><dd>v{sc.version}</dd>
                </dl>
              </div>
            </div>
          )}
          {d && (
            <div className="card reveal">
              <h2>Решение</h2>
              <dl className="kv"><dt>Исход</dt><dd>{d.outcome}</dd><dt>Кем</dt><dd>{d.by}</dd><dt>Причины</dt><dd>{(d.reasons || []).join("; ")}</dd>
                {d.stop_factors?.length > 0 && <><dt>Стоп-факторы</dt><dd className="neg">{d.stop_factors.join("; ")}</dd></>}
                {app.offer && <><dt>Предложение</dt><dd>{app.offer.product_name}: {money(app.offer.amount)}, {app.offer.term_months} мес., {app.offer.rate}%, платёж {money(app.offer.monthly_payment)}</dd></>}
              </dl>
            </div>
          )}

          <div className="card reveal">
            <h2>Проверки и внешние источники</h2>
            {app.checks.map((c: any, i: number) => (
              <CheckRow key={i} c={c}>
                <details style={{ marginTop: 6 }}><summary className="small link">Ответ источника</summary><pre className="json">{JSON.stringify(c.payload, null, 2)}</pre></details>
              </CheckRow>
            ))}
          </div>

          <div className="card reveal">
            <h2>Анкета</h2>
            <div className="grid grid-2e">
              <dl className="kv">
                <dt>ИНН</dt><dd>{app.company.inn}</dd><dt>ОКВЭД</dt><dd>{app.company.okved} {app.company.okved_name}</dd>
                <dt>Регистрация</dt><dd>{app.company.reg_date}</dd><dt>Регион</dt><dd>{app.company.region}</dd>
                <dt>Контакт</dt><dd>{app.contact?.name}, {app.contact?.position}</dd>
              </dl>
              <dl className="kv">
                <dt>Выручка</dt><dd>{money(app.financials.annual_revenue)}</dd><dt>Расходы</dt><dd>{money(app.financials.annual_expenses)}</dd>
                <dt>Выручка пр. года</dt><dd>{money(app.financials.prev_year_revenue)}</dd><dt>Платежи по долгам</dt><dd>{money(app.financials.monthly_debt_payments)}/мес</dd>
                {app.collateral?.type && <><dt>Залог</dt><dd>{app.collateral.type}: {app.collateral.description} ({money(app.collateral.value)})</dd></>}
              </dl>
            </div>
            {app.purpose_text && <p className="small" style={{ marginTop: 8 }}>Комментарий клиента: {app.purpose_text}</p>}
            <h3 style={{ marginTop: 12 }}>Документы</h3>
            {app.documents.length === 0 && <div className="small muted">Нет</div>}
            {app.documents.map((doc: any) => <div key={doc.id} className="small"><a href="#" onClick={(e) => { e.preventDefault(); download(doc); }}>{doc.doc_title}: {doc.filename}</a> {Object.keys(doc.extracted || {}).length > 0 && <span className="muted">· распознано: {JSON.stringify(doc.extracted)}</span>}</div>)}
            <h3 style={{ marginTop: 12 }}>Запросы клиенту</h3>
            {app.tasks.map((t: any) => <div key={t.id} className="small">{t.status === "DONE" ? "✓" : "○"} {t.title} <span className="muted">({t.created_by}){t.answer && ` — ответ: ${t.answer}`}</span></div>)}
          </div>
        </div>

        <div className="stack">
          <div className="card reveal">
            <h2>Чат с клиентом</h2>
            <div className="stack" style={{ maxHeight: 260, overflow: "auto" }}>
              {app.messages.map((m: any) => <div key={m.id} className={"bubble " + (m.author_role === "BANK" ? "me" : "bot")}><div className="small" style={{ opacity: .7 }}>{m.author_name} · {dt(m.created_at)}</div>{m.text}</div>)}
            </div>
            <div className="row" style={{ marginTop: 10, flexWrap: "nowrap" }}>
              <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Сообщение клиенту" />
              <button className="btn" onClick={() => msg.trim() && api(`/api/bank/applications/${app.id}/messages`, { body: { text: msg } }).then(() => { setMsg(""); reload(); })}>→</button>
            </div>
          </div>
          <div className="card reveal"><h2>Журнал событий · аудит</h2><Timeline items={app.timeline} /></div>
        </div>
      </div>
    </div>
  );
}
