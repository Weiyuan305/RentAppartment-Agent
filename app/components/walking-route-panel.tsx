"use client";
import { Footprints, LoaderCircle, X } from "lucide-react";
import type { City, Listing } from "@/lib/rental-data";
import { routeDistance, routeMinutes, type WalkingRoute } from "@/lib/walking-route";

export default function WalkingRoutePanel({ city, listing, status, route, onClose, onRetry, onFit }: {
  city: City; listing: Listing; status: "idle" | "loading" | "ready" | "error"; route: WalkingRoute | null;
  onClose: () => void; onRetry: () => void; onFit: () => void;
}) {
  return <div className="map-route" aria-label="到学校的步行路线">
    <div className="route-heading"><span className="map-selected-icon"><Footprints size={19}/></span><div><strong>到学校的步行路线</strong><p>{listing.name} → {city.university}</p></div><button onClick={onClose} aria-label="关闭步行路线"><X size={17}/></button></div>
    <div aria-live="polite">
      {status === "loading" && <p className="route-message"><LoaderCircle size={17} className="route-spinner"/>正在读取步行路线…</p>}
      {status === "error" && <div className="route-message route-error"><p>暂时无法读取这套房源的路线。</p><button onClick={onRetry}>重新加载路线</button></div>}
      {route && <>
        <div className="route-metrics"><strong>约 {routeMinutes(route.durationSeconds)} <span>分钟</span></strong><span>{routeDistance(route.distanceMeters)} · 步行</span><button onClick={onFit}>查看全程</button></div>
        <p className="route-note">演示房源位置 · 入口待核验 · 非实时导航</p>
        {(route.startOffsetMeters > 40 || route.endOffsetMeters > 40) && <p className="route-snap">路线起终点已匹配附近道路：距公寓点 {route.startOffsetMeters} 米，距校区点 {route.endOffsetMeters} 米；偏移路段未计入。</p>}
        <details className="route-directions"><summary>路线详情<span>{route.steps.length} 段指引</span></summary>
          <p className="route-source">真实步行路网 · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> · <a href="https://valhalla.github.io/valhalla/" target="_blank" rel="noreferrer">Valhalla</a></p>
          <p className="route-date">路网计算于 {new Date(route.source.calculatedAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} · 已保存结果 · 分段指引为原文</p>
          <p className="route-note">公寓楼门和校门尚未核验。时间为路网估计；淡色线段表示建筑遮挡下的路线延续，高度仅供三维展示。</p>
          <ol>{route.steps.map((step, i) => <li key={i}><span>{step.instruction}</span>{step.distanceMeters > 0 && <small>{routeDistance(step.distanceMeters)}</small>}</li>)}</ol>
        </details>
        <p className="route-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · Valhalla</p>
      </>}
    </div>
  </div>;
}
