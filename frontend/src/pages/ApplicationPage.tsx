import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Clock,
  FileText,
  Loader,
  MessageSquare,
  PenLine,
  Percent,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, dt, money, months, statusTone, subscribe } from "../api";
import { AnimatedNumber, celebrate, usePop } from "../anim";
import {
  CheckRow,
  Progress,
  StatusBadge,
  Timeline,
} from "../components/Status";
import { DisburseOverlay, DisbursedView } from "../components/Disbursed";
import { AnimatePresence, motion } from "motion/react";
import Tracker from "../components/Tracker";
import BrandField from "../components/BrandField";
import { useAuth } from "../auth";

const rub = (v: number) => Math.round(v).toLocaleString("ru-RU") + " ₽";
const IN_PROGRESS = [
  "SUBMITTED",
  "DATA_CHECK",
  "ENRICHMENT",
  "SCORING",
  "DECISION",
  "DISBURSING",
];

/** Экран успеха: рисуется галочка, расходятся кольца, летят конфетти. */
function SuccessHero({
  app,
  title,
  sub,
  children,
}: {
  app: any;
  title: string;
  sub: string;
  children?: any;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => celebrate(el), 450);
    return () => clearTimeout(t);
  }, [app.status.code]);
  return (
    <div className="success" ref={ref}>
      <div className="vx-state-field" aria-hidden="true">
        <BrandField />
      </div>
      <div className="sx-badge">
        <span className="sx-ring" />
        <span className="sx-ring" />
        <div className="sx-circle">
          <svg viewBox="0 0 24 24" width="40" height="40">
            <path className="sx-check" d="M5 12.5l4.2 4.2L19 7" />
          </svg>
        </div>
      </div>
      <div className="sx-item">
        <div className="eyebrow" style={{ color: "rgba(255,255,255,.7)" }}>
          Заявка {app.number}
        </div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
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
    setBusy(true);
    setErr("");
    try {
      await api(`/api/applications/${app.id}/${path}`, { method: "POST" });
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const facts = (
    <div className="sx-facts sx-item">
      <div>
        <Wallet size={16} />
        <span>Платёж</span>
        <b>
          <AnimatedNumber value={o.monthly_payment} format={rub} />
        </b>
      </div>
      <div>
        <CalendarDays size={16} />
        <span>Срок</span>
        <b>{months(o.term_months)}</b>
      </div>
      <div>
        <Percent size={16} />
        <span>Ставка</span>
        <b>{o.rate}%</b>
      </div>
    </div>
  );
  const actions = (
    <div className="sx-actions sx-item">
      <button
        className="btn sx-primary"
        disabled={busy}
        onClick={() => act("accept")}
      >
        Принять и подписать <ArrowRight size={16} />
      </button>
      <button
        className="btn sx-ghost"
        disabled={busy}
        onClick={() =>
          confirm("Отказаться от предложения? Заявка будет закрыта.") &&
          act("cancel")
        }
      >
        Отказаться
      </button>
    </div>
  );
  if (!isCounter) {
    return (
      <SuccessHero
        app={app}
        title={`Одобрено ${money(o.amount)}`}
        sub={`${o.product_name} · предложение действует до ${new Date(o.valid_until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`}
      >
        {facts}
        {err && <div className="alert bad">{err}</div>}
        {actions}
      </SuccessHero>
    );
  }
  const ch = (a: any, b: any) => (a !== b ? "changed" : "");
  return (
    <div className="card action-card">
      <div className="ac-head">
        <div className="ac-ico warn">
          <Percent size={20} />
        </div>
        <div>
          <h2>Банк предлагает другие условия</h2>
          <p className="muted small">
            {(app.decision?.reasons || []).join(". ")}
          </p>
        </div>
      </div>
      <div className="compare">
        <div>
          <span>Вы запросили</span>
          <b>{money(app.amount)}</b>
          <small>
            {months(app.term_months)} · {app.product_name}
          </small>
        </div>
        <ArrowRight size={20} className="faint" />
        <div className="new">
          <span>Предложение</span>
          <b className={ch(o.amount, app.amount)}>{money(o.amount)}</b>
          <small>
            <span className={ch(o.term_months, app.term_months)}>
              {months(o.term_months)}
            </span>{" "}
            ·{" "}
            <span className={ch(o.product_code, app.product_code)}>
              {o.product_name}
            </span>
          </small>
        </div>
      </div>
      <div className="facts-light">
        <div>
          <span>Платёж</span>
          <b>{money(o.monthly_payment)}</b>
        </div>
        <div>
          <span>Ставка</span>
          <b>{o.rate}%</b>
        </div>
        <div>
          <span>Переплата</span>
          <b>{money(o.overpayment)}</b>
        </div>
      </div>
      {err && <div className="alert bad">{err}</div>}
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => act("accept")}>
          Принять условия <ArrowRight size={16} />
        </button>
        <button
          className="btn ghost"
          disabled={busy}
          onClick={() =>
            confirm("Отказаться от предложения? Заявка будет закрыта.") &&
            act("cancel")
          }
        >
          Отказаться
        </button>
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
    setErr("");
    setBusy(true);
    try {
      await api(`/api/applications/${app.id}/sign`, { body: { code } });
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card action-card" ref={ref}>
      <div className="ac-head">
        <div className="ac-ico">
          <PenLine size={20} />
        </div>
        <div>
          <h2>Подпишите договор</h2>
          <p className="muted small">
            {app.signing.contract_number} · последний шаг перед зачислением
          </p>
        </div>
      </div>
      <details className="doc-preview">
        <summary>
          <FileText size={16} /> Текст договора
        </summary>
        <p>{app.signing.document}</p>
      </details>
      {user?.can_sign ? (
        <>
          <div className="code-row">
            <div>
              <div className="faint small">Код подтверждения</div>
              <div className="code-box">{app.signing.code}</div>
            </div>
            <p className="small faint" style={{ maxWidth: 280, margin: 0 }}>
              Симуляция простой электронной подписи: в реальном продукте код
              приходит в защищённый канал приложения банка.
            </p>
          </div>
          <div className="row" style={{ flexWrap: "nowrap", maxWidth: 420 }}>
            <input
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              maxLength={6}
              inputMode="numeric"
            />
            <button
              className="btn"
              onClick={sign}
              disabled={code.length !== 6 || busy}
            >
              Подписать
            </button>
          </div>
        </>
      ) : (
        <div className="alert warn">
          У вас нет права подписи — договор подпишет руководитель компании в
          своём кабинете.
        </div>
      )}
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
    const fd = new FormData();
    fd.append("doc_type", t.doc_type);
    fd.append("file", f);
    try {
      await api(`/api/applications/${app.id}/documents`, { body: fd });
      await reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  const answer = async (t: any) => {
    try {
      await api(`/api/applications/${app.id}/tasks/${t.id}/complete`, {
        body: { answer: answers[t.id] || "" },
      });
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const resubmit = async () => {
    setBusy("submit");
    try {
      await api(`/api/applications/${app.id}/submit`, {
        method: "POST",
        headers: {
          "Idempotency-Key": crypto.randomUUID?.() || String(Date.now()),
        },
      });
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="card action-card">
      <div className="ac-head">
        <div className="ac-ico warn">
          <FileText size={20} />
        </div>
        <div>
          <h2>
            {open.length ? "Банку нужно ещё немного данных" : "Всё готово"}
          </h2>
          <p className="muted small">
            {open.length
              ? `Осталось: ${open.length}`
              : "Отправьте заявку на повторную проверку"}
          </p>
        </div>
      </div>
      {open.map((t: any) => (
        <div key={t.id} className="task">
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{t.title}</b>
            <div className="small faint">
              {t.description} · запросил: {t.created_by}
            </div>
            {t.kind === "INFO" && t.created_by !== "Система" && (
              <div
                className="row"
                style={{ marginTop: 10, flexWrap: "nowrap" }}
              >
                <input
                  value={answers[t.id] || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, [t.id]: e.target.value })
                  }
                  placeholder="Ваш ответ"
                />
                <button className="btn small" onClick={() => answer(t)}>
                  Ответить
                </button>
              </div>
            )}
          </div>
          {t.kind === "DOCUMENT" && (
            <label className="btn small">
              {busy === String(t.id) ? (
                <Loader size={14} className="spin-ico" />
              ) : (
                <Upload size={14} />
              )}{" "}
              Загрузить
              <input
                type="file"
                hidden
                onChange={(e) =>
                  e.target.files?.[0] && upload(t, e.target.files[0])
                }
              />
            </label>
          )}
          {t.kind === "INFO" && t.created_by === "Система" && (
            <Link className="btn small secondary" to={`/cabinet/new/${app.id}`}>
              Исправить
            </Link>
          )}
        </div>
      ))}
      {err && <div className="alert bad">{err}</div>}
      <div className="row">
        <button
          className="btn"
          onClick={resubmit}
          disabled={
            open.some((t: any) => t.kind === "DOCUMENT") || busy === "submit"
          }
        >
          Отправить повторно
        </button>
        <Link className="btn ghost" to={`/cabinet/new/${app.id}`}>
          Изменить анкету
        </Link>
      </div>
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
    try {
      seen = !!localStorage.getItem(key);
      localStorage.setItem(key, "1");
    } catch {
      /* без хранилища просто покажем */
    }
    if (!seen) setOverlay(true);
  }, [app?.status.code, app?.id]);
  useEffect(() => {
    setApp(null);
    setDetails(false);
    reload();
    // события конвейера приходят по SSE — карточка обновляется без перезагрузки
    return subscribe(Number(id), () => {
      reload();
    });
  }, [id]);
  if (!app)
    return (
      <div className="grid grid-2">
        <div className="stack">
          <div className="skeleton" style={{ height: 180 }} />
          <div className="skeleton" style={{ height: 260 }} />
        </div>
        <div className="skeleton" style={{ height: 360 }} />
      </div>
    );
  const s = app.status.code;

  if (s === "DISBURSED" && !details) {
    return (
      <>
        <DisbursedView
          app={app}
          onReplay={() => setOverlay(true)}
          onDetails={() => setDetails(true)}
        />
        {overlay && (
          <DisburseOverlay app={app} onClose={() => setOverlay(false)} />
        )}
      </>
    );
  }

  const actions = (
    <>
      {s === "NEEDS_INFO" && <Tasks app={app} reload={reload} />}
      {(s === "APPROVED" || s === "COUNTER_OFFER") && app.offer && <OfferCard app={app} reload={reload} />}
      {s === "SIGNING" && <SigningCard app={app} reload={reload} />}
    </>
  );
  return <Tracker app={app} reload={reload} actions={actions} onBackToResult={s === "DISBURSED" ? () => setDetails(false) : undefined} />;
}
