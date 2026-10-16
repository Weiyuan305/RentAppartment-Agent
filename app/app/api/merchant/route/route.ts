import { getPublicCatalogue } from "@/lib/merchant/server";
import { merchantWalkingRoute } from "@/lib/merchant/routes";
import { errorResponse, identity } from "@/lib/agent/http";
import { SessionError, consumeQuota } from "@/lib/agent/store";
export async function GET(request: Request) {
  try {
    const auth = await identity(request, true),
      p = new URL(request.url).searchParams,
      l = (await getPublicCatalogue()).find(
        (l) => l.id === p.get("listing") && l.merchant,
      );
    if (!l) throw new SessionError("房源已下架 / Listing unavailable", 404);
    await consumeQuota(`merchant-route:${auth.owner}`, 20, 60000);
    return Response.json(await merchantWalkingRoute(l, p.get("building")), {
      headers: auth.headers,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
