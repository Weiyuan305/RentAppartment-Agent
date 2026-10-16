"use client";
import { displayDistance } from "@/lib/i18n";
import { displayCity } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import { Footprints, LoaderCircle, X } from "lucide-react";
import type { City, Listing } from "@/lib/rental-data";
import { routeMinutes, type WalkingRoute } from "@/lib/walking-route";

export default function WalkingRoutePanel({ city, listing, status, route, onClose, onRetry, onFit }: {
  city: City; listing: Listing; status: "idle" | "loading" | "ready" | "error"; route: WalkingRoute | null;
  onClose: () => void; onRetry: () => void; onFit: () => void;
}) {
  const {t, locale} = useLocale();
  const cityView = displayCity(city,locale);
  return <div className="map-route" aria-label={t("到学校的步行路线")}>
    <div className="route-heading"><span className="map-selected-icon"><Footprints size={19}/></span><div><strong>{t("到学校的步行路线")}</strong><p>{listing.name} → {cityView.university}</p></div><button onClick={onClose} aria-label={t("关闭步行路线")}><X size={17}/></button></div>
    <div aria-live="polite">
      {status === "loading" && <p className="route-message"><LoaderCircle size={17} className="route-spinner"/>{t("正在读取步行路线…")}</p>}
      {status === "error" && <div className="route-message route-error"><p>{t("暂时无法读取这套房源的路线。")}</p><button onClick={onRetry}>{t("重新加载路线")}</button></div>}
      {route && <>
        <div className="route-metrics"><strong>{t("约")} {routeMinutes(route.durationSeconds)} <span>{t("分钟")}</span></strong><span>{displayDistance(route.distanceMeters,locale)} {t("· 步行")}</span><button onClick={onFit}>{t("查看全程")}</button></div>
        <p className="route-note">{listing.merchant?(locale==="zh"?"商家提供位置 · 入口待核验 · 非实时导航":"Host-provided location · Entrances unverified · Not live navigation"):t("演示房源位置 · 入口待核验 · 非实时导航")}</p>
        {(route.startOffsetMeters > 40 || route.endOffsetMeters > 40) && <p className="route-snap">{t("路线起终点已匹配附近道路：距公寓点")} {route.startOffsetMeters} {t("米，距校区点")} {route.endOffsetMeters} {t("米；偏移路段未计入。")}</p>}
        <details className="route-directions"><summary>{t("路线详情")}<span>{route.steps.length} {t("段指引")}</span></summary>
          <p className="route-source">{t("真实步行路网 ·")} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href={route.source.engine==="OSRM"?"https://project-osrm.org/":"https://valhalla.github.io/valhalla/"} target="_blank" rel="noreferrer">{route.source.engine}</a></p>
          <p className="route-date">{t("路网计算于")} {new Date(route.source.calculatedAt).toLocaleDateString(locale === "en" ? "en-GB" : "zh-CN", { timeZone: "Asia/Shanghai" })} {t("· 已保存结果 · 分段指引为原文")}</p>
          <p className="route-note">{t("公寓楼门和校门尚未核验。时间为路网估计；淡色线段表示建筑遮挡下的路线延续，高度仅供三维展示。")}</p>
          <ol>{route.steps.map((step, i) => <li key={i}><span>{step.instruction}</span>{step.distanceMeters > 0 && <small>{displayDistance(step.distanceMeters,locale)}</small>}</li>)}</ol>
        </details>
        <p className="route-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · {route.source.engine}</p>
      </>}
    </div>
  </div>;
}
