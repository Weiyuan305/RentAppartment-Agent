"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { createReplyGate } from "@/lib/agent/chat-reset";
import { sessionFetch } from "@/lib/agent/chat-connection";
import { initialRentalState, rentalStateSchema, type RentalMessage, type RentalSession, type RentalState } from "@/lib/agent/contract";
import { advisorPendingCopy } from "@/lib/v2/advisor-status";

type Bubble = { id: string; role: "user" | "assistant"; text: string };

export function V2Advisor({ state, uiRevision, homeCount, opening, context, hold, onState, onOptimistic, onBook }: {
  state: RentalState;
  uiRevision: number;
  homeCount: number;
  opening: string;
  context: string | null;
  hold: boolean;
  onState: (state: RentalState) => void;
  onOptimistic: (text: string) => void;
  onBook: () => void;
}) {
  const { locale } = useLocale();
  const lang = locale === "en" ? "en" : "zh";
  const [input, setInput] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([{ id: "opening", role: "assistant", text: opening }]);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastPrompt, setLastPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const sessionRef = useRef<RentalSession | null>(null);
  const gate = useRef(createReplyGate());
  const current = useRef({ state, uiRevision, onState });
  const field = useRef<HTMLTextAreaElement>(null);
  current.current = { state, uiRevision, onState };
  const [transport] = useState(() => new DefaultChatTransport<RentalMessage>({
    api: "/api/agent/chat",
    fetch: sessionFetch,
    prepareSendMessagesRequest: ({ messages }) => {
      const session = sessionRef.current;
      if (!session) throw new Error("session");
      return { body: { sessionId: session.id, version: session.version, state: current.current.state, requestId: crypto.randomUUID(), message: messages.at(-1), locale: lang } };
    },
  }));
  const chat = useChat<RentalMessage>({
    transport,
    onData: (part) => {
      if (part.type !== "data-rental-state") return;
      const parsed = rentalStateSchema.safeParse(part.data.state);
      if (!parsed.success || parsed.data.cityId !== "manchester") return;
      if (sessionRef.current) sessionRef.current = { ...sessionRef.current, version: part.data.version };
      current.current.onState(parsed.data);
    },
  });
  const configured = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void sessionFetch("/api/agent/session?city=manchester").then(async (response) => {
      const payload = await response.json() as { session?: RentalSession; status?: { configured?: boolean } };
      if (cancelled || !response.ok || !payload.session) return;
      sessionRef.current = payload.session;
      configured.current = Boolean(payload.status?.configured);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { setBubbles((items) => [{ id: "opening", role: "assistant", text: opening }, ...items.filter((item) => item.id !== "opening")]); }, [opening]);
  useEffect(() => {
    if (!context) return;
    setBubbles((items) => {
      const rest = items.filter((item) => item.id !== "context");
      return [...rest, { id: "context", role: "assistant", text: context }];
    });
  }, [context]);
  useEffect(() => {
    if (!pendingSince) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pendingSince]);
  useEffect(() => {
    if (!pendingSince || hold) return;
    const last = chat.messages.at(-1);
    const text = last && last.role === "assistant" ? messageText(last) : "";
    if (text.trim()) {
      setBubbles((items) => items.some((item) => item.id === last!.id) ? items : [...items, { id: last!.id, role: "assistant", text }]);
      setPendingSince(null);
    }
  }, [chat.messages, pendingSince, hold]);
  const pending = pendingSince != null ? advisorPendingCopy(Math.floor((now - pendingSince) / 1000), homeCount, lang) : null;
  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pendingSince) return;
    setInput("");
    setLastPrompt(trimmed);
    setNotice("");
    setPendingSince(Date.now());
    setNow(Date.now());
    setBubbles((items) => [...items, { id: `user-${Date.now()}`, role: "user", text: trimmed }]);
    onOptimistic(trimmed);
    if (!sessionRef.current || !configured.current) {
      window.setTimeout(() => {
        if (hold) return;
        setBubbles((items) => [...items, { id: `local-${Date.now()}`, role: "assistant", text: lang === "zh" ? "模型没有连接。地图和条件已经按这句话里能确定的部分更新了。" : "The model is not connected. The map already used what this sentence made clear." }]);
        setPendingSince(null);
      }, 400);
      return;
    }
    try { await chat.sendMessage({ text: trimmed }); }
    catch { setNotice(lang === "zh" ? "回复没有完成。条件已经先标在地图上了。" : "The reply did not finish. The map already shows the conditions."); setPendingSince(null); }
  }
  function rephrase() {
    gate.current.reset();
    void chat.stop();
    setPendingSince(null);
    setInput(lastPrompt);
    field.current?.focus();
  }
  function reset() {
    gate.current.reset();
    void chat.stop();
    setPendingSince(null);
    setInput("");
    setBubbles([{ id: "opening", role: "assistant", text: opening }]);
    const fresh = initialRentalState("manchester");
    onState(fresh);
    const session = sessionRef.current;
    if (!session) return;
    void sessionFetch("/api/agent/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, version: session.version, state: fresh, clear: true }) }).then(async (response) => {
      const payload = await response.json() as { session?: RentalSession };
      if (payload.session) sessionRef.current = payload.session;
    }).catch(() => setNotice(lang === "zh" ? "暂时无法新建对话。" : "Could not start a new chat."));
  }
  return <aside className="v2-advisor" aria-label={lang === "zh" ? "住校顾问" : "Resident advisor"}>
    <header className="v2-advisor-head">
      <div><p>{lang === "zh" ? "住校顾问" : "Resident advisor"}</p><h2>{lang === "zh" ? "先问学校，再看房子" : "Start with where you study"}</h2></div>
      <button type="button" onClick={reset}>{lang === "zh" ? "重新开始" : "Start over"}</button>
    </header>
    <div className="v2-advisor-log">
      {bubbles.map((bubble) => <p key={bubble.id} className={`v2-bubble ${bubble.role}`}>{bubble.text}</p>)}
      {pending ? <div className="v2-pending" data-v2-pending="true" role="status">
        <strong>{pending.stage}</strong>
        <span>{pending.elapsed}</span>
        {pending.rephrase ? <button type="button" onClick={rephrase}>{lang === "zh" ? "换个问法" : "Rephrase"}</button> : null}
      </div> : null}
      {context ? <button type="button" className="v2-context-action" onClick={onBook}>{lang === "zh" ? "看合同要点并预约" : "See the contract and book"}</button> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </div>
    <form className="v2-composer" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
      <label className="sr-only" htmlFor="v2-ask">{lang === "zh" ? "问顾问" : "Ask the advisor"}</label>
      <textarea id="v2-ask" ref={field} rows={1} value={input} placeholder={lang === "zh" ? "预算、通勤，或某套房子" : "Budget, commute, or a home"} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} />
      <button type="submit">{lang === "zh" ? "发送" : "Send"}</button>
    </form>
  </aside>;
}

function messageText(message: RentalMessage) {
  return message.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
}
