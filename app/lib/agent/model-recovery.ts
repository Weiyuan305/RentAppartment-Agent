import { APICallError, type LanguageModelMiddleware } from "ai";

type StreamOptions = Parameters<NonNullable<LanguageModelMiddleware["wrapStream"]>>[0];
type ModelPart = Awaited<ReturnType<StreamOptions["model"]["doStream"]>>["stream"] extends ReadableStream<infer P> ? P : never;
export type ModelEvent = {
  phase: "start" | "output" | "completed" | "retry" | "failed";
  step: number;
  attempt: number;
  elapsedMs: number;
  reason?: "timeout" | "network" | "upstream" | "incomplete" | "invalid" | "stopped";
  status?: number;
};

class ModelTimeout extends Error {}
class IncompleteModelStream extends Error {}

function failure(error: unknown): Pick<ModelEvent, "reason" | "status"> {
  if (error instanceof ModelTimeout) return { reason: "timeout" };
  if (error instanceof IncompleteModelStream) return { reason: "incomplete" };
  if (APICallError.isInstance(error)) return { reason: "upstream", status: error.statusCode };
  if (error instanceof TypeError) return { reason: "network" };
  return { reason: "invalid" };
}

// Race the signal too: compatible gateways or stream readers may not reject
// promptly on cancellation. Remove the listener after every read.
function interruptible<T>(value: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(value).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

/** One instance per user turn. Retry only an uncommitted model step, never tools. */
export function modelRecovery({
  onEvent,
  firstOutputMs = 35_000,
  idleMs = 20_000,
  retryDelayMs = 600,
}: {
  onEvent: (event: ModelEvent) => void;
  firstOutputMs?: number;
  idleMs?: number;
  retryDelayMs?: number;
}): LanguageModelMiddleware {
  let stepNumber = 0;
  let retriesLeft = 2;
  return {
    wrapStream: async ({ model, params }) => {
      const step = ++stepNumber;
      const cancelled = new AbortController();
      const parent = params.abortSignal ? AbortSignal.any([params.abortSignal, cancelled.signal]) : cancelled.signal;
      async function* recover(): AsyncGenerator<ModelPart> {
        for (let attempt = 1; attempt <= 2; attempt++) {
          parent.throwIfAborted();
          const started = Date.now();
          const controller = new AbortController();
          const signal = AbortSignal.any([parent, controller.signal]);
          let timer = setTimeout(() => controller.abort(new ModelTimeout()), firstOutputMs);
          let reader: ReadableStreamDefaultReader<ModelPart> | undefined;
          let committed = false;
          let finished = false;
          let buffered: ModelPart[] = [];
          let bufferedBytes = 0;
          let retry = false;
          const emit = (phase: ModelEvent["phase"], detail = {}) => onEvent({ phase, step, attempt, elapsedMs: Date.now() - started, ...detail });
          const resetIdle = () => {
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(new ModelTimeout()), idleMs);
          };
          emit("start");
          try {
            const result = await interruptible(model.doStream({ ...params, abortSignal: signal }), signal);
            reader = result.stream.getReader();
            while (true) {
              const { done, value } = await interruptible(reader.read(), signal);
              if (done) break;
              if (value.type === "error") throw value.error;
              if (value.type === "finish") {
                finished = true;
                if (!committed) throw new IncompleteModelStream();
              }
              // Buffer opening metadata, reasoning and partial tool arguments.
              // Once text or a complete tool call escapes, replay is unsafe.
              const output = (value.type === "text-delta" && value.delta.trim().length > 0) || value.type === "tool-call";
              if (output && !committed) {
                committed = true;
                emit("output");
                resetIdle();
                for (const part of buffered) yield part;
                buffered = [];
              }
              if (committed) {
                if (value.type !== "raw" && value.type !== "response-metadata") resetIdle();
                yield value;
              } else {
                bufferedBytes += JSON.stringify(value).length;
                if (bufferedBytes > 256_000) throw new Error("Model prelude too large");
                buffered.push(value);
              }
            }
            if (!finished) throw new IncompleteModelStream();
            emit("completed");
            return;
          } catch (error) {
            const detail = parent.aborted ? { reason: parent.reason?.name === "TimeoutError" ? "timeout" as const : "stopped" as const } : failure(error);
            const transient = ["timeout", "network", "incomplete"].includes(detail.reason ?? "") ||
              (APICallError.isInstance(error) && (error.isRetryable || error.statusCode === 408));
            retry = !parent.aborted && !committed && transient && attempt === 1 && retriesLeft > 0;
            emit(retry ? "retry" : "failed", detail);
            if (!retry) throw error;
            retriesLeft--;
          } finally {
            clearTimeout(timer);
            controller.abort();
            void reader?.cancel().catch(() => {});
          }
          if (retry) {
            // The delay is abortable, including an explicit Stop during recovery.
            let delay: ReturnType<typeof setTimeout> | undefined;
            try { await interruptible(new Promise<void>(resolve => { delay = setTimeout(resolve, retryDelayMs); }), parent); }
            finally { clearTimeout(delay); }
          }
        }
      }
      const iterator = recover();
      return { stream: new ReadableStream<ModelPart>({
        async pull(controller) {
          try {
            const next = await iterator.next();
            if (next.done) controller.close(); else controller.enqueue(next.value);
          } catch (error) {
            if (!cancelled.signal.aborted) {
              // The SDK may log stream errors. Provider errors can contain
              // request bodies, so expose only our classification, never them.
              if (!parent.aborted) controller.enqueue({type: "error", error: new Error(`Model response unavailable (${failure(error).reason}).`)});
              controller.close();
            }
          }
        },
        cancel() { cancelled.abort(); void iterator.return(undefined); },
      }) };
    },
  };
}
