import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, money, poll } from "../api";
import { AnimatedNumber, replay, useReveal } from "../anim";

const SERVICES: Record<string, string> = { EGRUL: "ЕГРЮЛ / ЕГРИП", FNS: "ФНС «Прозрачный бизнес»", BKI: "Бюро кредитных историй", PAYMENTS: "Платёжный шлюз" };
const MODES = [["ok", "Работает"], ["slow", "Медленно"], ["down", "Недоступен"]];

export default function BankAnalytics() {
  const [m, setM] = useState<any>(null);
  const [faults, setFaults] = useState<any>(null);
  const [rules, setRules] = useState<any>(null);
  const root = useRef<HTMLDivElement>(null);
  const funnel = useRef<HTMLDivElement>(null);
  const load = () => {
    api("/api/bank/metrics").then(setM);
    api("/api/bank/integrations").then(setFaults).catch(() => setFaults({ error: true }));
  };
  useEffect(() => { api("/api/bank/ruleset").then(setRules); return poll(load, 5000); }, []);
  useReveal(root, [m === null, rules === null]);
  const funnelKey = m?.funnel.map((f: any) => f.count).join(",");
  useLayoutEffect(() => {
    const bars = funnel.current?.querySelectorAll(".funnel-bar");
    bars?.forEach((b, i) => replay(b as HTMLElement, "grow-x", i * 0.08));
  }, [funnelKey]);
  const setFault = (service: string, mode: string) => api("/api/bank/integrations", { body: { service, mode } }).then(setFaults);
  const max = Math.max(1, ...(m?.funnel || []).map((f: any) => f.count));

  return (
    <div ref={root}>
      <div className="page-head reveal"><div><div className="eyebrow">Управление конвейером</div><h1>Аналитика и интеграции</h1></div></div>
      {m && (
        <div className="grid grid-4 reveal" style={{ marginBottom: 20 }}>
          <div className="balance-card" style={{ padding: "20px 22px" }}><div className="muted small">Заявок подано</div><div className="big" style={{ marginTop: 8 }}><AnimatedNumber value={m.funnel[0].count} /></div></div>
          <div className="card flat"><div className="faint small">Автоматические решения</div><div className="big" style={{ marginTop: 8 }}><AnimatedNumber value={m.auto_decision_share * 100} format={(v) => Math.round(v) + "%"} /></div></div>
          <div className="card flat"><div className="faint small">Медиана до решения</div><div className="big" style={{ marginTop: 8 }}>{m.median_time_to_decision_s == null ? "—" : m.median_time_to_decision_s < 120 ? `${Math.round(m.median_time_to_decision_s)} с` : `${Math.round(m.median_time_to_decision_s / 60)} мин`}</div></div>
          <div className="card flat"><div className="faint small">Выдано</div><div className="big" style={{ marginTop: 8 }}><AnimatedNumber value={m.issued_amount} format={(v) => money(v)} /></div></div>
        </div>
      )}
      <div className="grid grid-2e">
        <div className="card reveal" ref={funnel}>
          <h2>Воронка</h2>
          {m?.funnel.map((f: any) => (
            <div key={f.stage} className="funnel-row">
              <span className="small">{f.stage}</span>
              <div className="funnel-track"><div className="funnel-bar" style={{ width: `${(f.count / max) * 100}%` }} /></div>
              <b className="right">{f.count}</b>
            </div>
          ))}
          <div className="divider" />
          <h3>По статусам</h3>
          {m?.by_status.map((s: any) => <div key={s.status} className="factor"><span>{s.title}</span><b>{s.count}</b></div>)}
        </div>
        <div className="stack">
          <div className="card reveal">
            <h2>Симулятор интеграций</h2>
            <p className="small muted">Все внешние системы смоделированы. Переключите сервис в «Недоступен» и подайте заявку: конвейер повторит запрос, сработает circuit breaker, и заявка уйдёт к специалисту, а не упадёт.</p>
            {faults?.error && <div className="alert bad">mock-gateway недоступен</div>}
            {faults && !faults.error && Object.entries(SERVICES).map(([k, t]) => (
              <div key={k} className="row between factor" style={{ alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{t}</span>
                <div className="seg">{MODES.map(([mode, label]) => <button key={mode} className={(faults[k] === mode ? "on " : "") + mode} onClick={() => setFault(k, mode)}>{label}</button>)}</div>
              </div>
            ))}
          </div>
          {rules && (
            <div className="card reveal">
              <div className="row between"><h2 style={{ margin: 0 }}>Кредитная политика</h2><span className="badge muted plain">v{rules.version}</span></div>
              <dl className="kv" style={{ marginTop: 16 }}>
                <dt>Мин. DSCR</dt><dd>{rules.policy.min_dscr}</dd>
                <dt>Без залога</dt><dd>до {rules.policy.max_unsecured_to_revenue * 100}% годовой выручки</dd>
                <dt>Стоп по просрочке</dt><dd>&gt; {rules.policy.max_current_overdue_days} дней</dd>
                <dt>К специалисту</dt><dd>рейтинг {rules.policy.manual_grades.join(", ")}</dd>
                <dt>Отказ</dt><dd>рейтинг {rules.policy.reject_grades.join(", ")}</dd>
                <dt>Лимит аналитика</dt><dd>{money(rules.policy.underwriter_limit)}</dd>
                <dt>Рейтинги</dt><dd>{Object.entries(rules.grades).map(([g, v]) => `${g} ≥ ${v}`).join(" · ")}</dd>
                <dt>Надбавки</dt><dd>{Object.entries(rules.rate_premium).map(([g, v]) => `${g} +${v}%`).join(" · ")}</dd>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
