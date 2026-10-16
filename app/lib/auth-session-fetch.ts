/** Bound read-only session checks; never replay sign-in, sign-out or linking. */
export function createSessionFetch(
  request: typeof fetch = fetch,
  timeoutMs = 12000,
): typeof fetch {
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    if (
      method.toUpperCase() !== "GET" ||
      new URL(url, "https://local.invalid").pathname !== "/api/auth/get-session"
    )
      return request(input, init);
    const parent =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    for (let attempt = 0; attempt < 2; attempt++) {
      parent?.throwIfAborted();
      const deadline = AbortSignal.timeout(timeoutMs);
      try {
        const response = await request(input, {
          ...init,
          cache: "no-store",
          signal: parent ? AbortSignal.any([parent, deadline]) : deadline,
        });
        if (response.status < 500 || attempt === 1) return response;
        await response.body?.cancel();
      } catch (error) {
        if (parent?.aborted || attempt === 1) throw error;
      }
    }
    throw new Error("Session request failed");
  };
}
