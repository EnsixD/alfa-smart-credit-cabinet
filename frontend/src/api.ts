const TOKEN_KEY = "cc_token";
const USER_KEY = "cc_user";

export type User = {
  id: number;
  login: string;
  role: "CLIENT" | "UNDERWRITER" | "APPROVER" | "ADMIN";
  full_name: string;
  position: string;
  can_sign: boolean;
  company: any | null;
};

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, { method: opts.method || (body ? "POST" : "GET"), headers, body });
  if (res.status === 401 && token) {
    clearSession();
    window.location.href = "/login";
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail.map((d: any) => d.msg).join("; ") : msg;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg);
  }
  const ct = res.headers.get("content-type") || "";
  return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

/** Подписка на события заявки через SSE: статус меняется в интерфейсе без перезагрузки. */
export function subscribe(appId: number, onEvent: (e: any) => void): () => void {
  const token = getToken();
  if (!token) return () => {};
  const es = new EventSource(`/api/applications/${appId}/stream?token=${encodeURIComponent(token)}`);
  es.addEventListener("update", (ev) => onEvent(JSON.parse((ev as MessageEvent).data)));
  return () => es.close();
}

export const money = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";

export const dt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export const months = (n: number) => {
  const m = n % 10, h = n % 100;
  const w = m === 1 && h !== 11 ? "месяц" : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? "месяца" : "месяцев";
  return `${n} ${w}`;
};

export const DOC_TYPES: Record<string, string> = {
  FIN_STATEMENTS: "Бухгалтерская отчётность",
  BANK_STATEMENT: "Выписка по счёту в другом банке",
  COLLATERAL_DOCS: "Документы на залог",
  TAX_RETURN: "Налоговая декларация",
  OTHER: "Другой документ",
};

export const statusTone = (code: string) =>
  ({
    APPROVED: "ok", DISBURSED: "ok", SIGNING: "ok", DISBURSING: "ok",
    COUNTER_OFFER: "warn", NEEDS_INFO: "warn", MANUAL_REVIEW: "info", ESCALATED: "info",
    REJECTED: "bad", CANCELLED: "muted", DRAFT: "muted",
  } as Record<string, string>)[code] || "info";
