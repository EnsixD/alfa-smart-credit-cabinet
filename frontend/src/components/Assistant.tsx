import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { gsap } from "../anim";

const SUGGEST = ["Что с моей заявкой?", "Какой кредит подойдёт для закупки?", "Что такое овердрафт?", "Почему предложили другие условия?"];

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([
    { me: false, text: "Здравствуйте! Помогу выбрать кредит, объясню термины и расскажу, что происходит с заявкой." },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("");
  const params = useParams();
  const end = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);
  useLayoutEffect(() => {
    if (open && panel.current) gsap.fromTo(panel.current, { scale: 0.9, autoAlpha: 0, y: 20 }, { scale: 1, autoAlpha: 1, y: 0, duration: 0.35, ease: "back.out(1.4)" });
  }, [open]);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { me: true, text }]);
    setQ("");
    setBusy(true);
    try {
      const id = Number(params.id) || undefined;
      const r = await api("/api/assistant/ask", { body: { question: text, application_id: id } });
      setMode(r.mode);
      setMsgs((m) => [...m, { me: false, text: r.answer }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { me: false, text: "Не получилось ответить: " + e.message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="assistant" ref={panel}>
          <div className="assistant-head">
            <div className="row" style={{ gap: 10 }}>
              <span className="logo-mark" style={{ width: 30, height: 30, fontSize: 16 }}>А</span>
              <div><b>Помощник</b><div className="small" style={{ opacity: .55 }}>{mode.startsWith("llm") ? `ИИ · ${mode.slice(4)}` : "отвечает сразу, 24/7"}</div></div>
            </div>
            <button className="icon-btn" style={{ background: "rgba(255,255,255,.1)", color: "#fff", width: 32, height: 32 }} onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="msgs">
            {msgs.map((m, i) => <div key={i} className={"bubble " + (m.me ? "me" : "bot")}>{m.text}</div>)}
            {busy && <div className="bubble bot typing"><span /><span /><span /></div>}
            <div ref={end} />
          </div>
          <div className="chips">{SUGGEST.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}</div>
          <form className="row" style={{ padding: 12, borderTop: "1px solid var(--line)", flexWrap: "nowrap", gap: 8 }} onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Спросите что-нибудь…" />
            <button className="btn" disabled={busy} style={{ padding: "12px 16px" }}>→</button>
          </form>
        </div>
      )}
      <button className="btn assistant-btn" onClick={() => setOpen(!open)}>{open ? "Свернуть" : "Помощник"}</button>
    </>
  );
}
