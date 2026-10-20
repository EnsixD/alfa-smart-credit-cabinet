import { ArrowRight, Bot, CalendarDays, Clock, Eye, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { lockScroll } from "../scrollLock";
import "./NewsModal.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;

// что предложить сделать после прочтения — по категории материала
const NEXT: Record<string, { text: string; to: string; cta: string }> = {
  Продукты: { text: "Посмотрите, какой продукт подойдёт под вашу задачу, — с расчётом платежа до отправки заявки.", to: "/cabinet/new", cta: "Подобрать продукт" },
  Деньги: { text: "Проверьте график платежей и ближайшую дату списания по действующим кредитам.", to: "/cabinet/loans", cta: "Мои кредиты" },
  Гид: { text: "Все условия, проверки и история по вашим заявкам собраны в одном месте.", to: "/cabinet/applications", cta: "Мои заявки" },
  Отрасль: { text: "Если нужно закрыть кассовый разрыв или пополнить оборотные средства — подберём финансирование.", to: "/cabinet/new?purpose=cash_gap", cta: "Закрыть кассовый разрыв" },
  Господдержка: { text: "Подберём продукт и подскажем, какие документы понадобятся для заявки.", to: "/cabinet/new", cta: "Начать заявку" },
};
const DEFAULT_NEXT = { text: "Подберём финансирование под задачу вашего бизнеса за несколько минут.", to: "/cabinet/new", cta: "Рассчитать кредит" };

const minutes = (n: any) => Math.max(1, Math.round(`${n.title} ${n.summary} ${n.body}`.split(/\s+/).length / 180));

/** Модальное окно новости: подробный текст, почему её показали, что сделать дальше и похожие материалы. */
export default function NewsModal({ item, all, ui, onClose, onOpen }: { item: any | null; all: any[]; ui: (cat: string) => { icon: any; tone: string }; onClose: () => void; onOpen: (n: any) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!item) return;
    const unlock = lockScroll();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    box.current?.focus();
    return () => { unlock(); window.removeEventListener("keydown", k); };
  }, [item, onClose]);
  useEffect(() => { box.current?.scrollTo({ top: 0 }); }, [item?.id]);

  const related = item ? all.filter((n) => n.id !== item.id && n.category === item.category).slice(0, 2) : [];
  const more = item && related.length < 2 ? all.filter((n) => n.id !== item.id && !related.includes(n)).slice(0, 2 - related.length) : [];
  const next = item ? NEXT[item.category] || DEFAULT_NEXT : DEFAULT_NEXT;
  const u = item ? ui(item.category) : null;
  // текст из базы делим на абзацы по предложениям, чтобы он читался легче
  const paragraphs = item ? String(item.body || "").split(/(?<=[.!?])\s+(?=[А-ЯA-Z«])/).reduce<string[]>((acc, s, i) => { if (i % 2 === 0) acc.push(s); else acc[acc.length - 1] += " " + s; return acc; }, []) : [];

  return createPortal(
    <AnimatePresence>
      {item && u && (
        <motion.div className="nm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={item.title} className={"nm " + u.tone} initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97, transition: { duration: 0.2 } }} transition={{ duration: 0.45, ease: EASE }}>
            <button className="nm-x" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
            <header className="nm-cover">
              <span className="nm-art" aria-hidden="true"><u.icon size={180} strokeWidth={1} /></span>
              <span className="nm-tag"><u.icon size={14} /> {item.category}</span>
              <AnimatePresence mode="wait">
                <motion.h2 key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>{item.title}</motion.h2>
              </AnimatePresence>
              <div className="nm-meta">
                <span><CalendarDays size={14} /> {new Date(item.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</span>
                <span><Clock size={14} /> {minutes(item)} мин чтения</span>
              </div>
            </header>
            <motion.div key={item.id} className="nm-body" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } } }}>
              <motion.p className="nm-lead" variants={{ h: { opacity: 0, y: 10 }, s: { opacity: 1, y: 0 } }}>{item.summary}</motion.p>
              {paragraphs.map((p, i) => <motion.p key={i} variants={{ h: { opacity: 0, y: 10 }, s: { opacity: 1, y: 0 } }}>{p}</motion.p>)}

              {item.why?.length > 0 && (
                <motion.section className="nm-why" variants={{ h: { opacity: 0, y: 10 }, s: { opacity: 1, y: 0 } }}>
                  <b><Eye size={15} /> Почему вы это видите</b>
                  <div>{item.why.map((w: string) => <span key={w}>{w}</span>)}</div>
                </motion.section>
              )}

              <motion.section className="nm-next" variants={{ h: { opacity: 0, y: 10 }, s: { opacity: 1, y: 0 } }}>
                <span className="nm-next-ico"><Sparkles size={18} /></span>
                <div><b>Что можно сделать</b><p>{next.text}</p></div>
                <Link to={next.to} className="nm-btn" onClick={onClose}>{next.cta} <ArrowRight size={16} /></Link>
              </motion.section>

              <motion.p className="nm-hint" variants={{ h: { opacity: 0 }, s: { opacity: 1 } }}><Bot size={14} /> Остались вопросы по теме — спросите «Помощника» в правом нижнем углу.</motion.p>

              {[...related, ...more].length > 0 && (
                <motion.section className="nm-related" variants={{ h: { opacity: 0, y: 10 }, s: { opacity: 1, y: 0 } }}>
                  <b>Читайте также</b>
                  <div>
                    {[...related, ...more].map((n) => {
                      const r = ui(n.category);
                      return (
                        <button key={n.id} className={"nm-rel " + r.tone} onClick={() => onOpen(n)}>
                          <span className="nm-tag small"><r.icon size={12} /> {n.category}</span>
                          <strong>{n.title}</strong>
                          <ArrowRight size={15} className="go" />
                        </button>
                      );
                    })}
                  </div>
                </motion.section>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
