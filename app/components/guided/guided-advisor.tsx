"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { sessionFetch } from "@/lib/agent/chat-connection";
import { createReplyGate } from "@/lib/agent/chat-reset";
import { initialRentalState, rentalStateSchema, type AgentStatus, type RentalMessage, type RentalSession, type RentalState } from "@/lib/agent/contract";
import { advisorWaitCopy, rephrasePrompts } from "@/lib/guided/decide";

function messageText(message: RentalMessage) {
  return message.parts.flatMap(part => part.type === "text" ? [part.text] : []).join("");
}

export default function GuidedAdvisor({
  state, note, homeCount, mobile, open, onOpen, onAgentState,
}: {
  state: RentalState;
  note: string;
  homeCount: number;
  mobile: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  onAgentState: (state: RentalState) => void;
}) {
  const stateRef = useRef(state);
  const sessionRef = useRef<RentalSession | null>(null);
  const savedRef = useRef("");
  const requestRef = useRef<{ id: string; messageId?: string } | null>(null);
  const gate = useRef(createReplyGate());
  const onAgentRef = useRef(onAgentState);
  stateRef.current = state;
  onAgentRef.current = onAgentState;
  const [session, setSession] = useState<RentalSession | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [transport] = useState(() => new DefaultChatTransport<RentalMessage>({
    api: "/api/agent/chat",
    prepareSendMessagesRequest: ({ messages }) => {
      const current = sessionRef.current;
      const request = requestRef.current;
      if (!current || !request) throw new Error("会话尚未就绪。");
      request.messageId = messages.at(-1)?.id;
      return { body: { sessionId: current.id, version: current.version, state: stateRef.current, requestId: request.id, message: messages.at(-1), locale: "zh" } };
    },
  }));
  const chat = useChat<RentalMessage>({
    transport,
    onData: part => {
      if (part.type !== "data-rental-state") return;
      const next = rentalStateSchema.parse(part.data.state);
      if (sessionRef.current) sessionRef.current = { ...sessionRef.current, version: part.data.version, state: next };
      savedRef.current = JSON.stringify(next);
      if (part.data.phase === "update") onAgentRef.current(next);
    },
    onError: () => setNotice("回复没有完成。可以换个问法，地图仍用已经保存的数字。"),
  });
  const busy = chat.status === "streaming" || chat.status === "submitted" || previewing;
  const chatRef = useRef(chat);
  chatRef.current = chat;

  useEffect(() => {
    let dead = false;
    void sessionFetch("/api/agent/session?city=manchester").then(async response => {
      const payload = await response.json() as { session?: RentalSession; status?: AgentStatus; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error || "会话没有连上。");
      if (dead) return;
      sessionRef.current = payload.session;
      savedRef.current = JSON.stringify(payload.session.state);
      setSession(payload.session);
      setStatus(payload.status ?? null);
      chatRef.current.setMessages(payload.session.messages);
    }).catch(() => { if (!dead) setNotice("顾问会话还没连上。短名单仍然用目录里的数字。"); });
    return () => { dead = true; void chatRef.current.stop(); };
  }, []);

  useEffect(() => {
    if (!session || busy) return;
    const serialized = JSON.stringify(state);
    if (savedRef.current === serialized) return;
    const timer = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || savedRef.current === serialized) return;
      void sessionFetch("/api/agent/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: current.id, version: current.version, state }),
      }).then(async response => {
        const payload = await response.json() as { session?: RentalSession; error?: string };
        if (!response.ok || !payload.session) return;
        sessionRef.current = payload.session;
        savedRef.current = JSON.stringify(payload.session.state);
        setSession(payload.session);
      }).catch(() => {});
    }, 350);
    return () => window.clearTimeout(timer);
  }, [state, session, busy]);

  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const started = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function halt() {
    const current = sessionRef.current;
    const messageId = requestRef.current?.messageId ?? chat.messages.findLast(message => message.role === "user")?.id;
    requestRef.current = null;
    gate.current.reset();
    void chat.stop();
    if (current && messageId) {
      const response = await sessionFetch("/api/agent/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: current.id, messageId }),
      }).catch(() => null);
      if (response?.ok) {
        const payload = await response.json() as { session?: RentalSession };
        if (payload.session) { sessionRef.current = payload.session; setSession(payload.session); }
      }
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !session || !status?.configured) return;
    setNotice("");
    setInput("");
    requestRef.current = { id: crypto.randomUUID() };
    gate.current.open();
    await chat.sendMessage({ text: trimmed, metadata: { context: { cityId: "manchester", listingId: stateRef.current.listingId } } });
  }

  async function preview(action: "commute" | "supermarket") {
    const current = sessionRef.current;
    if (!current || busy) return;
    setPreviewing(true);
    setNotice("");
    try {
      const response = await sessionFetch("/api/agent/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: current.id, version: current.version, state: stateRef.current, locale: "zh", action }),
      });
      const payload = await response.json() as { session?: RentalSession; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error || "工具没有返回。");
      sessionRef.current = payload.session;
      savedRef.current = JSON.stringify(payload.session.state);
      setSession(payload.session);
      chat.setMessages(payload.session.messages);
      onAgentRef.current(payload.session.state);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "工具没有返回。");
    } finally { setPreviewing(false); }
  }

  async function reset() {
    const current = sessionRef.current;
    if (!current) return;
    await halt();
    const fresh = { ...initialRentalState("manchester"), ...stateRef.current, cityId: "manchester" as const };
    const response = await sessionFetch("/api/agent/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: current.id, version: sessionRef.current?.version ?? current.version, state: fresh, clear: true }),
    });
    const payload = await response.json() as { session?: RentalSession };
    if (payload.session) {
      sessionRef.current = payload.session;
      savedRef.current = JSON.stringify(payload.session.state);
      setSession(payload.session);
      chat.setMessages([]);
      setNotice("");
    }
  }

  const expanded = !mobile || open;
  return (
    <aside className={mobile && open ? "gd-advisor is-open" : "gd-advisor"} aria-label="顾问">
      <header>
        <h2 className="gd-17">顾问</h2>
        <button type="button" className="gd-text-button" disabled={!session} onClick={() => void reset()}>重新开始</button>
        {mobile ? <button type="button" className="gd-text-button" onClick={() => onOpen(!open)}>{open ? "收起" : "打开"}</button> : null}
      </header>
      {expanded ? (
        <div className="gd-thread" aria-live="polite">
          {note ? <p className="gd-bubble">{note}</p> : <p className="gd-bubble gd-secondary">点一套房子，我先用目录里写明的数字说明。没写的就是未知。</p>}
          {status && !status.configured ? <p className="gd-13 gd-secondary">模型还没接上。下面两个工具仍用已保存的步行路网和超市快照。</p> : null}
          {status && !status.configured ? (
            <div className="gd-prompts">
              <button type="button" disabled={busy || !session} onClick={() => void preview("commute")}>看步行时间</button>
              <button type="button" disabled={busy || !session} onClick={() => void preview("supermarket")}>看附近超市</button>
            </div>
          ) : null}
          {chat.messages.map(message => {
            const text = messageText(message).trim();
            if (!text) return null;
            return <p key={message.id} className={message.role === "user" ? "gd-bubble user" : "gd-bubble"}>{text}</p>;
          })}
          {busy ? <div className="gd-wait" role="status">{advisorWaitCopy(elapsed, homeCount)} {elapsed} 秒</div> : null}
          {busy && elapsed >= 15 ? (
            <div className="gd-prompts">
              <p className="gd-13">换个问法</p>
              {rephrasePrompts.map(prompt => (
                <button key={prompt} type="button" onClick={() => { void halt(); setInput(prompt); onOpen(true); }}>{prompt}</button>
              ))}
            </div>
          ) : null}
          {notice ? <p className="gd-13">{notice}</p> : null}
        </div>
      ) : null}
      <form className="gd-composer" onSubmit={event => { event.preventDefault(); void send(input); }}>
        <textarea
          value={input}
          rows={1}
          placeholder={note || "问这几套的步行、账单或押金"}
          aria-label="问顾问"
          onFocus={() => onOpen(true)}
          onChange={event => setInput(event.target.value)}
        />
        <button className="gd-send" type="submit" disabled={busy || !input.trim() || !status?.configured} aria-label="发送">发送</button>
      </form>
    </aside>
  );
}
