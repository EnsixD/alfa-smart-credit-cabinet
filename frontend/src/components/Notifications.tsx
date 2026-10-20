import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  CircleCheck,
  Banknote,
  Info,
  MessageSquare,
  PenLine,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { api, poll } from "../api";
import "./Notifications.css";

type Kind = "ok" | "money" | "warn" | "bad" | "msg" | "sign" | "info";
const KIND_ICON: Record<Kind, any> = { ok: CircleCheck, money: Banknote, warn: AlertTriangle, bad: XCircle, msg: MessageSquare, sign: PenLine, info: Info };

/** Тип и заголовок уведомления из текста вида «Заявка CR-…: Статус. Подробности». */
function parse(n: any) {
  const m = /^Заявка\s+(\S+):\s*(.*)$/s.exec(n.text || "");
  const number = m?.[1];
  const rest = (m?.[2] ?? n.text ?? "").trim();
  const dot = rest.indexOf(". ");
  const title = dot > 0 ? rest.slice(0, dot) : rest;
  const body = dot > 0 ? rest.slice(dot + 2) : "";
  const t = title.toLowerCase();
  const kind: Kind = t.includes("сообщение") ? "msg"
    : t.includes("зачислен") || t.includes("зачисляем") ? "money"
    : t.includes("одобрен") ? "ok"
    : t.includes("подпис") ? "sign"
    : t.includes("отказ") || t.includes("отменен") ? "bad"
    : t.includes("уточнен") || t.includes("встречное") ? "warn"
    : "info";
  return { number, title: title.charAt(0).toUpperCase() + title.slice(1), body, kind };
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function dayGroup(iso: string) {
  const d = new Date(iso), now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= start) return "Сегодня";
  if (d.getTime() >= start - 86400000) return "Вчера";
  return "Ранее";
}

