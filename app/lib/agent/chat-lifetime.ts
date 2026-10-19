import { AsyncLocalStorage } from "node:async_hooks";

// A Durable Object supplies retention; a Node server naturally retains pending I/O.
export const chatLifetime = new AsyncLocalStorage<(task: Promise<void>) => void>();

/** Drain the model stream even if its browser consumer goes away. */
export function detachedReply(response: Response) {
  if (!response.body) return response;
  const reader = response.body.getReader();
  let connected = true;
  const body = new ReadableStream<Uint8Array>({
    start(destination) {
      const task = (async () => {
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            if (connected) destination.enqueue(chunk.value);
          }
          if (connected) destination.close();
        } catch (error) {if (connected) destination.error(error);}
        finally {reader.releaseLock();}
      })();
      chatLifetime.getStore()?.(task);
    },
    cancel() {connected = false;},
  });
  return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
}
