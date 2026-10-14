import type { CityId, Listing } from "../rental-data";
import type { CampusBuilding } from "./catalog";
export type TransitJourney = {
  durationMinutes: number;
  departure: string;
  arrival: string;
  legs: {
    mode: string;
    summary: string;
    minutes: number;
    from: string;
    to: string;
    coordinates: [number, number][];
  }[];
};
export const transitSources: Record<
  CityId,
  {
    operator: string;
    url: string;
    campusUrl: string;
    notes: { zh: string; en: string };
    lines: string[];
  }
> = {
  london: {
    operator: "Transport for London",
    url: "https://tfl.gov.uk/plan-a-journey/",
    campusUrl: "https://www.ucl.ac.uk/maps",
    notes: {
      zh: "使用官方规划查询公交、地铁及步行组合；出发与到达时间为伦敦当地时间。",
      en: "Use the official planner for bus, Tube and walking legs. Times are local to London.",
    },
    lines: [],
  },
  sydney: {
    operator: "Transport for NSW",
    url: "https://transportnsw.info/trip",
    campusUrl:
      "https://www.sydney.edu.au/about-us/campuses/getting-to-campus.html",
    notes: {
      zh: "官方出行规划；学校另有 Fisher Library—Redfern 校车，运行日与时刻请查学校说明。",
      en: "Official trip planner. The university also publishes Fisher Library–Redfern shuttle details and operating days.",
    },
    lines: ["Fisher Library — Redfern Station"],
  },
  singapore: {
    operator: "SimplyGo / NUS",
    url: "https://www.simplygo.com.sg/travel-guide/",
    campusUrl:
      "https://uci.nus.edu.sg/campus-life/campus-services/transportation/internal-shuttle-bus/",
    notes: {
      zh: "公共交通请查官方规划；NUS 校车为已公布静态线路，实时到站请查 uNivUS。",
      en: "Use the official public transport planner. NUS shuttle lines are published static information; use uNivUS for arrivals.",
    },
    lines: [
      "NUS A1",
      "NUS A2",
      "NUS D1",
      "NUS D2",
      "NUS K",
      "NUS R1",
      "NUS R2",
    ],
  },
  "kuala-lumpur": {
    operator: "MyRapid",
    url: "https://myrapid.com.my/journey-planner/",
    campusUrl: "https://www.um.edu.my/campus-map",
    notes: {
      zh: "官方公共交通规划与校区地图；本站未取得可核验的实时校车时刻。",
      en: "Official public transport planner and campus map. Verified live campus shuttle times are not available here.",
    },
    lines: [],
  },
  "hong-kong": {
    operator: "MTR",
    url: "https://www.mtr.com.hk/en/customer/jp/index.php",
    campusUrl: "https://www.maps.hku.hk/",
    notes: {
      zh: "官方港铁规划与港大地图；本站未取得完整的公交及校车时刻接口。",
      en: "Official MTR planner and HKU map. A complete bus/shuttle timetable API is not connected here.",
    },
    lines: [],
  },
};
export function transitDirectionsUrl(
  listing: Listing,
  building: CampusBuilding,
) {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", origin: `${listing.lat},${listing.lng}`, destination: `${building.lat},${building.lng}`, travelmode: "transit" })}`;
}
export function normalizeTransit(payload: unknown): TransitJourney[] {
  const data = payload as {
    journeys?: {
      duration?: number;
      startDateTime?: string;
      arrivalDateTime?: string;
      legs?: {
        duration?: number;
        mode?: { name?: string };
        instruction?: { summary?: string };
        departurePoint?: { commonName?: string };
        arrivalPoint?: { commonName?: string };
        path?: { lineString?: string };
      }[];
    }[];
  };
  if (!Array.isArray(data.journeys))
    throw new Error("TfL 未返回可用出行方案。");
  return data.journeys.slice(0, 3).map((j) => {
    if (
      !Number.isFinite(j.duration) ||
      j.duration! < 1 ||
      j.duration! > 720 ||
      !j.startDateTime ||
      !j.arrivalDateTime ||
      !Array.isArray(j.legs) ||
      j.legs.length > 30
    )
      throw new Error("交通方案格式无效。");
    const legs = j.legs.map((l) => {
      if (!Number.isFinite(l.duration) || l.duration! < 0)
        throw new Error("交通时长无效。");
      let coordinates: [number, number][] = [];
      if (l.path?.lineString) {
        const raw = JSON.parse(l.path.lineString);
        if (!Array.isArray(raw) || raw.length > 10000)
          throw new Error("交通路径过大。");
        coordinates = raw.map((p: unknown) => {
          if (
            !Array.isArray(p) ||
            p.length !== 2 ||
            !p.every(Number.isFinite) ||
            Math.abs(p[0]) > 90 ||
            Math.abs(p[1]) > 180
          )
            throw new Error("交通坐标无效。");
          return [p[1], p[0]];
        });
      }
      return {
        mode: (l.mode?.name ?? "transit").slice(0, 80),
        summary: (l.instruction?.summary ?? "").slice(0, 500),
        minutes: l.duration!,
        from: (l.departurePoint?.commonName ?? "").slice(0, 200),
        to: (l.arrivalPoint?.commonName ?? "").slice(0, 200),
        coordinates,
      };
    });
    return {
      durationMinutes: j.duration!,
      departure: j.startDateTime,
      arrival: j.arrivalDateTime,
      legs,
    };
  });
}