function Toasts({ items, onClose, onOpen }: { items: any[]; onClose: (id: number) => void; onOpen: (n: any) => void }) {
  return createPortal(
    <div className="nt-toasts" aria-live="polite">
      <AnimatePresence>
        {items.map((n) => {
          const p = parse(n);
          const Icon = KIND_ICON[p.kind];
          return (
            <motion.div key={n.id} layout className={"nt-toast " + p.kind} initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.2 } }} transition={{ type: "spring", stiffness: 380, damping: 30 }} onClick={() => onOpen(n)}>
              <span className="nt-ico"><Icon size={18} /></span>
              <div className="nt-toast-txt">
                <b>{p.title}</b>
                <small>{p.number ? `Заявка ${p.number}` : ""}{p.body ? ` · ${p.body}` : ""}</small>
              </div>
              <button className="nt-x" aria-label="Закрыть" onClick={(e) => { e.stopPropagation(); onClose(n.id); }}><X size={14} /></button>
              <motion.i className="nt-timer" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 6, ease: "linear" }} onAnimationComplete={() => onClose(n.id)} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

export default function Notifications() {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [toasts, setToasts] = useState<any[]>([]);
  const known = useRef<Set<number> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const bell = useAnimationControls();
  const nav = useNavigate();

  const load = () =>
    api("/api/notifications")
      .then((list: any[]) => {
        // новые уведомления после первой загрузки показываем тостом и «звоним» колокольчиком
        if (known.current) {
          const added = list.filter((n) => !known.current!.has(n.id) && !n.read);
          if (added.length) {
            setToasts((t) => [...added.slice(0, 3), ...t].slice(0, 3));
            bell.start({ rotate: [0, -18, 15, -10, 6, 0], transition: { duration: 0.7 } });
          }
        }
        known.current = new Set(list.map((n) => n.id));
        setItems(list);
      })
      .catch(() => {});
  useEffect(() => poll(load, 5000), []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (open && wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setTab("all");
      // подсвечиваем непрочитанные, пока панель открыта, а на сервере сразу отмечаем прочитанными
      setFresh(new Set(items.filter((n) => !n.read).map((n) => n.id)));
      if (unread) api("/api/notifications/read", { method: "POST" }).then(load);
    }
  };
  const go = (n: any) => {
    setOpen(false);
    setToasts((t) => t.filter((x) => x.id !== n.id));
    if (n.application_id) nav(`/cabinet/applications/${n.application_id}`);
  };
  const remove = (id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    api(`/api/notifications/${id}`, { method: "DELETE" }).catch(load);
  };
  const clear = () => { setItems([]); api("/api/notifications", { method: "DELETE" }).then(load); };
  const readAll = () => { setFresh(new Set()); api("/api/notifications/read", { method: "POST" }).then(load); };

  const isNew = (n: any) => !n.read || fresh.has(n.id);
  const list = tab === "unread" ? items.filter(isNew) : items;
  const groups: [string, any[]][] = [];
  for (const n of list) {
    const g = dayGroup(n.created_at);
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(n); else groups.push([g, [n]]);
  }
  const freshCount = items.filter(isNew).length;

  return (
    <div className="nt-wrap" ref={wrap}>
      <button className={"nt-bell" + (open ? " on" : "")} aria-label={`Уведомления${unread ? `, новых: ${unread}` : ""}`} aria-expanded={open} onClick={toggle}>
        <motion.span animate={bell} style={{ display: "grid", transformOrigin: "50% 10%" }}><Bell size={18} /></motion.span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span key="b" className="nt-badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={unread} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>{unread > 9 ? "9+" : unread}</motion.span>
              </AnimatePresence>
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="nt-panel" role="dialog" aria-label="Уведомления" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.15 } }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
            <div className="nt-head">
              <div><b>Уведомления</b>{freshCount > 0 && <span className="nt-pill">{freshCount} новых</span>}</div>
              <div className="nt-head-act">
                {freshCount > 0 && <button onClick={readAll} title="Прочитать все"><CheckCheck size={16} /></button>}
                {items.length > 0 && <button onClick={clear} title="Очистить все"><Trash2 size={15} /></button>}
              </div>
            </div>
            <div className="nt-tabs" role="tablist">
              {([["all", "Все", items.length], ["unread", "Новые", freshCount]] as const).map(([k, t, c]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                  {tab === k && <motion.span layoutId="nt-tab" className="nt-tab-bg" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                  <span>{t}</span><small>{c}</small>
                </button>
              ))}
            </div>
            <div className="nt-list">
              {list.length === 0 && (
                <motion.div className="nt-empty" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                  <span><BellOff size={22} /></span>
                  <b>{tab === "unread" ? "Всё прочитано" : "Пока ничего нового"}</b>
                  <small>Здесь появятся решения банка, запросы документов и сообщения специалиста</small>
                </motion.div>
              )}
              <AnimatePresence initial={false}>
                {groups.map(([g, ns]) => (
                  <motion.div key={g} layout className="nt-group">
                    <div className="nt-day">{g}</div>
                    <AnimatePresence initial={false}>
                      {ns.map((n, i) => {
                        const p = parse(n);
                        const Icon = KIND_ICON[p.kind];
                        return (
                          <motion.div key={n.id} layout className={"nt-item " + p.kind + (isNew(n) ? " new" : "")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.03 } }} exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.25 } }} onClick={() => go(n)}>
                            <span className="nt-ico"><Icon size={17} /></span>
                            <div className="nt-txt">
                              <b>{p.title}</b>
                              {p.body && <p>{p.body}</p>}
                              <small>{p.number && <>Заявка {p.number} · </>}{ago(n.created_at)}</small>
                            </div>
                            {isNew(n) && <i className="nt-dot" />}
                            <button className="nt-del" aria-label="Удалить" onClick={(e) => { e.stopPropagation(); remove(n.id); }}><X size={14} /></button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toasts items={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} onOpen={go} />
    </div>
  );
}
