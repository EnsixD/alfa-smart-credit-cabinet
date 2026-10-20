import "./EmptyState.css";
import { ArrowRight, Banknote, FileText, FolderOpen, Sparkles, Zap, Wallet, Factory, Clock } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import BlurText from "./reactbits/BlurText";
import ClickSpark from "./reactbits/ClickSpark";
import Particles from "./reactbits/Particles";
import ShinyText from "./reactbits/ShinyText";

type Kind = "applications" | "loans" | "documents" | "filter";

const COPY: Record<Kind, { title: string; text: string; cta?: string; icon: any }> = {
  applications: {
    title: "У вас ещё нет заявок",
    text: "Оформление займёт около 5 минут: реквизиты компании подставим сами, а подходящие продукты подберём по вашей цели.",
    cta: "Составить заявку",
    icon: FileText,
  },
  loans: {
    title: "Действующих кредитов пока нет",
    text: "Подберём продукт под задачу бизнеса — без запроса в бюро кредитных историй на этапе подбора.",
    cta: "Подобрать кредит",
    icon: Banknote,
  },
  documents: {
    title: "Документов пока нет",
    text: "Здесь появятся выписки, отчётность и договоры, которые вы загрузите в заявке. Показатели из них мы распознаём автоматически.",
    cta: "Начать заявку",
    icon: FolderOpen,
  },
  filter: {
    title: "В этом разделе пусто",
    text: "Заявок с таким статусом нет. Попробуйте другой фильтр или оформите новую заявку.",
    cta: "Новая заявка",
    icon: Sparkles,
  },
};

const QUICK = [
  { code: "cash_gap", title: "Кассовый разрыв", icon: Clock },
  { code: "working_capital", title: "Оборотные средства", icon: Wallet },
  { code: "equipment", title: "Оборудование", icon: Factory },
];

/** Пустое состояние раздела: живая иллюстрация, заголовок и сразу действие. */
export default function EmptyState({ kind, compact = false }: { kind: Kind; compact?: boolean }) {
  const c = COPY[kind];
  const Icon = c.icon;
  return (
    <motion.section
      className={"es" + (compact ? " es-compact" : "")}
      role="status"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {!compact && (
        <div className="es-particles" aria-hidden="true">
          <Particles particleCount={70} particleSpread={9} speed={0.06} particleColors={["#ef3124", "#ff8a80", "#c9cbd1"]} particleBaseSize={70} alphaParticles moveParticlesOnHover particleHoverFactor={0.4} disableRotation={false} />
        </div>
      )}
      <div className="es-art" aria-hidden="true">
        <span className="es-ring r1" />
        <span className="es-ring r2" />
        <motion.div className="es-card back" initial={{ opacity: 0, rotate: 0, x: 0 }} animate={{ opacity: 1, rotate: -8, x: -30 }} transition={{ duration: 0.6, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }} />
        <motion.div className="es-card mid" initial={{ opacity: 0, rotate: 0, x: 0 }} animate={{ opacity: 1, rotate: 6, x: 26 }} transition={{ duration: 0.6, delay: 0.22, ease: [0.2, 0.8, 0.2, 1] }} />
        <motion.div className="es-card front" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}>
          <span className="es-ico"><Icon size={26} /></span>
          <i /><i /><i className="short" />
        </motion.div>
        <motion.span className="es-spark s1" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 }} />
        <motion.span className="es-spark s2" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 }} />
      </div>
      <div className="es-copy">
        <BlurText key={c.title} text={c.title} className="es-title" animateBy="words" direction="bottom" delay={25} stepDuration={0.18} trigger="load" />
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.45 }}>{c.text}</motion.p>
        {c.cta && (
          <motion.div className="es-actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.45 }}>
              <ClickSpark sparkColor={["#ef3124", "#ff8a80"]} sparkCount={10} sparkRadius={26}>
                <Link to="/cabinet/new" className="es-cta">
                  <Zap size={17} />
                  <ShinyText text={c.cta} color="#ffffff" shineColor="#ffd6d2" speed={3} />
                  <ArrowRight size={17} className="es-arrow" />
                </Link>
              </ClickSpark>
            <span className="es-meta">≈ 5 минут · решение до 1 дня</span>
          </motion.div>
        )}
        {!compact && kind !== "filter" && (
          <motion.div className="es-quick" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.07, delayChildren: 0.65 } } }}>
            <small>Частые цели</small>
            <div>
              {QUICK.map((q) => (
                <motion.div key={q.code} variants={{ h: { opacity: 0, y: 8 }, s: { opacity: 1, y: 0 } }}>
                  <Link to={`/cabinet/new?purpose=${q.code}`} className="es-chip"><q.icon size={15} /> {q.title}</Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}
