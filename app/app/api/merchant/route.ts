import { merchantActor, merchantService } from "@/lib/merchant/server";
import { readBody, errorResponse, privateHeaders } from "@/lib/agent/http";
import { consumeQuota } from "@/lib/agent/store";
export async function GET(request: Request) {
  try {
    return Response.json(
      await (
        await merchantService()
      ).dashboard(
        await merchantActor(request),
        new URL(request.url).searchParams.get("mode") ?? "merchant",
      ),
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const body = await readBody(request, 131072),
      actor = await merchantActor(request);
    await consumeQuota(`merchant:${actor.id}`, 60, 60000);
    return Response.json(await (await merchantService()).command(actor, body), {
      headers: privateHeaders,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
