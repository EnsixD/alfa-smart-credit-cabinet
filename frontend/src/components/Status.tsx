import { useRef } from "react";
import { dt, statusTone } from "../api";
import { useProgressFill } from "../anim";

export function StatusBadge({ status }: { status: any }) {
  const live = ["SUBMITTED", "DATA_CHECK", "ENRICHMENT", "SCORING", "DECISION", "DISBURSING"].includes(status.code);
  return <span className={"badge " + statusTone(status.code) + (live ? " live" : "")}>{status.title}</span>;
}

export function Progress({ status }: { status: any }) {
  const ref = useRef<HTMLDivElement>(null);
  useProgressFill(ref, status.code);
  const failed = status.code === "REJECTED" || status.code === "CANCELLED";
  return (
    <div className="progress" ref={ref}>
      {status.stages.map((s: string, i: number) => {
        let cls = "";
        if (i < status.stage || (status.final && i <= status.stage && !failed)) cls = "done";
        else if (i === status.stage) cls = failed ? "failed" : "current";
        return (
          <div key={s} className={"step " + cls}>
            <div className="bar"><div className="fill" data-on={cls ? "1" : "0"} /></div>
            <div className="lbl">{s}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Timeline({ items }: { items: any[] }) {
  return (
    <ul className="timeline">
      {[...items].reverse().map((t) => (
        <li key={t.id}>
          <div style={{ fontWeight: 600 }}>{t.title}</div>
          {t.message && t.message !== t.title && <div className="small muted" style={{ marginTop: 2 }}>{t.message}</div>}
          <div className="faint small" style={{ marginTop: 2 }}>{t.actor} · {dt(t.created_at)}</div>
        </li>
      ))}
    </ul>
  );
}

export const CHECK_TITLES: Record<string, string> = {
  COMPLETENESS: "Полнота анкеты и документов",
  EGRUL: "ЕГРЮЛ / ЕГРИП",
  FNS: "ФНС «Прозрачный бизнес»",
  BKI: "Бюро кредитных историй",
  INTERNAL: "Данные банка: обороты по счёту",
};

const CHECK_MAP: Record<string, [string, string, string]> = {
  OK: ["ok", "Пройдена", "✓"], WARN: ["warn", "Есть замечания", "!"], FAIL: ["bad", "Не пройдена", "✕"], UNAVAILABLE: ["muted", "Недоступно", "—"],
};

export function CheckBadge({ status }: { status: string }) {
  const [tone, title] = CHECK_MAP[status] || ["info", status];
  return <span className={"badge " + tone}>{title}</span>;
}

export function CheckRow({ c, children }: { c: any; children?: any }) {
  return (
    <div className="check-row reveal">
      <div className={"check-ico " + c.status}>{(CHECK_MAP[c.status] || [])[2] || "·"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row between" style={{ gap: 8 }}><b>{CHECK_TITLES[c.source] || c.source}</b><CheckBadge status={c.status} /></div>
        <div className="small muted" style={{ marginTop: 4 }}>{c.summary}</div>
        {children}
      </div>
    </div>
  );
}
