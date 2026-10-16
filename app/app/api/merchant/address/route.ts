import { getDatabase } from "@atlas/database";
import { merchantActor, merchantService } from "@/lib/merchant/server";
import { readBody, privateHeaders, errorResponse } from "@/lib/agent/http";
import { SessionError } from "@/lib/agent/store";
import { createAddressSearch } from "@/lib/merchant/geocoding";

export async function POST(request: Request) {
  try {
    const body = await readBody(request, 4096),
      actor = await merchantActor(request);
    if ((await (await merchantService()).mine(actor))?.status !== "approved")
      throw new SessionError(
        "请先完成商家入驻 / Merchant approval required",
        403,
      );
    return Response.json(
      await createAddressSearch(await getDatabase())(body, actor.id),
      { headers: privateHeaders },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
