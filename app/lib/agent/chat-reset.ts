export type ReplyRun = {generation: number; signal: AbortSignal};

/**
 * One in-flight assistant reply. Start over aborts that run and drops any
 * chunks that arrive after the generation changes.
 */
export function createReplyGate() {
  let generation = 0;
  let controller: AbortController | null = null;
  return {
    generation: () => generation,
    open(): ReplyRun {
      controller?.abort();
      controller = new AbortController();
      generation += 1;
      const signal = controller.signal;
      return {generation, signal};
    },
    reset() {
      generation += 1;
      controller?.abort();
      controller = null;
      return generation;
    },
    accept(run: ReplyRun) {
      return run.generation === generation && !run.signal.aborted;
    },
    guard(run: ReplyRun, response: Response) {
      if (!response.body) return response;
      const reader = response.body.getReader();
      const generationAtStart = run.generation;
      const stream = new ReadableStream<Uint8Array>({
        async pull(out) {
          if (generationAtStart !== generation || run.signal.aborted) {
            out.close();
            await reader.cancel().catch(() => {});
            return;
          }
          try {
            const next = await reader.read();
            if (generationAtStart !== generation || run.signal.aborted) {
              out.close();
              await reader.cancel().catch(() => {});
              return;
            }
            if (next.done) out.close();
            else out.enqueue(next.value);
          } catch (error) {
            if (generationAtStart !== generation || run.signal.aborted) {
              out.close();
              await reader.cancel().catch(() => {});
              return;
            }
            out.error(error);
          }
        },
        cancel(reason) {
          return reader.cancel(reason);
        },
      });
      return new Response(stream, {status: response.status, statusText: response.statusText, headers: response.headers});
    },
  };
}
