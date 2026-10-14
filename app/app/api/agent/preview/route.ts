import { z } from "zod";
import { randomUUID } from "node:crypto";
import { rentalStateSchema, type RentalMessage } from "@/lib/agent/contract";
import { validateRentalState } from "@/lib/agent/catalog";
import { createRentalTools } from "@/lib/agent/tools";
import { acquireSession, finishSession, loadSession, consumeQuota } from "@/lib/agent/store";
import { identity, errorResponse, readBody } from "@/lib/agent/http";
import { translator } from "@/lib/i18n";

// Explicit tool preview. It never pretends to be a model response.
export async function POST(request: Request) {
  let acquired: Awaited<ReturnType<typeof acquireSession>> | undefined;
  let owner = "";
  try {
    const auth = await identity(request); owner = auth.owner;
    const body = z.object({sessionId: z.string().uuid(), version: z.number().int().nonnegative(), state: rentalStateSchema, locale:z.enum(["zh","en"]).default("zh"), action: z.enum(["nearby", "nearest", "route", "supermarket", "commute"])}).parse(await readBody(request));
    await consumeQuota(`preview:${owner}`, 20, 60000);
    acquired = await acquireSession(owner, body.sessionId, body.version, validateRentalState(body.state));
    const runtime = createRentalTools(acquired.state);
    let result: unknown;
    const options = {toolCallId: randomUUID(), messages: [], context: {}};
    if (body.action === "nearby" || body.action === "supermarket") result = await runtime.tools.findNearbyAmenities.execute!({category: body.action === "nearby" ? "convenience" : "supermarket", radiusMeters: body.action === "nearby" ? 500 : undefined}, options);
    if (body.action === "nearest") result = await runtime.tools.focusAmenity.execute!({}, options);
    if (body.action === "route" || body.action === "commute") result = await runtime.tools.planWalkingRoute.execute!({destination: body.action === "commute" ? "campus" : "selected-place"}, options);
    const labels = {nearby: "查询公寓直线500米内便利店", nearest: "只显示直线最近一家", route: "到所选地点的步行路线", supermarket: "换成附近超市", commute: "到大学的步行路线"};
    const facts = result as {count?: number; category?: string; radiusMeters?: number; name?: string; straightLineMeters?: number; minutes?: number; distanceMeters?: number; destination?: string; limitation?: string};
    const t = translator(body.locale);
    const reply = body.locale === "en"
      ? facts.count !== undefined ? `The snapshot records ${facts.count} ${t(facts.category ?? "")} within ${facts.radiusMeters} m of this apartment (straight line). The map is synced. ${t("地图快照可能缺漏；营业状态、使用资格未核验。")}` : facts.name ? `Showing ${facts.name}, ${facts.straightLineMeters} m away in a straight line.` : `The walking route to ${t(facts.destination ?? "")} is about ${facts.minutes} min / ${facts.distanceMeters} m. The map is synced. Routing estimates use a demo apartment location; entrances are unverified.`
      : facts.count !== undefined ? `当前公寓直线 ${facts.radiusMeters} 米内，快照收录 ${facts.count} 处${facts.category}，地图已同步。${facts.limitation}` : facts.name ? `已显示 ${facts.name}，直线距离 ${facts.straightLineMeters} 米。` : `到 ${facts.destination} 的步行路线约 ${facts.minutes} 分钟、${facts.distanceMeters} 米，地图已同步。${facts.limitation}`;
    const extra: RentalMessage[] = [{id: randomUUID(), role: "user", parts: [{type: "text", text: `[${body.locale === "en" ? "Tool preview" : "工具体验"}] ${t(labels[body.action])}`}]}, {id: randomUUID(), role: "assistant", parts: [{type: "text", text: `[${body.locale === "en" ? "Tool result" : "工具结果"}] ${reply}`}]}];
    await finishSession(owner, acquired, [...acquired.messages, ...extra], runtime.getState());
    return Response.json({session: await loadSession(owner, acquired.id)}, {headers: auth.headers});
  } catch (error) {if (acquired) await finishSession(owner, acquired, acquired.messages, acquired.state); return errorResponse(error);}
}
