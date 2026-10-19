import type { RentalSession } from "./contract";
import { hasReplyText, hasUnfinishedText } from "./conversation";

export class TransportTimeout extends Error {
  constructor() { super("Chat connection timed out"); this.name = "TransportTimeout"; }
}
export function isConnectionFailure(error: unknown) {
  return error instanceof TransportTimeout || error instanceof TypeError;
}

function interruptible<T>(task: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {signal.removeEventListener("abort", abort); reject(signal.reason);};
    signal.addEventListener("abort", abort, {once: true});
    Promise.resolve(task).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

/** Bound headers, stalled reads and total duration, including gateways ignoring abort. */
export async function boundedFetch(input: RequestInfo | URL, init: RequestInit = {}, {
  fetcher = fetch, headersMs = 20_000, idleMs = 40_000, totalMs = 110_000,
}: {fetcher?: typeof fetch; headersMs?: number; idleMs?: number; totalMs?: number} = {}): Promise<Response> {
  const controller = new AbortController();
  const parent = init.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abort, {once: true});
  if (parent?.aborted) abort();
  const expire = () => controller.abort(new TransportTimeout());
  const total = setTimeout(expire, totalMs);
  let idle = setTimeout(expire, headersMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cleanup = () => {clearTimeout(total); clearTimeout(idle); parent?.removeEventListener("abort", abort);};
  try {
    controller.signal.throwIfAborted();
    const response = await interruptible(fetcher(input, {...init, signal: controller.signal}), controller.signal);
    clearTimeout(idle);
    if (!response.body) {cleanup(); return response;}
    reader = response.body.getReader();
    idle = setTimeout(expire, idleMs);
    const stream = new ReadableStream<Uint8Array>({
      async pull(destination) {
        try {
          const item = await interruptible(reader!.read(), controller.signal);
          if (item.done) {cleanup(); destination.close(); return;}
          clearTimeout(idle); idle = setTimeout(expire, idleMs);
          destination.enqueue(item.value);
        } catch (error) {
          cleanup(); controller.abort(error); void reader!.cancel().catch(() => {});
          destination.error(error);
        }
      },
      cancel(reason) {cleanup(); controller.abort(reason); void reader!.cancel().catch(() => {});},
    });
    return new Response(stream, {status: response.status, statusText: response.statusText, headers: response.headers});
  } catch (error) {
    cleanup(); controller.abort(error); void reader?.cancel().catch(() => {}); throw error;
  }
}

export const sessionFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  boundedFetch(input, init, {headersMs: 12_000, idleMs: 12_000, totalMs: 15_000});

type RecoveryResult = {kind: "complete" | "incomplete" | "missing" | "superseded"; session: RentalSession};
/** Classify an already loaded snapshot before starting any recovery timer. */
export function storedReplyResult(session: RentalSession, messageId: string, sessionId: string): RecoveryResult | undefined {
  if (session.id !== sessionId) return {kind: "superseded", session};
  if (session.processingUntil && session.processingUntil > Date.now()) return;
  const index = session.messages.findLastIndex(message => message.role === "user");
  if (session.messages[index]?.id !== messageId) return {kind: session.messages.some(m => m.id === messageId) ? "superseded" : "missing", session};
  const reply = session.messages.slice(index + 1).findLast(m => m.role === "assistant");
  return {kind: reply && !reply.metadata?.replyStatus && !hasUnfinishedText(reply) && hasReplyText(reply) ? "complete" : "incomplete", session};
}
/** Reconcile a disconnected stream through reads only. Never replay map tools or model calls. */
export async function recoverStoredReply({messageId, sessionId, signal: parent, load, timeoutMs = 90_000, intervalMs = 2_000}: {
  messageId: string; sessionId: string; signal: AbortSignal;
  load: (signal: AbortSignal) => Promise<RentalSession>;
  timeoutMs?: number; intervalMs?: number;
}): Promise<RecoveryResult> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent.reason);
  parent.addEventListener("abort", abort, {once: true});
  if (parent.aborted) abort();
  const timer = setTimeout(() => controller.abort(new TransportTimeout()), Math.max(1, timeoutMs));
  try {
    for (;;) {
      controller.signal.throwIfAborted();
      let session: RentalSession | undefined;
      try {session = await interruptible(load(controller.signal), controller.signal);}
      catch (error) {if (controller.signal.aborted || !isConnectionFailure(error)) throw error;}
      if (session) {
        const result = storedReplyResult(session, messageId, sessionId);
        if (result) return result;
      }
      let delay: ReturnType<typeof setTimeout> | undefined;
      try {await interruptible(new Promise<void>(resolve => {delay = setTimeout(resolve, intervalMs);}), controller.signal);}
      finally {clearTimeout(delay);}
    }
  } finally {clearTimeout(timer); parent.removeEventListener("abort", abort);}
}
