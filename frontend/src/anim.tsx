import gsap from "gsap";
import { RefObject, useLayoutEffect, useRef } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Снимает inline-стили анимации: элемент гарантированно остаётся видимым, даже если анимацию прервали. */

/** Перезапуск CSS-анимации: снимаем класс, форсируем reflow, ставим снова. */
export function replay(el: HTMLElement | null, cls: string, delay = 0) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.style.setProperty("--d", `${delay}s`);
  el.classList.add(cls);
}

/**
 * Плавное появление новых элементов .reveal внутри контейнера.
 * Анимация на CSS-keyframes: всегда доходит до конечного состояния, контент не может «застрять» прозрачным.
 * Уже показанные элементы не анимируются повторно, поэтому обновления данных не вызывают мерцания.
 */
export function useReveal(ref: RefObject<HTMLElement>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal:not([data-shown])"));
    if (root.classList.contains("reveal") && !root.dataset.shown) els.unshift(root);
    els.forEach((e, i) => { e.dataset.shown = "1"; if (!reduced()) replay(e, "anim-in", Math.min(i, 10) * 0.04); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Анимированное число (суммы, баланс, счётчики). */
export function AnimatedNumber({ value, format = (v: number) => Math.round(v).toLocaleString("ru-RU"), duration = 0.9 }: { value: number; format?: (v: number) => string; duration?: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    if (reduced()) { node.textContent = format(value); prev.current = value; return; }
    // анимация продолжается с того числа, что сейчас на экране, — так смена значения
    // посреди анимации (или повторный запуск эффекта в StrictMode) не даёт скачка
    const o = { v: prev.current };
    const t = gsap.to(o, { v: value, duration, ease: "power2.out", onUpdate: () => { prev.current = o.v; node.textContent = format(o.v); } });
    return () => { t.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={el}>{format(prev.current)}</span>;
}

/** Акцентное появление важного блока; элементы .pop-item внутри появляются следом. */
export function usePop(ref: RefObject<HTMLElement>, key: unknown) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced()) return;
    replay(root, "pop-in");
    root.querySelectorAll<HTMLElement>(".pop-item").forEach((e, i) => replay(e, "anim-in", 0.15 + i * 0.05));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Заполнение сегментов прогресс-бара заявки. */
export function useProgressFill(ref: RefObject<HTMLElement>, key: unknown) {
  useLayoutEffect(() => {
    const fills = ref.current?.querySelectorAll<HTMLElement>(".fill[data-on='1']");
    if (!fills?.length) return;
    if (reduced()) { gsap.set(fills, { scaleX: 1 }); return; }
    const t = gsap.to(fills, { scaleX: 1, duration: 0.5, ease: "power2.inOut", stagger: 0.1 });
    return () => { t.progress(1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Переход между шагами мастера: короткий сдвиг по направлению движения. */
export function useStepTransition(ref: RefObject<HTMLElement>, step: number) {
  const prev = useRef(step);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced() || prev.current === step) return;
    const cls = step > prev.current ? "step-in-l" : "step-in-r";
    prev.current = step;
    el.classList.remove("step-in-l", "step-in-r");
    replay(el, cls);
  }, [step]);
}

/** Праздничный эффект одобрения: рисуется галочка, расходятся кольца и конфетти в фирменных цветах. */
export function celebrate(root: HTMLElement) {
  if (reduced()) return;
  const colors = ["#ef3124", "#ffffff", "#0b0b0d", "#ff8a80", "#0aa45a"];
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  root.appendChild(layer);
  const pieces = Array.from({ length: 46 }, (_, i) => {
    const p = document.createElement("i");
    p.style.background = colors[i % colors.length];
    if (i % 3 === 0) p.style.borderRadius = "50%";
    layer.appendChild(p);
    return p;
  });
  const tl = gsap.timeline({ onComplete: () => layer.remove() });
  setTimeout(() => layer.remove(), 3000); // страховка, если вкладка в фоне и кадры не идут
  pieces.forEach((p) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 120 + Math.random() * 220;
    tl.fromTo(p, { x: 0, y: 0, rotate: 0, scale: 0.6 + Math.random() * 0.8, autoAlpha: 1 },
      { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.7 + 140, rotate: Math.random() * 720 - 360, autoAlpha: 0, duration: 1.4 + Math.random() * 0.6, ease: "power3.out" }, 0);
  });
  return tl;
}

export { gsap };
