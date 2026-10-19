import gsap from "gsap";
import { RefObject, useLayoutEffect, useRef } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Плавное появление элементов с классом .reveal внутри контейнера.
 * Анимируются только новые элементы, поэтому при обновлении данных (SSE, опрос)
 * уже показанное не «прыгает».
 */
export function useReveal(ref: RefObject<HTMLElement>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal:not([data-shown])"));
    if (root.classList.contains("reveal") && !root.dataset.shown) els.unshift(root);
    if (!els.length) return;
    els.forEach((e) => (e.dataset.shown = "1"));
    if (reduced()) return;
    const tween = gsap.fromTo(els, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", stagger: 0.05, clearProps: "transform" });
    return () => { tween.progress(1); };
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
    const o = { v: prev.current };
    const t = gsap.to(o, { v: value, duration, ease: "power2.out", onUpdate: () => { node.textContent = format(o.v); } });
    prev.current = value;
    return () => { t.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span ref={el}>{format(prev.current)}</span>;
}

/** Акцентное появление важного блока (решение банка, деньги зачислены). */
export function usePop(ref: RefObject<HTMLElement>, key: unknown) {
  useLayoutEffect(() => {
    if (!ref.current || reduced()) return;
    const t = gsap.timeline();
    t.fromTo(ref.current, { scale: 0.96, autoAlpha: 0, y: 12 }, { scale: 1, autoAlpha: 1, y: 0, duration: 0.55, ease: "back.out(1.6)" });
    const items = ref.current.querySelectorAll(".pop-item");
    if (items.length) t.fromTo(items, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.35, ease: "power2.out" }, "-=0.25");
    return () => { t.progress(1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Заполнение сегментов прогресс-бара заявки. */
export function useProgressFill(ref: RefObject<HTMLElement>, key: unknown) {
  useLayoutEffect(() => {
    const fills = ref.current?.querySelectorAll<HTMLElement>(".fill[data-on='1']");
    if (!fills?.length) return;
    if (reduced()) { gsap.set(fills, { scaleX: 1 }); return; }
    const t = gsap.to(fills, { scaleX: 1, duration: 0.5, ease: "power2.inOut", stagger: 0.12 });
    return () => { t.progress(1); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Переход между шагами мастера. */
export function useStepTransition(ref: RefObject<HTMLElement>, step: number) {
  const prev = useRef(step);
  useLayoutEffect(() => {
    if (!ref.current || reduced()) return;
    const dir = step >= prev.current ? 1 : -1;
    prev.current = step;
    const t = gsap.fromTo(ref.current, { x: 28 * dir, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out", clearProps: "transform" });
    return () => { t.progress(1); };
  }, [step]);
}

export { gsap };
