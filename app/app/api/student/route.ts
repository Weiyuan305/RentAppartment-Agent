import { buildingCatchment } from "@/lib/student/catchments";
import { listings, cities } from "@/lib/rental-data";
import {
  buildingById,
  searchBuildings,
  buildingCommute,
} from "@/lib/student/catalog";
import { getTransitJourneys } from "@/lib/student/transit-server";
import { transitSources, transitDirectionsUrl } from "@/lib/student/transit";
import { SessionError } from "@/lib/agent/store";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams,
    city = p.get("city"),
    kind = p.get("kind"),
    b = buildingById(p.get("building")),
    l = listings.find((l) => l.id === p.get("listing") && l.cityId === city);
  const headers = { "Cache-Control": "no-store" };
  if (!cities.some((c) => c.id === city))
    return Response.json({ error: "城市无效。" }, { status: 400, headers });
  if (kind === "buildings")
    return Response.json(
      { buildings: searchBuildings(city!, p.get("q")?.slice(0, 100) ?? "") },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
  if (!b || b.cityId !== city || !l)
    return Response.json(
      { error: "请选择同城公寓和已收录楼栋。" },
      { status: 400, headers },
    );
  if (kind === "commute")
    return Response.json(
      { route: buildingCommute(l.id, b.id) ?? null },
      { headers },
    );
  if (kind === "catchment") {
    const result = buildingCatchment(b.id, Number(p.get("minutes")));
    return Response.json(result ?? { error: "步行范围未收录。" }, {
      status: result ? 200 : 404,
      headers,
    });
  }
  if (kind === "transit") {
    if (city !== "london")
      return Response.json(
        {
          kind: "external-planner",
          ...transitSources[l.cityId],
          directionsUrl: transitDirectionsUrl(l, b),
        },
        { headers },
      );
    try {
      return Response.json(
        {
          kind: "tfl-journeys",
          journeys: await getTransitJourneys(l, b),
          source: "https://api.tfl.gov.uk/",
          timezone: "Europe/London",
        },
        { headers },
      );
    } catch (e) {
      console.warn("[student-transit]", {
        provider: "TfL",
        errorType: e instanceof Error ? e.name : "UnknownError",
        status: e instanceof SessionError ? e.status : 502,
      });
      return Response.json(
        {
          error:
            e instanceof SessionError
              ? e.message
              : "公共交通查询暂不可用，请使用官方规划入口。",
        },
        { status: e instanceof SessionError ? e.status : 502, headers },
      );
    }
  }
  return Response.json({ error: "查询类型无效。" }, { status: 400, headers });
}
