import { z } from "zod";
import { cityIdSchema, rentalStateSchema } from "@/lib/agent/contract";
import { validateRentalState } from "@/lib/agent/catalog";
import { agentConfig } from "@/lib/agent/config";
import { identity, errorResponse, readBody } from "@/lib/agent/http";
import { database, saveState, sessionForCity } from "@/lib/agent/store";

export async function GET(request: Request) {
  try {
    const city = cityIdSchema.parse(new URL(request.url).searchParams.get("city"));
    const auth = await identity(request, true), config = agentConfig();
    return Response.json({session: await sessionForCity(auth.owner, city), status: {configured: config.configured, missing: config.missing, storage: `${(await database()).kind} · 持久存储`}}, {headers: auth.headers});
  } catch (error) {return errorResponse(error);}
}
export async function PATCH(request: Request) {
  try {
    const auth = await identity(request);
    const body = z.object({sessionId: z.string().uuid(), version: z.number().int().nonnegative(), state: rentalStateSchema, clear: z.boolean().optional()}).parse(await readBody(request));
    return Response.json({session: await saveState(auth.owner, body.sessionId, body.version, validateRentalState(body.state), body.clear)}, {headers: auth.headers});
  } catch (error) {return errorResponse(error);}
}
