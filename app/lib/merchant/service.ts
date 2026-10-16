import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { RentalDatabase } from "../agent/database";
import { SessionError } from "../agent/store";
import {
  applicationSchema,
  propertySchema,
  publicationIssues,
  publicListings,
  type Merchant,
  type PropertyRecord,
  type Conversation,
} from "./model";
import { buildingById } from "../student/catalog";
import { listings as samples, getCity, type Listing } from "../rental-data";

export type Actor = { id: string; admin: boolean };
type MerchantRow = Omit<Merchant, "profile"> & { profile: string };
type PropertyRow = Omit<PropertyRecord, "draft" | "published"> & {
  draft: string;
  published: string | null;
};
type ConversationRow = Omit<Conversation, "messages"> & { messages: string };
const merchant = (r: MerchantRow): Merchant => ({
  ...r,
  profile: JSON.parse(r.profile),
});
const property = (r: PropertyRow): PropertyRecord => ({
  ...r,
  draft: JSON.parse(r.draft),
  published: r.published ? JSON.parse(r.published) : null,
});
const conversation = (r: ConversationRow): Conversation => ({
  ...r,
  messages: JSON.parse(r.messages),
});
const id = z.string().max(60),
  version = z.number().int().min(0),
  reason = z.string().trim().min(5).max(1500);
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("apply"), profile: applicationSchema, version }),
  z.object({
    kind: z.literal("save"),
    id: id.optional(),
    version,
    draft: propertySchema,
  }),
  z.object({ kind: z.enum(["submit", "withdraw"]), id, version }),
  z.object({
    kind: z.literal("reviewMerchant"),
    id,
    version,
    approve: z.boolean(),
    reason,
  }),
  z.object({
    kind: z.literal("reviewProperty"),
    id,
    version,
    approve: z.boolean(),
    reason,
  }),
  z.object({ kind: z.literal("takedown"), id, version, reason }),
  z.object({
    kind: z.literal("inquire"),
    listing: id,
    message: z.string().trim().min(5).max(2000),
    type: z.enum(["enquiry", "viewing"]),
    appointment: z.string().max(40),
    timezone: z.string().max(80),
    mode: z.enum(["online", "in-person"]),
  }),
  z.object({
    kind: z.literal("reply"),
    id,
    version,
    message: z.string().trim().min(1).max(2000),
    status: z.enum(["open", "accepted", "declined", "closed"]),
  }),
  z.object({ kind: z.literal("report"), listing: id, reason }),
  z.object({ kind: z.literal("resolveReport"), id }),
]);
export function createMerchantService(db: RentalDatabase) {
  async function mine(actor: Actor) {
    const r = await db.first<MerchantRow>(
      "SELECT * FROM merchants WHERE owner=?",
      [actor.id],
    );
    return r ? merchant(r) : null;
  }
  async function owned(actor: Actor, propertyId: string) {
    const m = await mine(actor),
      r = await db.first<PropertyRow>(
        "SELECT * FROM properties WHERE id=? AND merchant=?",
        [propertyId, m?.id ?? ""],
      );
    if (!r) throw new SessionError("房源不存在 / Property not found", 404);
    return { m: m!, p: property(r) };
  }
  function admin(actor: Actor) {
    if (!actor.admin)
      throw new SessionError(
        "需要平台管理员权限 / Administrator access required",
        403,
      );
  }
  function changed(result: { changes: number }) {
    if (!result.changes)
      throw new SessionError(
        "内容已更新，请刷新后重试 / Updated elsewhere; refresh and try again",
        409,
      );
  }
  async function audit(
    actor: Actor,
    action: string,
    target: string,
    note: string,
  ) {
    await db.run("INSERT INTO merchant_audit VALUES (?,?,?,?,?,?)", [
      randomUUID(),
      actor.id,
      action,
      target,
      note,
      Date.now(),
    ]);
  }
  async function catalogue(): Promise<Listing[]> {
    const rows = await db.all<PropertyRow & { merchantName: string }>(
      "SELECT p.*,m.profile AS merchantName FROM properties p JOIN merchants m ON p.merchant=m.id WHERE p.published IS NOT NULL AND m.status='approved' ORDER BY p.publishedAt DESC LIMIT 500",
    );
    const homes = rows.flatMap((r) =>
      publicListings(property(r), JSON.parse(r.merchantName).name),
    );
    const cached = homes.length
      ? await db.all<{ payload: string }>(
          "SELECT json_object('listingId',json_extract(payload,'$.listingId'),'origin',json_extract(payload,'$.origin'),'destination',json_extract(payload,'$.destination'),'amenityId',json_extract(payload,'$.amenityId'),'distanceMeters',json_extract(payload,'$.distanceMeters'),'durationSeconds',json_extract(payload,'$.durationSeconds'),'source',json_extract(payload,'$.source')) AS payload FROM routes WHERE key GLOB 'm_*' AND expires>? ORDER BY expires DESC LIMIT 500",
          [Date.now()],
        )
      : [];
    for (const row of cached) {
      try {
        const r = JSON.parse(row.payload),
          l = homes.find((l) => l.id === r.listingId);
        if (
          !l?.merchant ||
          r.origin?.[0] !== l.lng ||
          r.origin?.[1] !== l.lat ||
          !Number.isFinite(r.durationSeconds)
        )
          continue;
        const dest = r.amenityId?.startsWith("university:")
          ? "university"
          : r.amenityId;
        const target =
          dest === "university" ? getCity(l.cityId) : buildingById(dest);
        if (
          !target ||
          r.destination?.[0] !== target.lng ||
          r.destination?.[1] !== target.lat
        )
          continue;
        l.merchant.commutes ??= {};
        l.merchant.commutes[dest] = {
          distanceMeters: r.distanceMeters,
          durationSeconds: r.durationSeconds,
          source: r.source,
        };
      } catch {}
    }
    return [...homes, ...samples];
  }
  async function dashboard(actor: Actor, mode: string) {
    const m = await mine(actor);
    if (mode === "admin") {
      admin(actor);
      return {
        admin: true,
        merchant: m,
        merchants: (
          await db.all<MerchantRow>(
            "SELECT * FROM merchants ORDER BY updated DESC LIMIT 200",
          )
        ).map(merchant),
        properties: (
          await db.all<PropertyRow>(
            "SELECT * FROM properties ORDER BY updated DESC LIMIT 200",
          )
        ).map(property),
        reports: await db.all(
          "SELECT * FROM merchant_reports ORDER BY resolved,created DESC LIMIT 200",
        ),
        audit: await db.all(
          "SELECT action,target,reason,created FROM merchant_audit ORDER BY created DESC LIMIT 80",
        ),
      };
    }
    const conversations = (
      await db.all<ConversationRow>(
        mode === "student"
          ? "SELECT * FROM merchant_conversations WHERE student=? ORDER BY updated DESC LIMIT 100"
          : "SELECT * FROM merchant_conversations WHERE merchant=? ORDER BY updated DESC LIMIT 100",
        [mode === "student" ? actor.id : (m?.id ?? "")],
      )
    ).map(conversation);
    return {
      admin: actor.admin,
      merchant: m,
      properties: m
        ? (
            await db.all<PropertyRow>(
              "SELECT * FROM properties WHERE merchant=? ORDER BY updated DESC",
              [m.id],
            )
          ).map(property)
        : [],
      conversations,
    };
  }
  async function command(actor: Actor, input: unknown) {
    const c = commandSchema.parse(input),
      now = Date.now();
    if (c.kind === "apply") {
      const m = await mine(actor);
      if (m) {
        if (m.status === "approved" || m.status === "pending")
          throw new SessionError("申请已提交 / Application already submitted");
        changed(
          await db.run(
            "UPDATE merchants SET profile=?,status='pending',reason='',version=version+1,updated=? WHERE id=? AND version=?",
            [JSON.stringify(c.profile), now, m.id, c.version],
          ),
        );
      } else
        await db.run(
          "INSERT INTO merchants (id,owner,status,profile,updated) VALUES (?,?,'pending',?,?)",
          [randomUUID(), actor.id, JSON.stringify(c.profile), now],
        );
      return {};
    }
    if (c.kind === "save") {
      const m = await mine(actor);
      if (m?.status !== "approved")
        throw new SessionError(
          "商家入驻审核通过后可发布 / Merchant approval required",
          403,
        );
      const media = [
        ...c.draft.photos,
        ...(c.draft.floorPlans ?? []),
        ...c.draft.rooms.flatMap((r) => r.photos),
      ];
      const photos = [...new Set(media)];
      // D1 limits bound variables; one query per bounded chunk, not per photo.
      for (let i = 0; i < photos.length; i += 80) {
        const chunk = photos.slice(i, i + 80);
        const ownedPhotos = await db.first<{ count: number }>(
          `SELECT COUNT(*) AS count FROM merchant_media WHERE merchant=? AND id IN (${chunk.map(() => "?").join(",")})`,
          [m.id, ...chunk],
        );
        if (ownedPhotos?.count !== chunk.length)
          throw new SessionError(
            "照片不属于此商家 / Invalid photo ownership",
            400,
          );
      }
      if (c.id) {
        await owned(actor, c.id);
        changed(
          await db.run(
            "UPDATE properties SET draft=?,status='draft',reason='',version=version+1,updated=? WHERE id=? AND merchant=? AND version=?",
            [JSON.stringify(c.draft), now, c.id, m.id, c.version],
          ),
        );
        return { id: c.id };
      }
      const propertyId = `m_${randomUUID()}`;
      changed(
        await db.run(
          "INSERT INTO properties (id,merchant,draft,status,updated) SELECT ?,?,?,'draft',? WHERE (SELECT COUNT(*) FROM properties WHERE merchant=?)<30",
          [propertyId, m.id, JSON.stringify(c.draft), now, m.id],
        ),
      );
      return { id: propertyId };
    }
    if (c.kind === "submit" || c.kind === "withdraw") {
      const { m, p } = await owned(actor, c.id);
      if (c.kind === "submit") {
        if (m.status !== "approved")
          throw new SessionError(
            "商家资格不可用 / Merchant access suspended",
            403,
          );
        const issues = publicationIssues(p.draft);
        if (issues.length) throw new SessionError(issues.join("\n"), 400);
        changed(
          await db.run(
            "UPDATE properties SET status='pending',reason='',version=version+1,updated=? WHERE id=? AND version=? AND status!='pending'",
            [now, p.id, c.version],
          ),
        );
      } else
        changed(
          await db.run(
            "UPDATE properties SET published=NULL,status='offline',version=version+1,updated=? WHERE id=? AND version=?",
            [now, p.id, c.version],
          ),
        );
      await audit(actor, c.kind, p.id, "");
      return {};
    }
    if (c.kind === "reviewMerchant") {
      admin(actor);
      changed(
        await db.run(
          "UPDATE merchants SET status=?,reason=?,version=version+1,updated=? WHERE id=? AND version=? AND status='pending'",
          [c.approve ? "approved" : "rejected", c.reason, now, c.id, c.version],
        ),
      );
      await audit(actor, c.kind, c.id, c.reason);
      return {};
    }
    if (c.kind === "reviewProperty" || c.kind === "takedown") {
      admin(actor);
      const row = await db.first<PropertyRow>(
        "SELECT * FROM properties WHERE id=?",
        [c.id],
      );
      if (!row) throw new SessionError("房源不存在 / Property not found", 404);
      if (c.kind === "takedown")
        changed(
          await db.run(
            "UPDATE properties SET published=NULL,status='offline',reason=?,version=version+1,updated=? WHERE id=? AND version=?",
            [c.reason, now, c.id, c.version],
          ),
        );
      else {
        if (c.approve) {
          const issues = publicationIssues(property(row).draft);
          if (issues.length) throw new SessionError(issues.join("\n"), 400);
        }
        changed(
          await db.run(
            c.approve
              ? "UPDATE properties SET published=draft,publishedAt=?,status='approved',reason=?,version=version+1,updated=? WHERE id=? AND version=? AND status='pending' AND merchant IN (SELECT id FROM merchants WHERE status='approved')"
              : "UPDATE properties SET status='rejected',reason=?,version=version+1,updated=? WHERE id=? AND version=? AND status='pending'",
            c.approve
              ? [now, c.reason, now, c.id, c.version]
              : [c.reason, now, c.id, c.version],
          ),
        );
      }
      await audit(actor, c.kind, c.id, c.reason);
      return {};
    }
    if (c.kind === "inquire" || c.kind === "report") {
      const l = (await catalogue()).find(
        (l) => l.id === c.listing && l.merchant,
      );
      if (!l) throw new SessionError("房源已下架 / Listing unavailable", 404);
      if (c.kind === "report") {
        await db.run(
          "INSERT INTO merchant_reports (id,student,listing,reason,created) VALUES (?,?,?,?,?)",
          [randomUUID(), actor.id, l.id, c.reason, now],
        );
        return {};
      }
      const p = await db.first<{ merchant: string }>(
        "SELECT merchant FROM properties WHERE id=?",
        [l.merchant!.propertyId],
      );
      if (c.type === "viewing") {
        if (
          !Number.isFinite(Date.parse(c.appointment)) ||
          Date.parse(c.appointment) < now ||
          Date.parse(c.appointment) > now + 366 * 86400000
        )
          throw new SessionError(
            "请选择未来一年内的预约时间 / Choose a future viewing time",
            400,
          );
        try {
          new Intl.DateTimeFormat("en", { timeZone: c.timezone });
        } catch {
          throw new SessionError("时区无效 / Invalid time zone", 400);
        }
      }
      const conversationId = randomUUID();
      await db.run(
        "INSERT INTO merchant_conversations (id,student,merchant,listing,name,kind,status,appointment,timezone,mode,messages,updated) VALUES (?,?,?,?,?,?,'open',?,?,?,?,?)",
        [
          conversationId,
          actor.id,
          p!.merchant,
          l.id,
          l.name,
          c.type,
          c.appointment,
          c.timezone,
          c.mode,
          JSON.stringify([{ by: "student", text: c.message, at: now }]),
          now,
        ],
      );
      return { id: conversationId };
    }
    if (c.kind === "reply") {
      const row = await db.first<ConversationRow>(
          "SELECT * FROM merchant_conversations WHERE id=?",
          [c.id],
        ),
        m = await mine(actor);
      if (!row || (row.student !== actor.id && row.merchant !== m?.id))
        throw new SessionError("会话不存在 / Conversation not found", 404);
      const by = row.student === actor.id ? "student" : "merchant";
      if (
        by === "student" &&
        c.status !== row.status &&
        c.status !== "open" &&
        c.status !== "closed"
      )
        throw new SessionError(
          "只有商家能确认预约 / Only the merchant can accept a viewing",
          403,
        );
      const messages = conversation(row).messages;
      if (messages.length >= 100)
        throw new SessionError(
          "本次咨询已达消息上限 / Conversation limit reached",
          400,
        );
      changed(
        await db.run(
          "UPDATE merchant_conversations SET messages=?,status=?,version=version+1,updated=? WHERE id=? AND version=?",
          [
            JSON.stringify([...messages, { by, text: c.message, at: now }]),
            c.status,
            now,
            c.id,
            c.version,
          ],
        ),
      );
      return {};
    }
    if (c.kind === "resolveReport") {
      admin(actor);
      changed(
        await db.run(
          "UPDATE merchant_reports SET resolved=1 WHERE id=? AND resolved=0",
          [c.id],
        ),
      );
      await audit(actor, c.kind, c.id, "");
      return {};
    }
    throw new SessionError("Unsupported action", 400);
  }
  return { mine, dashboard, command, catalogue };
}
