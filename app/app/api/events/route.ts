import { z } from "zod";
import { logAtlasEvent } from "@/lib/atlas-events";
import { errorResponse, identity, readBody } from "@/lib/agent/http";

export async function POST(request: Request) {
  try {
    const auth = await identity(request, true);
    const body = z.object({
      name: z.literal("viewing_entry_click"),
      listingId: z.string().min(1).max(80),
      cityId: z.string().min(1).max(40),
      locale: z.enum(["zh", "en"]),
    }).parse(await readBody(request));
    logAtlasEvent(body);
    return Response.json({ok: true}, {headers: auth.headers});
  } catch (error) { return errorResponse(error); }
}
