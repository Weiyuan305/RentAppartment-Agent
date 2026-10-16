import { randomUUID } from "node:crypto";
import { getDatabase } from "@atlas/database";
import { merchantActor, merchantService } from "@/lib/merchant/server";
import { sameOrigin, errorResponse, privateHeaders } from "@/lib/agent/http";
import { consumeQuota, SessionError } from "@/lib/agent/store";
export async function GET(request: Request) {
  try {
    const actor = await merchantActor(request),
      m = await (await merchantService()).mine(actor);
    if (!m) throw new SessionError("Merchant not found", 404);
    const items = await (
      await getDatabase()
    ).all(
      "SELECT a.id,a.size,EXISTS(SELECT 1 FROM properties p WHERE p.merchant=a.merchant AND (p.draft LIKE '%\"'||a.id||'\"%' OR p.published LIKE '%\"'||a.id||'\"%')) AS used FROM merchant_media a WHERE a.merchant=? ORDER BY a.created DESC",
      [m.id],
    );
    return Response.json({ items }, { headers: privateHeaders });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const actor = await merchantActor(request),
      m = await (await merchantService()).mine(actor);
    if (m?.status !== "approved")
      throw new SessionError(
        "需要已通过审核的商家账号 / Approved merchant required",
        403,
      );
    await consumeQuota(`media:${actor.id}`, 30, 60000);
    const limit = 250 * 1024,
      reader = request.body?.getReader();
    if (!reader || Number(request.headers.get("content-length")) > limit)
      throw new SessionError("图片不可超过 250 KB / Maximum 250 KB", 413);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new SessionError("图片不可超过 250 KB / Maximum 250 KB", 413);
      }
      chunks.push(value);
    }
    const data = Buffer.concat(chunks),
      mime =
        data[0] === 255 && data[1] === 216 && data[2] === 255
          ? "image/jpeg"
          : data
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            ? "image/png"
            : data.toString("ascii", 0, 4) === "RIFF" &&
                data.toString("ascii", 8, 12) === "WEBP"
              ? "image/webp"
              : null;
    if (!mime || size < 24)
      throw new SessionError(
        "只支持 JPEG、PNG 或 WebP / JPEG, PNG or WebP required",
        400,
      );
    const id = randomUUID(),
      db = await getDatabase();
    const r = await db.run(
      "INSERT INTO merchant_media (id,merchant,mime,data,size,created) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM merchant_media WHERE merchant=?)<60 AND (SELECT COALESCE(SUM(size),0) FROM merchant_media)+?<209715200",
      [id, m.id, mime, data.toString("base64"), size, Date.now(), m.id, size],
    );
    if (!r.changes)
      throw new SessionError(
        "演示额度为每商家 60 张照片 / Demo limit: 60 photos per merchant",
        409,
      );
    return Response.json({ id }, { headers: privateHeaders });
  } catch (e) {
    return errorResponse(e);
  }
}
