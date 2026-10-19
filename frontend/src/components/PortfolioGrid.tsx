import { useEffect, useRef } from "react";

const CELL = 56;
const WAVELENGTH = CELL * 6.5;
const CYCLE = 3.4;
const CREST = 0.3;
const SOURCES = [
  { cx: 0.24, cy: 0.3, ax: 0.1, ay: 0.14, sp: 0.07, ph: 0 },
  { cx: 0.78, cy: 0.68, ax: 0.12, ay: 0.1, sp: -0.055, ph: 2.2 },
];
type Cell = { x: number; y: number; fade: number };
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Adapted from Ensi - Portfolio v2/src/Background.tsx: the same travelling
 * interference crests, with red squares and container sizing. No pointer input. */
export default function PortfolioGrid({
  bright = false,
}: {
  bright?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      raf = 0,
      visible = true;
    let cells: Cell[] = [];
    const intensity = bright ? 1.4 : 1;
    const draw = (now: number) => {
      const t = media.matches ? 0 : now / 1000;
      const sources = SOURCES.map((s) => ({
        x: width * (s.cx + s.ax * Math.cos(t * s.sp + s.ph)),
        y: height * (s.cy + s.ay * Math.sin(t * s.sp * 1.4 + s.ph)),
      }));
      ctx.clearRect(0, 0, width, height);
      for (const c of cells) {
        let v = 0;
        for (const source of sources) {
          const d = Math.hypot(c.x - source.x, c.y - source.y);
          const p = (((d / WAVELENGTH - t / CYCLE) % 1) + 1) % 1;
          if (p < CREST) v += Math.sin(smooth(p / CREST) * Math.PI);
        }
        ctx.strokeStyle = `rgba(218,65,52,${0.105 * c.fade * intensity})`;
        ctx.strokeRect(
          c.x - CELL / 2 + 0.5,
          c.y - CELL / 2 + 0.5,
          CELL - 1,
          CELL - 1,
        );
        if (v < 0.02) continue;
        const k = Math.min(1, v / 1.6);
        const size = (CELL - 1) * (0.12 + 0.88 * k);
        ctx.fillStyle = `rgba(246,51,36,${(0.06 + 0.27 * k) * c.fade * intensity})`;
        ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
      }
    };
    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw(now);
      if (!media.matches) raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && visible && !document.hidden) {
        draw(performance.now());
        if (!media.matches) raf = requestAnimationFrame(loop);
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (!width || !height) return;
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 1;
      const cols = Math.ceil(width / CELL) + 1,
        rows = Math.ceil(height / CELL) + 1;
      const x0 = (width - cols * CELL) / 2 + CELL / 2,
        y0 = (height - rows * CELL) / 2 + CELL / 2;
      const max = Math.hypot(width / 2, height / 2) || 1;
      cells = [];
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const x = x0 + col * CELL,
            y = y0 + row * CELL;
          const fade = Math.max(
            0,
            1 - (Math.hypot(x - width / 2, y - height / 2) / max) * 0.85,
          );
          if (fade > 0) cells.push({ x, y, fade });
        }
      wake();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    intersection.observe(canvas);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else wake();
    };
    const onMotion = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    media.addEventListener("change", onMotion);
    resize();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", onMotion);
    };
  }, [bright]);
  return <canvas className="vf-portfolio-grid" ref={ref} aria-hidden="true" />;
}
