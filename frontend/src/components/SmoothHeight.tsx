import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export default function SmoothHeight({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setHeight(node.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ height }}
      transition={{ duration: reduce ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: "hidden" }}
    >
      <div className="vf-height-content" ref={ref}>
        {children}
      </div>
    </motion.div>
  );
}
