import { getDatabase } from "@atlas/database";
import { merchantActor, merchantService } from "@/lib/merchant/server";
import { errorResponse, sameOrigin, privateHeaders } from "@/lib/agent/http";
import { SessionError } from "@/lib/agent/store";
import { mediaId } from "@/lib/merchant/model";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const id = mediaId.parse((await params).id),
      db = await getDatabase(),
      r = await db.first<{ merchant: string; mime: string; data: string }>(
        "SELECT merchant,mime,data FROM merchant_media WHERE id=?",
        [id],
      );
    if (!r) throw new SessionError("Photo not found", 404);
    const published = await db.first(
      "SELECT p.id FROM properties p JOIN merchants m ON p.merchant=m.id WHERE m.status='approved' AND p.merchant=? AND p.published LIKE ? LIMIT 1",
      [r.merchant, `%"${id}"%`],
    );
    if (!published) {
      const actor = await merchantActor(request),
        m = await (await merchantService()).mine(actor);
      if (!actor.admin && m?.id !== r.merchant)
        throw new SessionError("Photo not found", 404);
    }
    return new Response(Buffer.from(r.data, "base64"), {
      headers: {
        "Content-Type": r.mime,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
        ...privateHeaders,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    const id = mediaId.parse((await params).id),
      actor = await merchantActor(request),
      m = await (await merchantService()).mine(actor),
      db = await getDatabase();
    const result = await db.run(
      "DELETE FROM merchant_media WHERE id=? AND merchant=? AND NOT EXISTS (SELECT id FROM properties WHERE merchant=? AND (draft LIKE ? OR published LIKE ?))",
      [id, m?.id ?? "", m?.id ?? "", `%"${id}"%`, `%"${id}"%`],
    );
    if (!result.changes)
      throw new SessionError(
        "照片已被房源使用，或不存在 / Photo is in use or not found",
        409,
      );
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (e) {
    return errorResponse(e);
  }
}
