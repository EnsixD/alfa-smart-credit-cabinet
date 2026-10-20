import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App";
import { getPrefs } from "./prefs";

/** Режим анимаций берётся из системы, а в настройках кабинета его можно упростить вручную. */
function Root() {
  const [reduce, setReduce] = useState(getPrefs().reduceMotion);
  useEffect(() => {
    const h = (e: Event) => setReduce((e as CustomEvent).detail.reduceMotion);
    window.addEventListener("ui-prefs", h);
    return () => window.removeEventListener("ui-prefs", h);
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", reduce); }, [reduce]);
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <App />
    </MotionConfig>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
