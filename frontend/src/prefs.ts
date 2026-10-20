/** Настройки интерфейса этого браузера (на сервере не хранятся). */
export type Prefs = { toasts: boolean; reduceMotion: boolean };
const KEY = "ui-prefs";
const DEFAULTS: Prefs = { toasts: true, reduceMotion: false };

export function getPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* без хранилища настройка действует до перезагрузки */
  }
  window.dispatchEvent(new CustomEvent("ui-prefs", { detail: next }));
  return next;
}
