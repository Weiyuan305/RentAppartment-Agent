import { viewingContactError, viewingRequestBodySchema } from "@/lib/viewing-contact";
import { logAtlasEvent } from "@/lib/atlas-events";
import { errorResponse, identity, privateHeaders, readBody } from "@/lib/agent/http";
import { getDatabase } from "@atlas/database";
import { insertViewingRequest } from "@/lib/viewing-requests";

export async function POST(request: Request) {
  try {
    const auth = await identity(request, true);
    const parsed = viewingRequestBodySchema.safeParse(await readBody(request));
    if (!parsed.success) {
      const contact = parsed.error.issues.find(issue => issue.path[0] === "contact");
      const message = contact && contact.code !== "too_big" ? viewingContactError : "请求参数无效。";
      return Response.json({error: message}, {status: 400, headers: privateHeaders});
    }
    const body = parsed.data;
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
