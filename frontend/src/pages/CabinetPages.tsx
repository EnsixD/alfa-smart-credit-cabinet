import { CreditCard, Download, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, DOC_TYPES, getToken, money, months, poll } from "../api";
import { useReveal } from "../anim";
import { useAuth } from "../main";
import { AppRow } from "./Dashboard";

function Page({ title, sub, action, children, deps }: { title: string; sub: string; action?: any; children: any; deps: unknown[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useReveal(ref, deps);
  return (
    <div className="page" ref={ref}>
      <div className="page-title row-between reveal"><div><h1>{title}</h1><p>{sub}</p></div>{action}</div>
      {children}
    </div>
  );
}

export function ApplicationsList() {
  const [apps, setApps] = useState<any[] | null>(null);
  const [f, setF] = useState("all");
  useEffect(() => poll(() => api("/api/applications").then(setApps), 4000), []);
  const groups: Record<string, (a: any) => boolean> = {
    all: () => true, active: (a) => !a.status.final, done: (a) => a.status.code === "DISBURSED", closed: (a) => ["REJECTED", "CANCELLED"].includes(a.status.code),
  };
  const list = (apps || []).filter(groups[f]);
  return (
    <Page title="Заявки" sub="Все ваши обращения за финансированием" action={<Link to="/cabinet/new" className="btn">Новая заявка</Link>} deps={[apps === null, f]}>
      <div className="tabs reveal" style={{ marginBottom: 12 }}>
        {[["all", "Все"], ["active", "В работе"], ["done", "Выданы"], ["closed", "Закрыты"]].map(([k, t]) => <span key={k} className={"t " + (f === k ? "on" : "")} onClick={() => setF(k)}>{t}</span>)}
      </div>
      <section className="block reveal">
        {apps && list.length === 0 && <div className="empty-row">Здесь пока пусто.</div>}
        {list.map((a) => <AppRow key={a.id} a={a} />)}
      </section>
    </Page>
  );
}

export function LoansPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api("/api/company").then(setData); }, []);
  const loans = data?.loans || [];
  return (
    <Page title="Кредиты" sub="Действующие кредиты и графики платежей" deps={[data === null]}>
      {data && loans.length === 0 && <section className="block reveal"><div className="empty-row">Действующих кредитов нет. <Link to="/cabinet/new" className="link-sm">Подобрать кредит</Link></div></section>}
      {loans.map((l: any, i: number) => (
        <details key={l.id} className="block loan reveal" open={i === 0 || window.location.search.includes("schedule")}>
          <summary className="loan-sum">
            <span className="ar-ico"><CreditCard size={16} /></span>
            <div className="ar-main"><b>Договор {l.contract_number}</b><small>{money(l.amount)} · {l.rate}% · {months(l.term_months)}</small></div>
            <div className="right"><small className="faint">Платёж в месяц</small><b>{money(l.monthly_payment)}</b></div>
          </summary>
          <table className="tbl">
            <thead><tr><th>№</th><th>Дата</th><th>Платёж</th><th>Основной долг</th><th>Проценты</th><th>Остаток</th></tr></thead>
            <tbody>{l.schedule.map((r: any) => <tr key={r.n}><td>{r.n}</td><td>{new Date(r.date).toLocaleDateString("ru-RU")}</td><td>{money(r.payment)}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.rest)}</td></tr>)}</tbody>
          </table>
        </details>
      ))}
    </Page>
  );
}

export function DocumentsPage() {
  const [docs, setDocs] = useState<any[] | null>(null);
  useEffect(() => {
    (async () => {
      const apps = await api("/api/applications");
      const details = await Promise.all(apps.map((a: any) => api(`/api/applications/${a.id}`)));
      setDocs(details.flatMap((a: any) => a.documents.map((d: any) => ({ ...d, app: a }))));
    })();
  }, []);
  const download = async (d: any) => {
    const r = await fetch(`/api/applications/${d.app.id}/documents/${d.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a"); a.href = url; a.download = d.filename; a.click();
  };
  return (
    <Page title="Документы" sub="Всё, что вы загружали по заявкам" deps={[docs === null]}>
      <section className="block reveal">
        {docs && docs.length === 0 && <div className="empty-row">Документов пока нет — они появятся, когда вы загрузите их в заявке.</div>}
        {(docs || []).map((d) => (
          <div key={d.id} className="app-row">
            <span className="ar-ico"><FileText size={16} /></span>
            <div className="ar-main"><b>{DOC_TYPES[d.doc_type] || d.doc_type}</b><small>{d.filename} · заявка № {d.app.number}</small></div>
            {Object.keys(d.extracted || {}).length > 0 ? <span className="badge ok">Распознан</span> : <span className="badge muted">Загружен</span>}
            <button className="btn btn-ghost btn-sm" onClick={() => download(d)}><Download size={14} /> Скачать</button>
          </div>
        ))}
      </section>
    </Page>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const c = user?.company;
  const rows: [string, any][] = c ? [
    ["Компания", c.name], ["ИНН", c.inn], ["ОГРН", c.ogrn], ["Вид деятельности", `${c.okved} · ${c.okved_name}`],
    ["Адрес", c.address], ["Руководитель", c.director], ["Дата регистрации", new Date(c.reg_date).toLocaleDateString("ru-RU")],
  ] : [];
  return (
    <Page title="Настройки" sub="Профиль пользователя и данные компании" deps={[]}>
      <div className="grid-2col">
        <section className="block reveal">
          <div className="block-head"><h3>Профиль</h3></div>
          <dl className="kv"><dt>ФИО</dt><dd>{user?.full_name}</dd><dt>Должность</dt><dd>{user?.position}</dd><dt>Логин</dt><dd>{user?.login}</dd>
            <dt>Право подписи</dt><dd>{user?.can_sign ? "Есть" : "Нет — договор подписывает руководитель"}</dd></dl>
        </section>
        <section className="block reveal">
          <div className="block-head"><h3>Компания</h3></div>
          <dl className="kv">{rows.map(([k, v]) => <><dt key={k}>{k}</dt><dd key={k + "v"}>{v}</dd></>)}</dl>
        </section>
      </div>
    </Page>
  );
}
