import handler from "vinext/server/fetch-handler";

const worker = {
  fetch(request: Request, env: {ASSETS: {fetch(request: Request): Promise<Response>}}, ctx: ExecutionContext) {
    // Service-binding calls must be able to obtain the assets belonging to this
    // exact Worker release, without falling through to an HTML not-found page.
    if (new URL(request.url).pathname.startsWith("/_next/static/") && ["GET", "HEAD"].includes(request.method)) {
      return env.ASSETS.fetch(request);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
