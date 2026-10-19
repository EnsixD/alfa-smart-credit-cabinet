import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, dt, money, poll } from "../api";
import { useReveal } from "../anim";
import { StatusBadge } from "../components/Status";

const FILTERS = [
  ["ACTION", "Требуют решения"],
  ["", "Все"],
  ["SUBMITTED,DATA_CHECK,ENRICHMENT,SCORING,DECISION", "В конвейере"],
  ["NEEDS_INFO", "Ждём клиента"],
  ["APPROVED,COUNTER_OFFER,SIGNING", "Предложение"],
  ["DISBURSED", "Выдано"],
  ["REJECTED,CANCELLED", "Закрыто"],
];
export const gradeTone = (g: string) => ({ A: "ok", B: "ok", C: "warn" } as Record<string, string>)[g] || "bad";

export default function BankQueue() {
  const [filter, setFilter] = useState("ACTION");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true; // ответ от прошлой вкладки не должен перезаписать текущую
    const load = () => api(`/api/bank/applications?status=${encodeURIComponent(filter)}&q=${encodeURIComponent(q)}`).then((r) => { if (alive) setRows(r); });
    const stop = poll(load, 4000);
    return () => { alive = false; stop(); };
  }, [filter, q]);
  useReveal(ref, [rows]);

  return (
    <div ref={ref}>
      <div className="page-head reveal">
        <div><div className="eyebrow">Кредитный конвейер</div><h1>Очередь заявок</h1></div>
        <input style={{ maxWidth: 320 }} placeholder="Номер, компания или ИНН" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tabs reveal" style={{ marginBottom: 16 }}>
        {FILTERS.map(([v, t]) => <span key={t} className={"t " + (filter === v ? "on" : "")} onClick={() => setFilter(v)}>{t}</span>)}
      </div>
      <div className="card reveal" style={{ padding: "8px 16px" }}>
        <table>
          <thead><tr><th>Заявка</th><th>Компания</th><th>Продукт</th><th>Сумма</th><th>Рейтинг</th><th>Статус</th><th>Обновлена</th></tr></thead>
          <tbody>
            {(rows || []).map((a) => (
              <tr key={a.id} className="clickable reveal" onClick={() => nav(`/bank/applications/${a.id}`)}>
                <td><b>{a.number}</b></td>
                <td>{a.company_name}<div className="small faint">ИНН {a.inn}</div></td>
                <td>{a.product_name}</td>
                <td><b>{money(a.amount)}</b><div className="small faint">{a.term_months} мес.</div></td>
                <td>{a.grade ? <span className={"badge plain " + gradeTone(a.grade)}>{a.grade} · {a.points}</span> : <span className="faint">—</span>}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="small muted">{dt(a.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <div className="empty"><div className="ico">✓</div><h3>Здесь пусто</h3><p className="muted small">В этом разделе нет заявок.</p></div>}
      </div>
    </div>
  );
}
