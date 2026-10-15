"use client";
import { useLocale } from "@/components/locale-provider";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowRight, ArrowUp, LoaderCircle, Sparkles, Square, RotateCcw } from "lucide-react";
import { type AgentStatus, type RentalMessage, type RentalSession, type RentalState, rentalStateSchema } from "@/lib/agent/contract";
import {canRestoreSessionContext,stateForNavigation} from "@/lib/student/restore";
import { replyNotices, retryableMessage } from "@/lib/agent/conversation";
import { displayCity } from "@/lib/i18n";
import type { City } from "@/lib/rental-data";
const AssistantMarkdown = lazy(() => import("./assistant-markdown").then(module => ({default: module.AssistantMarkdown})));

export default function RentalChat({city, state, uiRevision, onState, collapsed = false, headerControl, onReplyReady, preserveInitialState = false, actionReceipt, onActionClear}: {actionReceipt?: ReactNode; onActionClear?:()=>void; preserveInitialState?: boolean; collapsed?: boolean; headerControl?: ReactNode; onReplyReady?: () => void; city: City; state: RentalState; uiRevision: number; onState: (state: RentalState, actionId?: string) => void}) {
  const {t, locale} = useLocale();
  const [session, setSession] = useState<RentalSession | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [notice, setNotice] = useState("");
  const [input, setInput] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const followEnd = useRef(true);
  const current = useRef({state, uiRevision, onState, locale, onReplyReady, preserveInitialState});
  useEffect(() => {current.current = {state, uiRevision, onState, locale, onReplyReady, preserveInitialState};}, [state, uiRevision, onState, locale, onReplyReady, preserveInitialState]);
  const sessionRef = useRef<RentalSession | null>(null);
  const request = useRef<{id: string; revision: number; retry?: boolean} | null>(null);
  const savedState = useRef("");
  const pendingSave = useRef<Promise<void>>(Promise.resolve());
  const disposed = useRef(false);
  // The SDK invokes this callback only when sending, never in the constructor.
  // eslint-disable-next-line react-hooks/refs
  const [transport] = useState(() => new DefaultChatTransport<RentalMessage>({
    api: "/api/agent/chat",
    prepareSendMessagesRequest: ({messages}) => {
      const s = sessionRef.current;
      if (!s || !request.current) throw new Error(t("会话尚未就绪。"));
      return {body: {sessionId: s.id, version: s.version, state: current.current.state, requestId: request.current.id, message: messages.at(-1), locale:current.current.locale, retry: request.current.retry}};
    },
  }));
  const chat = useChat<RentalMessage>({
    transport,
    onData: part => {
      if (part.type !== "data-rental-state" || disposed.current) return;
      const data = part.data, active = request.current;
      if (!active || data.requestId !== active.id || data.state.cityId !== current.current.state.cityId) return;
      if (sessionRef.current) sessionRef.current = {...sessionRef.current, version: data.version};
      if (active.revision !== current.current.uiRevision) {setNotice("页面条件已改变，本轮结果没有覆盖地图。请按当前条件重新提问。"); return;}
      const next = rentalStateSchema.parse(data.state);
      savedState.current = JSON.stringify(next);
      if (data.phase === "start") return;
      current.current.onState(next,active.id);
    },
    onError: error => {if (!disposed.current) {setNotice(Object.values(replyNotices).includes(error.message) ? error.message : t("对话暂时无法完成，可以重试这条消息；已完成的工具结果会保留。"));current.current.onReplyReady?.();}},
    onFinish: ({isAbort}) => {if (!disposed.current) {if(isAbort)setNotice(replyNotices.stopped);else current.current.onReplyReady?.();}},
  });
  const {setMessages, stop} = chat;
  const busy = chat.status === "streaming" || chat.status === "submitted" || previewing || retrying;
  const retryMessage = retryableMessage(chat.messages) || (chat.error || notice === replyNotices.stopped ? chat.messages.findLast(message => message.role === "user") : undefined);
  const replyStatus = chat.messages.at(-1)?.metadata?.replyStatus;
  const displayedNotice = notice || (!busy && retryMessage ? replyStatus ? replyNotices[replyStatus] : t("上次回复未完成，可以重试这条消息。") : "");
  useEffect(() => {
    const field = composer.current;
    if (!field) return;
    const resize = () => {
      if (!field.clientWidth) return;
      field.style.height = "auto";
      // An empty field stays one line even when its placeholder wraps.
      if (field.value) field.style.height = `${field.scrollHeight}px`;
    };
    resize();
    let previousWidth = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === previousWidth) return;
      previousWidth = field.clientWidth;
      resize();
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, [input]);
  useEffect(() => {
    disposed.current = false;
    const controller = new AbortController();
    const startRevision = current.current.uiRevision;
    void (async () => {
      try {
        const response = await fetch(`/api/agent/session?city=${city.id}`, {signal: controller.signal});
        const payload = await response.json() as {session: RentalSession; status: AgentStatus; error?: string};
        if (!response.ok) throw new Error(payload.error);
        if (controller.signal.aborted) return;
        const restored = payload.session as RentalSession;
        const restoreContext=canRestoreSessionContext(startRevision,current.current.uiRevision,current.current.preserveInitialState);
        sessionRef.current = restored; setSession(restored); setAgentStatus(payload.status); setMessages(restored.messages);
        savedState.current=JSON.stringify(restored.state);
        if(restoreContext)current.current.onState(stateForNavigation(restored.state,current.current.state,new URLSearchParams(window.location.search)));
      } catch {if (!controller.signal.aborted) setNotice("会话存储暂时不可用，请刷新页面重试。");}
    })();
    return () => {disposed.current = true; controller.abort(); void stop();};
  }, [city.id, setMessages, stop]);
  useEffect(() => {
    const scroller = end.current?.closest<HTMLElement>(".chat-scroll");
    if (!collapsed && followEnd.current && scroller) scroller.scrollTo({top:scroller.scrollHeight,behavior:"instant"});
  }, [chat.messages, busy, collapsed]);
  useEffect(() => {
    const content=transcript.current,scroller=content?.parentElement;
    if(!content||!scroller)return;
    let lastTop=scroller.scrollTop;
    const onScroll=()=>{
      const top=scroller.scrollTop;
      if(scroller.scrollHeight-scroller.clientHeight-top<=24)followEnd.current=true;
      else if(top<lastTop)followEnd.current=false;
      lastTop=top;
    };
    let frame=0;
    // Markdown is lazy-loaded and may grow after the messages effect has run.
    // Follow that growth only while the reader is already at the latest reply.
    const observer=new ResizeObserver(()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{if(!collapsed&&followEnd.current)scroller.scrollTo({top:scroller.scrollHeight,behavior:"instant"});});
    });
    observer.observe(content);observer.observe(scroller);
    scroller.addEventListener("scroll",onScroll,{passive:true});
    return()=>{observer.disconnect();cancelAnimationFrame(frame);scroller.removeEventListener("scroll",onScroll);};
  },[collapsed]);

  // Persist manual map/filter changes too, after a short debounce. Never race a turn.
  useEffect(() => {
    if (!session || busy || savedState.current === JSON.stringify(state)) return;
    const timer = setTimeout(() => {
      pendingSave.current = pendingSave.current.then(async () => {
        const s = sessionRef.current;
        if (!s || disposed.current) return;
        const next = current.current.state;
        try {
          const response = await fetch("/api/agent/session", {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({sessionId: s.id, version: s.version, state: next})});
          const payload = await response.json() as {session: RentalSession; status: AgentStatus; error?: string};
          if (!response.ok) throw new Error(payload.error);
          sessionRef.current = payload.session;
          savedState.current = JSON.stringify(next);
        } catch {if (!disposed.current) setNotice("页面状态尚未保存；若其他页面也打开了此会话，请刷新同步。");}
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [state, session, busy]);

  async function send(text: string) {
    if (!text.trim() || busy || !session || !agentStatus?.configured) return;
    followEnd.current=true;
    await pendingSave.current;
    onActionClear?.();
    request.current = {id: crypto.randomUUID(), revision: current.current.uiRevision};
    setInput(""); setNotice(""); chat.clearError();
    await chat.sendMessage({text: text.trim()});
  }
  async function retry() {
    if (busy || !session || !agentStatus?.configured || !retryMessage) return;
    followEnd.current=true;
    onActionClear?.();
    setRetrying(true); setNotice("");
    await pendingSave.current;
    try {
      // Refresh the version and lease after an errored/disconnected stream.
      const response = await fetch(`/api/agent/session?city=${city.id}`);
      const payload = await response.json() as {session: RentalSession; error?: string};
      if (!response.ok) throw new Error(payload.error);
      if (disposed.current) return;
      const lastUser = payload.session.messages.findLast(message => message.role === "user");
      if (lastUser && lastUser.id !== retryMessage.id && !chat.messages.some(message => message.id === lastUser.id)) throw new Error(t("会话已在其他页面更新，请刷新同步。"));
      sessionRef.current = payload.session;
      // A transport failure before persistence still needs a normal first send.
      const alreadySaved = lastUser?.id === retryMessage.id;
      setMessages(alreadySaved ? payload.session.messages : [...payload.session.messages, retryMessage]);
      request.current = {id: crypto.randomUUID(), revision: current.current.uiRevision, retry: alreadySaved};
      chat.clearError(); setRetrying(false);
      await chat.regenerate({messageId: retryMessage.id});
    } catch {if (!disposed.current) setNotice("暂时无法重试，请稍后再试或刷新同步会话。");}
    finally {if (!disposed.current) setRetrying(false);}
  }
  async function preview(action: string) {
    if (busy || !session) return;
    followEnd.current=true;
    onActionClear?.();
    setPreviewing(true); setNotice("");
    await pendingSave.current;
    const s = sessionRef.current!, revision = current.current.uiRevision;
    try {
      const response = await fetch("/api/agent/preview", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({sessionId: s.id, version: s.version, state: current.current.state, locale:current.current.locale, action})});
      const payload = await response.json() as {session: RentalSession; status: AgentStatus; error?: string};
      if (!response.ok) {
        // A failed tool still releases the lease and advances the version.
        const latest = await fetch(`/api/agent/session?city=${city.id}`).then(r => r.json()) as {session?: RentalSession};
        if (!disposed.current && latest.session) sessionRef.current = latest.session;
        throw new Error(payload.error);
      }
      if (disposed.current) return;
      sessionRef.current = payload.session; setMessages(payload.session.messages);
      if (revision === current.current.uiRevision) {savedState.current = JSON.stringify(payload.session.state); current.current.onState(payload.session.state,crypto.randomUUID());}
      else setNotice("页面条件已改变，工具结果没有覆盖当前地图。");
    } catch (error) {if (!disposed.current) setNotice(error instanceof Error ? error.message : t("工具暂时不可用。"));}
    finally {if (!disposed.current) {setPreviewing(false);current.current.onReplyReady?.();}}
  }
  async function reset() {
    if (!session || busy) return;
    followEnd.current=true;
    await pendingSave.current;
    const s = sessionRef.current!;
    try {
      const response = await fetch("/api/agent/session", {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({sessionId: s.id, version: s.version, state: current.current.state, clear: true})});
      const payload = await response.json() as {session: RentalSession; status: AgentStatus; error?: string}; if (!response.ok) throw new Error(payload.error);
      sessionRef.current = payload.session; onActionClear?.(); setMessages([]); setNotice(""); chat.clearError();
    } catch {setNotice("暂时无法新建对话，请刷新重试。");}
  }
  return <aside id="workspace-chat" className="assistant-panel" inert={collapsed} aria-label={t("找房助手")}>
    <div className="assistant-heading">
      <span className="assistant-icon"><Sparkles size={20}/></span>
      <div className="assistant-heading-copy"><h2>{t("你的找房搭子")}</h2><p title={session ? t("会话保存在服务器") : t("正在连接会话…")}>{session ? (locale === "zh" ? "云端会话" : "Cloud conversation") : t("正在连接会话…")}</p></div>
      <span className={`assistant-state ${agentStatus?.configured ? "ready" : ""}`}>{agentStatus?.configured ? t("AI 已配置") : t("工具体验")}</span>
      <div className="panel-heading-actions" role="group" aria-label={locale === "zh" ? "对话操作" : "Chat actions"}>
        <button className="chat-reset" title={t("新建对话")} aria-label={t("新建对话")} disabled={busy || !session} onClick={reset}><RotateCcw size={18}/></button>
        {headerControl}
      </div>
    </div>
    <div className="chat-scroll" aria-live="polite"><div className="chat-transcript" ref={transcript}>
      {!chat.messages.length && <><div className="welcome"><h2>{t("从日常出发，")}<br/>{t("找到合适的新家。")}</h2><p>{t("当前以选中公寓为起点。可以问附近设施、筛选房源，再追问步行路线。")}</p></div><div className="chat-message assistant">{t("你好，未来的{city}同学 👋",{city:displayCity(city,locale).name})}<br/>{t("附近默认是距选中公寓直线 500 米，地点来自校区周边快照。")}</div></>}
      {agentStatus?.configured ? <div className="suggestions">{[t("这套公寓附近500米内有几个便利店？"), t("只显示最近的一家"), t("走过去怎么走？"), t("换成附近的超市"), t("筛选大学步行30分钟内的房源")].map(text => <button key={text} disabled={busy || !session} onClick={() => send(text)}>{text}<ArrowRight size={15}/></button>)}</div> : <div className="agent-setup"><strong>{t("AI 模型待配置")}</strong><p>{t("请在服务器填写 Base URL、模型名称与密钥，并重启服务。以下按钮可先体验真实工具和地图联动。")}</p><a href="/setup#agent" target="_blank" rel="noreferrer">{t("查看模型接入说明 ↗")}</a><div className="suggestions">{[["nearby", t("查询500米内便利店")], ["nearest", t("只显示最近一家")], ["route", t("显示步行路线")], ["supermarket", t("换成附近超市")], ["commute", t("显示到大学路线")]].map(([action, label]) => <button key={action} disabled={busy || !session} onClick={() => preview(action)}>{label}<ArrowRight size={15}/></button>)}</div></div>}
      {chat.messages.map(message => <div key={message.id} className={`chat-message ${message.role}`}>{message.parts.map((part, i) => part.type === "text" && part.text ? message.role === "assistant"
        ? <Suspense key={i} fallback={<span aria-label={t("正在加载回复")}>…</span>}><AssistantMarkdown text={part.text} streaming={chat.status === "streaming" && part.state === "streaming"}/></Suspense>
        : <span key={i}>{part.text}</span> : null)}{message.parts.some(p => p.type.startsWith("tool-") && "state" in p && p.state === "output-available") && <small className="chat-tool-status">{t("已查询工具 · 地图与结果同步")}</small>}</div>)}
      <fieldset className="agent-receipt-slot" disabled={busy}>{actionReceipt}</fieldset>
      {busy && <p className="chat-busy"><LoaderCircle size={14} className="route-spinner"/>{retrying ? t("正在重新连接…") : previewing ? t("正在查询工具…") : t("正在查找并回复…")}</p>}
      {displayedNotice && <div className="chat-notice" role="status"><p>{t(displayedNotice)}</p>{!busy && retryMessage && <button type="button" className="chat-retry" onClick={() => void retry()}><RotateCcw size={13}/>{t("重试这条消息")}</button>}</div>}<div ref={end}/>
    </div></div>
    <form className="chat-form" onSubmit={e => {e.preventDefault(); void send(input);}}>
      <label className="sr-only" htmlFor="chat-input">{t("描述你的理想住处")}</label>
      <div className="chat-composer">
        <textarea ref={composer} id="chat-input" value={input} onChange={e => setInput(e.target.value)} disabled={!agentStatus?.configured || !session} placeholder={agentStatus?.configured ? (locale === "zh" ? "问问附近，或说说需求…" : "Ask about homes or nearby…") : t("配置模型后，即可开始多轮 AI 对话")} maxLength={2000} onKeyDown={e => {if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {e.preventDefault(); void send(input);}}} rows={1}/>
        {busy && !previewing ? <button type="button" aria-label={t("停止回复")} onClick={() => stop()}><Square size={14}/></button> : <button type="submit" disabled={!input.trim() || busy || !agentStatus?.configured || !session} aria-label={t("发送消息")}><ArrowUp size={19}/></button>}
      </div>
    </form>
    <p className="assistant-disclaimer">{t("演示房源不可预订 · 设施可能缺漏 · 治安与营业状态未核验")}</p>
  </aside>;
}
