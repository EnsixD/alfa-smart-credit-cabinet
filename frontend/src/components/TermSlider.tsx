import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import "./TermSlider.css";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Слайдер срока: пружинная ручка, заливка и подсказка со значением во время перетаскивания. */
export default function TermSlider({
  value,
  min,
  max,
  onChange,
  onChangeEnd,
  format = String,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onChangeEnd?: (v: number) => void;
  format?: (v: number) => string;
  label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const frac = (v: number) => (clamp(v, min, max) - min) / (max - min || 1);
  const p = useMotionValue(frac(value));
  const pct = useTransform(p, (x) => `${x * 100}%`);
  const last = useRef(value);

  // внешние изменения (кнопки «1 год», «3 года») — плавно доезжаем пружиной
  useEffect(() => {
    if (drag) return;
    const c = animate(p, frac(value), { type: "spring", stiffness: 260, damping: 30 });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max]);

  const pick = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const f = clamp((clientX - r.left) / r.width, 0, 1);
    const v = Math.round(min + f * (max - min));
    animate(p, (v - min) / (max - min), { type: "spring", stiffness: 700, damping: 45 });
    if (v !== last.current) { last.current = v; onChange(v); }
  };

  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(true);
    last.current = value;
    pick(e.clientX);
  };
  const up = () => { if (!drag) return; setDrag(false); onChangeEnd?.(last.current); };

  const key = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 12, PageDown: -12 }[e.key as string];
    let v: number | undefined = step !== undefined ? value + step : e.key === "Home" ? min : e.key === "End" ? max : undefined;
    if (v === undefined) return;
    e.preventDefault();
    v = clamp(v, min, max);
    if (v !== value) { onChange(v); onChangeEnd?.(v); }
  };

  return (
    <div
      className={"ts" + (drag ? " drag" : "")}
      onPointerDown={down}
      onPointerMove={(e) => drag && pick(e.clientX)}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="ts-track" ref={track}>
        <motion.div className="ts-fill" style={{ width: pct }} />
        <motion.div
          className="ts-thumb"
          style={{ left: pct, x: "-50%", y: "-50%" }}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={format(value)}
          onKeyDown={key}
          animate={{ scale: drag ? 1.18 : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
        >
          <motion.span className="ts-tip" initial={false} animate={{ opacity: drag ? 1 : 0, y: drag ? 0 : 6, scale: drag ? 1 : 0.9 }} transition={{ duration: 0.18 }}>
            {format(value)}
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}
