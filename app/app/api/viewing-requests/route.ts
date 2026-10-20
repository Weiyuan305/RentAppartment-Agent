import { z } from "zod";
import { logAtlasEvent } from "@/lib/atlas-events";
import { errorResponse, identity, readBody } from "@/lib/agent/http";
import { getDatabase } from "@atlas/database";
import { insertViewingRequest } from "@/lib/viewing-requests";

export async function POST(request: Request) {
  try {
    const auth = await identity(request, true);
    const body = z.object({
      listingId: z.string().trim().min(1).max(80),
      cityId: z.string().trim().min(1).max(40),
      name: z.string().trim().min(1).max(80),
      contact: z.string().trim().min(1).max(120),
      preferredTime: z.string().trim().min(1).max(120),
      message: z.string().trim().max(500).optional().default(""),
    }).parse(await readBody(request));
    const saved = await insertViewingRequest(await getDatabase(), {
      owner: auth.owner,
      listingId: body.listingId,
      cityId: body.cityId,
      name: body.name,
      contact: body.contact,
      preferredTime: body.preferredTime,
      message: body.message,
    });
    logAtlasEvent({name: "viewing_request_recorded", listingId: body.listingId, cityId: body.cityId});
    return Response.json({ok: true, id: saved.id, demo: true}, {headers: auth.headers});
  } catch (error) { return errorResponse(error); }
}
