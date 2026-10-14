"use client";
import { Footprints, TrainFront, X, RefreshCw } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { CampusBuilding, CampusRoute } from "@/lib/student/catalog";
import type { TransitJourney } from "@/lib/student/transit";
import { transitDirectionsUrl } from "@/lib/student/transit";
import type { Listing } from "@/lib/rental-data";
export function BuildingJourneyPanel({
  building,
  route,
  status,
  onClose,
  onRetry,
  onFit,
}: {
  building: CampusBuilding;
  route: CampusRoute | null;
  status: string;
  onClose: () => void;
  onRetry: () => void;
  onFit: () => void;
}) {
  const { locale } = useLocale(),
    w = (zh: string, en: string) => (locale === "zh" ? zh : en);
  return (
    <div className="map-route student-map-journey">
      <div className="student-map-heading">
        <Footprints size={17} />
        <strong>{building.name}</strong>
        <button
          aria-label={w("收起楼栋路线", "Close building route")}
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {status === "loading" ? (
        <p>{w("正在加载真实步行路线…", "Loading walking route…")}</p>
      ) : status === "error" ? (
        <p>
          {w(
            "路线未加载，请重试或选择其他楼栋。",
            "Route unavailable. Retry or choose another building.",
          )}
          <button onClick={onRetry}>
            <RefreshCw size={15} />
            {w("重试", "Retry")}
          </button>
        </p>
      ) : (
        route && (
          <>
            <div className="student-journey-total">
              <strong>
                {Math.ceil(route.durationSeconds / 60)} {w("分钟", "min")}
              </strong>
              <span>{route.distanceMeters}m</span>
              <button onClick={onFit}>{w("查看全程", "Fit route")}</button>
            </div>
            <details>
              <summary>
                {w("步行指引", "Walking directions")} · {route.steps.length}
              </summary>
              <ol>
                {route.steps.map((s, i) => (
                  <li key={i}>
                    {s.instruction} · {s.distanceMeters}m
                  </li>
                ))}
              </ol>
            </details>
          </>
        )
      )}
      <p className="student-note">
        {building.locationType === "mapped-entrance"
          ? w(
              "到 OSM 标注入口，开放条件未核验。",
              "To an OSM mapped entrance; access conditions unverified.",
            )
          : w(
              "到楼栋附近，入口未核验。",
              "To the building location; entrance unverified.",
            )}{" "}
        <a href={building.source.url} target="_blank" rel="noreferrer">
          OSM ↗
        </a>
        {route && <> · Valhalla · {route.source.calculatedAt.slice(0, 10)}</>}
      </p>
    </div>
  );
}
export function TransitJourneyPanel({
  building,
  listing,
  journeys,
  status,
  onClose,
  onRetry,
  onFit,
}: {
  building: CampusBuilding;
  listing?: Listing;
  journeys: TransitJourney[];
  status: string;
  onClose: () => void;
  onRetry: () => void;
  onFit: () => void;
}) {
  const { locale } = useLocale(),
    w = (zh: string, en: string) => (locale === "zh" ? zh : en);
  return (
    <div className="map-transit student-map-journey">
      <div className="student-map-heading">
        <TrainFront size={17} />
        <strong>{building.name}</strong>
        <button
          aria-label={w("收起公共交通方案", "Close transit journey")}
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {status === "loading" ? (
        <p>{w("正在查询 TfL 公共交通…", "Finding TfL journeys…")}</p>
      ) : status === "external" ? (
        <p>
          {w(
            "请在官方或外部规划页面查询公交与地铁方案。",
            "Use the official or external planner for bus and Tube journeys.",
          )}
          {listing && (
            <a
              href={transitDirectionsUrl(listing, building)}
              target="_blank"
              rel="noreferrer"
            >
              {w("规划此行程 ↗", "Plan this journey ↗")}
            </a>
          )}
        </p>
      ) : status === "error" ? (
        <p>
          {w(
            "查询暂不可用，可重试或打开 TfL 官网。",
            "Journeys unavailable. Retry or visit TfL.",
          )}
          <button onClick={onRetry}>{w("重试", "Retry")}</button>
          {listing && (
            <a
              href={transitDirectionsUrl(listing, building)}
              target="_blank"
              rel="noreferrer"
            >
              {w("规划此行程 ↗", "Plan this journey ↗")}
            </a>
          )}
        </p>
      ) : (
        <>
          {journeys.map((j, i) => (
            <details key={i} open={i === 0}>
              <summary>
                {j.durationMinutes} {w("分钟", "min")} ·{" "}
                {j.departure.slice(11, 16)}–{j.arrival.slice(11, 16)}
              </summary>
              <ol>
                {j.legs.map((l, n) => (
                  <li key={n}>
                    <strong>{l.mode}</strong> · {l.summary} · {l.minutes}{" "}
                    {w("分钟", "min")}
                  </li>
                ))}
              </ol>
            </details>
          ))}
          <button onClick={onFit}>
            {w("地图显示首个方案", "Fit first journey")}
          </button>
        </>
      )}
      <p className="student-note">
        <a
          href="https://tfl.gov.uk/plan-a-journey/"
          target="_blank"
          rel="noreferrer"
        >
          {status === "external" ? w("TfL 官方规划 ↗", "TfL official planner ↗") : "Powered by TfL Open Data ↗"}
        </a>{" "}
        ·{" "}
        {status === "external" ? w("行程与班次以规划页面为准。", "Follow the journey times and services shown by the planner.") : w(
          "伦敦当地时间，至多缓存5分钟。道路与班次可能变化。",
          "London local time. Cached up to 5 minutes; services may change.",
        )}
      </p>
    </div>
  );
}
