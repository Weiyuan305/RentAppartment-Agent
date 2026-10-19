import { z } from "zod";
import { identity, readBody, errorResponse } from "@/lib/agent/http";
import { stopSession } from "@/lib/agent/store";

export async function POST(request: Request) {
  try {
    const auth = await identity(request);
    const body = z.object({sessionId: z.string().uuid(), messageId: z.string().min(1).max(100)}).parse(await readBody(request));
    return Response.json({session: await stopSession(auth.owner, body.sessionId, body.messageId)}, {headers: auth.headers});
  } catch (error) {return errorResponse(error);}
}
