import {
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Download,
  FileText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, DOC_TYPES, getToken, money, months, poll } from "../api";
import { useReveal } from "../anim";
import { useAuth } from "../auth";
import { AnimatePresence, motion } from "motion/react";
import { AppRow } from "./Dashboard";

function Page({
  title,
  sub,
  action,
  children,
  deps,
}: {
  title: string;
  sub: string;
  action?: any;
  children: any;
  deps: unknown[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, deps);
  return (
    <div className="page" ref={ref}>
      <div className="page-title row-between reveal">
        <div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ApplicationsList() {
  const [apps, setApps] = useState<any[] | null>(null);
  const [f, setF] = useState("all");
  useEffect(() => poll(() => api("/api/applications").then(setApps), 4000), []);
  const groups: Record<string, (a: any) => boolean> = {
    all: () => true,
    active: (a) => !a.status.final,
    done: (a) => a.status.code === "DISBURSED",
    closed: (a) => ["REJECTED", "CANCELLED"].includes(a.status.code),
  };
  const list = (apps || []).filter(groups[f]);
  return (
    <Page
      title="Заявки"
      sub="Все ваши обращения за финансированием"
      action={
        <Link to="/cabinet/new" className="btn">
          Новая заявка
        </Link>
      }
      deps={[apps === null, f]}
    >
      <div className="vf-app-filters" role="group" aria-label="Статус заявок">
        {[
          ["all", "Все"],
          ["active", "В работе"],
          ["done", "Выданы"],
          ["closed", "Закрыты"],
        ].map(([k, t]) => (
          <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>
            {f === k && <motion.i layoutId="application-filter" />}
            <b>{t}</b>
            <small>{(apps || []).filter(groups[k]).length}</small>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.section
          key={f}
          className="block"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {apps && list.length === 0 && (
            <div className="empty-row">Здесь пока пусто.</div>
          )}
          {list.map((a) => (
            <AppRow key={a.id} a={a} />
          ))}
        </motion.section>
      </AnimatePresence>
    </Page>
  );
}

export function LoansPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api("/api/company")
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);
  const loans = data?.loans || [];
  return (
    <Page
      title="Кредиты"
      sub="Выберите кредит, чтобы увидеть условия, статистику и график платежей"
      deps={[data === null]}
    >
      {err && <div className="alert bad">{err}</div>}
      {!data && !err && (
        <div className="cr-empty" role="status">
          Загружаем ваши кредиты…
        </div>
      )}
      {data && !loans.length && (
        <section className="block">
          <div className="empty-row">
            Действующих кредитов пока нет.{" "}
            <Link to="/cabinet/new" className="link-sm">
              Подобрать кредит
            </Link>
          </div>
        </section>
      )}
      <div className="cr-loan-list">
        {loans.map((l: any) => (
          <Link
            key={l.id}
            className="cr-loan-card"
            to={`/cabinet/loans/${l.id}`}
          >
            <div className="cr-loan-card-head">
              <span className="cr-loan-icon">
                <CreditCard size={24} />
              </span>
              <span>Договор {l.contract_number}</span>
              <ArrowUpRight size={22} />
            </div>
            <span className="cr-loan-card-label">Сумма кредита</span>
            <b className="cr-loan-card-amount">{money(l.amount)}</b>
            <div className="cr-loan-card-data">
              <div>
                <span>Ставка</span>
                <b>{l.rate}%</b>
              </div>
              <div>
                <span>Срок</span>
                <b>{months(l.term_months)}</b>
              </div>
              <div>
                <span>Платёж в месяц</span>
                <b>{money(l.monthly_payment)}</b>
              </div>
            </div>
            <span className="cr-loan-card-link">
              Статистика и график платежей <ArrowRight size={18} />
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
export function DocumentsPage() {
  const [docs, setDocs] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const apps = await api("/api/applications");
      const details = await Promise.all(
        apps.map((a: any) => api(`/api/applications/${a.id}`)),
      );
      setDocs(
        details.flatMap((a: any) =>
          a.documents.map((d: any) => ({ ...d, app: a })),
        ),
      );
    })();
  }, []);
  const download = async (d: any) => {
    const r = await fetch(`/api/applications/${d.app.id}/documents/${d.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = d.filename;
    a.click();
  };
  return (
    <Page
      title="Документы"
      sub="Всё, что вы загружали по заявкам"
      deps={[docs === null]}
    >
      <section className="block reveal">
        {docs && docs.length === 0 && (
          <div className="empty-row">
            Документов пока нет — они появятся, когда вы загрузите их в заявке.
          </div>
        )}
        {(docs || []).map((d) => (
          <div key={d.id} className="app-row">
            <span className="ar-ico">
              <FileText size={16} />
            </span>
            <div className="ar-main">
              <b>{DOC_TYPES[d.doc_type] || d.doc_type}</b>
              <small>
                {d.filename} · заявка № {d.app.number}
              </small>
            </div>
            {Object.keys(d.extracted || {}).length > 0 ? (
              <span className="badge ok">Распознан</span>
            ) : (
              <span className="badge muted">Загружен</span>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => download(d)}
            >
              <Download size={14} /> Скачать
            </button>
          </div>
        ))}
      </section>
    </Page>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const c = user?.company;
  const rows: [string, any][] = c
    ? [
        ["Компания", c.name],
        ["ИНН", c.inn],
        ["ОГРН", c.ogrn],
        ["Вид деятельности", `${c.okved} · ${c.okved_name}`],
        ["Адрес", c.address],
        ["Руководитель", c.director],
        ["Дата регистрации", new Date(c.reg_date).toLocaleDateString("ru-RU")],
      ]
    : [];
  return (
    <Page
      title="Настройки"
      sub="Профиль пользователя и данные компании"
      deps={[]}
    >
      <div className="grid-2col">
        <section className="block reveal">
          <div className="block-head">
            <h3>Профиль</h3>
          </div>
          <dl className="kv">
            <dt>ФИО</dt>
            <dd>{user?.full_name}</dd>
            <dt>Должность</dt>
            <dd>{user?.position}</dd>
            <dt>Логин</dt>
            <dd>{user?.login}</dd>
            <dt>Право подписи</dt>
            <dd>
              {user?.can_sign
                ? "Есть"
                : "Нет — договор подписывает руководитель"}
            </dd>
          </dl>
        </section>
        <section className="block reveal">
          <div className="block-head">
            <h3>Компания</h3>
          </div>
          <dl className="kv">
            {rows.map(([k, v]) => (
              <>
                <dt key={k}>{k}</dt>
                <dd key={k + "v"}>{v}</dd>
              </>
            ))}
          </dl>
        </section>
      </div>
    </Page>
  );
}
