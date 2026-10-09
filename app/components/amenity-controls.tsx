"use client";
import { useMemo, useState, type CSSProperties } from "react";
import { Icon, X, LocateFixed, List, LoaderCircle, ExternalLink, SlidersHorizontal, Footprints } from "lucide-react";
import { amenityCategories, amenityGroups, primaryAmenityCategories, amenityInfo, matchesAmenityCategory, amenitySourceUrl, amenityCuisines, type Amenity, type AmenityCategory, type CityAmenities } from "@/lib/amenities";
import { amenityIconNodes } from "@/lib/amenity-icons";
import type { Listing } from "@/lib/rental-data";
import { metersBetween, routeDistance, routeMinutes, type WalkingRoute } from "@/lib/walking-route";

const cuisineNames: Record<string, string> = { chinese:"中餐", japanese:"日料", korean:"韩餐", thai:"泰餐", indian:"印度菜", vietnamese:"越南菜", asian:"亚洲菜", italian:"意大利菜", pizza:"披萨", burger:"汉堡", sandwich:"三明治", coffee_shop:"咖啡", regional:"当地菜", international:"国际菜", malaysian:"马来西亚菜", seafood:"海鲜", vegetarian:"素食" };
export default function AmenityControls({ categories, data, status, visible, selected, listing, radius, cuisine, onRadius, onCuisine, onToggle, onSelect, onDismiss, onFit, onRetry, onExplore, onClear }: {
  categories: AmenityCategory[]; data: CityAmenities | null; status: "idle" | "loading" | "ready" | "error";
  visible: Amenity[]; selected: Amenity | undefined; listing: Listing | undefined; radius: number; cuisine: string;
  onRadius: (radius: number) => void; onCuisine: (cuisine: string) => void; onExplore: () => void; onClear: () => void;
  onToggle: (category: AmenityCategory) => void; onSelect: (id: string) => void;
  onDismiss: () => void; onFit: () => void; onRetry: () => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [listLimit, setListLimit] = useState(40);
  const extraCount = categories.filter(c => !primaryAmenityCategories.includes(c)).length;
  const origin: [number, number] = listing ? [listing.lng, listing.lat] : data?.center ?? [0, 0];
  const cuisines = useMemo(() => [...new Set(data?.places.filter(p => ["restaurant", "cafe", "canteen"].includes(p.category)).flatMap(p => amenityCuisines(p.tags.cuisine)) ?? [])].sort((a, b) => Number(Boolean(cuisineNames[b])) - Number(Boolean(cuisineNames[a])) || a.localeCompare(b)), [data]);
  const counts = useMemo(() => Object.fromEntries(amenityCategories.map(category => [category, data?.places.filter(p => matchesAmenityCategory(p, category)).length])), [data]);
  function option(category: AmenityCategory, count = false) {
    const info = amenityInfo[category];
    const total = counts[category];
    return <label key={category} style={{ "--amenity-color": info.color } as CSSProperties} className={categories.includes(category) ? "checked" : ""}>
      <input type="checkbox" checked={categories.includes(category)} onChange={() => {setListOpen(false); onToggle(category);}} aria-label={`显示${info.name}`}/>
      <Icon iconNode={amenityIconNodes[category]} size={14}/><span>{info.name}</span>{count && <small>{total ?? "—"}</small>}
    </label>;
  }
  return <div className="map-amenities">
    <div className="amenity-filters">
      <fieldset aria-label="地图周边设施"><legend className="sr-only">勾选要显示的设施，可多选</legend>{primaryAmenityCategories.map(c => option(c))}</fieldset>
      <div className="amenity-tools"><button className={moreOpen ? "active" : ""} aria-expanded={moreOpen} aria-controls="more-amenities" onClick={() => {setMoreOpen(v => !v); setListOpen(false); onExplore();}}><SlidersHorizontal size={12}/>更多设施{extraCount > 0 && <b>{extraCount}</b>}</button>
        {categories.length > 0 && <button onClick={onClear}>清除勾选</button>}
      </div>
      <div className="amenity-status" aria-live="polite">
        {status === "idle" && <span>大学周边 3 km · 勾选显示</span>}
        {status === "loading" && <span><LoaderCircle size={11} className="route-spinner"/>正在读取地点…</span>}
        {status === "error" && <><span>地点暂时无法读取</span><button onClick={onRetry}>重试</button></>}
        {status === "ready" && <><span>已显示 {visible.length} 处</span><button aria-expanded={listOpen && !selected} onClick={() => {onDismiss(); setMoreOpen(false); setListLimit(40); setListOpen(v => !v);}}><List size={11}/>列表</button><button onClick={() => {setMoreOpen(false); onFit();}} disabled={!visible.length}><LocateFixed size={11}/>查看周边</button></>}
      </div>
      {moreOpen && <div className="amenity-more" id="more-amenities" onKeyDown={e => {if (e.key === "Escape") setMoreOpen(false);}}>
        <div className="amenity-list-heading"><strong>学生生活地图</strong><button aria-label="关闭更多设施" onClick={() => setMoreOpen(false)}><X size={15}/></button></div>
        <p className="amenity-more-note">大学周边 3 公里快照 · 可多选</p>
        {amenityGroups.map(group => <fieldset key={group.name}><legend>{group.name}</legend><div>{group.categories.map(c => option(c, true))}</div></fieldset>)}
        <div className="amenity-refinements"><label>距离范围<select aria-label="设施距离范围" value={radius} onChange={e => onRadius(Number(e.target.value))}>{![0,500,1000,2000].includes(radius) && <option value={radius}>距{listing ? "公寓" : "大学"}直线 {radius} 米内</option>}<option value={0}>全部校区范围</option><option value={500}>距{listing ? "公寓" : "大学"}直线 500 米内</option><option value={1000}>距{listing ? "公寓" : "大学"}直线 1 公里内</option><option value={2000}>距{listing ? "公寓" : "大学"}直线 2 公里内</option></select></label>
          <label>餐饮菜系<select aria-label="餐饮菜系" value={cuisine} onChange={e => onCuisine(e.target.value)}><option value="">全部菜系</option>{[...new Set([...cuisines, ...(cuisine ? [cuisine] : [])])].map(c => <option key={c} value={c}>{cuisineNames[c] ?? c}</option>)}</select></label>
        </div>
        <p className="amenity-list-note">数字为快照收录数，0 不代表附近没有。亚洲食品店按原始标签识别，自习空间补充大学官方资料。大学建筑可能包括教学、研究及行政用途；开放时间和使用资格请向场所确认。</p>
        <button className="amenity-done" onClick={() => setMoreOpen(false)}>完成选择 · 显示 {visible.length} 处</button>
      </div>}
    </div>
    {listOpen && !selected && data && categories.length > 0 && <div className="amenity-list" aria-label="已显示的设施列表">
      <div className="amenity-list-heading"><strong>{listing ? "公寓周边" : "周边地点"} <span>{visible.length}</span></strong><button onClick={() => setListOpen(false)} aria-label="收起设施列表"><X size={14}/></button></div>
      <ul>{visible.slice(0, listLimit).map(place => <li key={place.id}><button onClick={() => {setListOpen(false); onSelect(place.id);}}><Icon iconNode={amenityIconNodes[place.category]} size={14} style={{color:amenityInfo[place.category].color}}/><span>{place.name}</span><small>{routeDistance(metersBetween(origin, [place.lng, place.lat]))}</small></button></li>)}</ul>
      {visible.length > listLimit && <button className="amenity-load-more" onClick={() => setListLimit(n => n + 40)}>再显示 40 处</button>}
      {!visible.length && <p className="amenity-empty">当前筛选没有收录地点，试试其他类别或扩大距离范围。</p>}
      <p className="amenity-list-note">按距{listing ? "所选公寓" : "大学"}的直线距离排序。点击地点可计算真实步行路线；站点位置不代表实时班次，医院分类可能包含院内设施。</p>
    </div>}
    {data && <p className="amenity-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · {new Date(data.source.collectedAt).toLocaleDateString("zh-CN", {timeZone:"Asia/Shanghai"})} 快照 · 可能缺漏，营业状态未核验</p>}
  </div>;
}

export function AmenityDetails({ place, listing, route, routeStatus, routeError, onRoute, onFitRoute, onClearRoute, onClose }: {
  place: Amenity; listing: Listing | undefined; route: WalkingRoute | null; routeStatus: "idle" | "loading" | "ready" | "error"; routeError?: string;
  onRoute: () => void; onFitRoute: () => void; onClearRoute: () => void; onClose: () => void;
}) {
  const stationLines = ["rail", "bus"].includes(place.category) ? place.tags.route_ref || place.tags.network : undefined;
  const facts = <>
    {place.address && <p>{place.address}</p>}
    {stationLines && <p>交通记录：{stationLines}{place.tags.ref ? ` · ${place.tags.ref}` : ""} · 非实时班次</p>}
    {place.tags.cuisine && <p>菜系：{amenityCuisines(place.tags.cuisine).map(c => cuisineNames[c] ?? c).join("、")}</p>}
    {place.tags.access && <p>通行记录：{place.tags.access} · 进入资格待核验</p>}
    {place.tags.operator && <p>运营机构：{place.tags.operator}</p>}
    {place.studySource && <p className="amenity-study-source">已收录自习空间 · <a href={place.studySource} target="_blank" rel="noreferrer">大学官方介绍<ExternalLink size={10}/></a> · 使用资格请确认</p>}
  </>;
  return <div className={`amenity-popup map-amenity-selected${route ? " amenity-route-ready" : ""}`} aria-label="设施信息">
    <div className="amenity-popup-heading"><span style={{color:amenityInfo[place.category].color}}><Icon iconNode={amenityIconNodes[place.category]} size={14}/>{amenityInfo[place.category].name}</span><button onClick={onClose} aria-label="关闭设施信息"><X size={16}/></button></div>
    <strong>{place.name}</strong>
    {listing && <p>距所选公寓直线 {routeDistance(metersBetween([listing.lng, listing.lat], [place.lng, place.lat]))}</p>}
    {!route && <div className="amenity-facts">{facts}</div>}
    {listing && <div className="amenity-walk" aria-live="polite">
      {routeStatus === "idle" && <button className="listing-route-button" onClick={onRoute}><Footprints size={15}/>从公寓步行到这里</button>}
      {routeStatus === "loading" && <p className="route-message"><LoaderCircle size={15} className="route-spinner"/>正在计算真实步行路线…</p>}
      {routeStatus === "error" && <div className="amenity-route-error"><p>{routeError || "暂时无法计算步行路线，请稍后重试。"}</p><button onClick={onRoute}>重试路线</button></div>}
      {route && <><div className="route-metrics"><strong>约 {routeMinutes(route.durationSeconds)} <span>分钟</span></strong><span>{routeDistance(route.distanceMeters)} · 步行</span><button onClick={onFitRoute}>查看全程</button></div>
        <p className="route-note">路网估计 · 演示公寓位置，场所入口待核验</p>
        {(route.startOffsetMeters > 40 || route.endOffsetMeters > 40) && <p className="route-snap">路线匹配道路的偏移：公寓 {route.startOffsetMeters} 米，目的地 {route.endOffsetMeters} 米，未计入时间。</p>}
        <details className="route-directions"><summary>路线详情<span>{route.steps.length} 段指引</span></summary><ol>{route.steps.map((s, i) => <li key={i}><span>{s.instruction}</span>{s.distanceMeters > 0 && <small>{routeDistance(s.distanceMeters)}</small>}</li>)}</ol><p className="route-date">计算于 {new Date(route.source.calculatedAt).toLocaleDateString("zh-CN", {timeZone:"Asia/Shanghai"})} · 非实时导航</p></details>
        <div className="amenity-route-source"><span>© OpenStreetMap · <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">OSRM</a></span><button onClick={onClearRoute}>收起地点路线</button></div>
      </>}
    </div>}
    {route && <details className="amenity-facts"><summary>地点资料与使用资格</summary>{facts}</details>}
    <div className="amenity-record"><span>{place.locationType === "area-center" ? "区域中心，非入口" : "地图记录位置"}</span><a href={amenitySourceUrl(place)} target="_blank" rel="noreferrer">查看来源<ExternalLink size={10}/></a><a href={`https://www.openstreetmap.org/edit?${place.id.replace("/", "=")}`} target="_blank" rel="noreferrer">纠正地图</a></div>
  </div>;
}
