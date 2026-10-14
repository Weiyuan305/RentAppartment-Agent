"use client";
import { displayDistance } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import { useMemo, useState, type CSSProperties } from "react";
import { Icon, X, LocateFixed, List, LoaderCircle, ExternalLink, SlidersHorizontal, Footprints } from "lucide-react";
import { amenityCategories, amenityGroups, primaryAmenityCategories, amenityInfo, matchesAmenityCategory, amenitySourceUrl, amenityCuisines, type Amenity, type AmenityCategory, type CityAmenities } from "@/lib/amenities";
import { amenityIconNodes } from "@/lib/amenity-icons";
import type { Listing } from "@/lib/rental-data";
import { metersBetween, routeMinutes, type WalkingRoute } from "@/lib/walking-route";

const cuisineNames: Record<string, string> = { chinese:"中餐", japanese:"日料", korean:"韩餐", thai:"泰餐", indian:"印度菜", vietnamese:"越南菜", asian:"亚洲菜", italian:"意大利菜", pizza:"披萨", burger:"汉堡", sandwich:"三明治", coffee_shop:"咖啡", regional:"当地菜", international:"国际菜", malaysian:"马来西亚菜", seafood:"海鲜", vegetarian:"素食" };
export default function AmenityControls({ categories, data, status, visible, selected, listing, radius, cuisine, onRadius, onCuisine, onToggle, onSelect, onDismiss, onFit, onRetry, onExplore, onClear }: {
  categories: AmenityCategory[]; data: CityAmenities | null; status: "idle" | "loading" | "ready" | "error";
  visible: Amenity[]; selected: Amenity | undefined; listing: Listing | undefined; radius: number; cuisine: string;
  onRadius: (radius: number) => void; onCuisine: (cuisine: string) => void; onExplore: () => void; onClear: () => void;
  onToggle: (category: AmenityCategory) => void; onSelect: (id: string) => void;
  onDismiss: () => void; onFit: () => void; onRetry: () => void;
}) {
  const {t, locale} = useLocale();
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
      <input type="checkbox" checked={categories.includes(category)} onChange={() => {setListOpen(false); onToggle(category);}} aria-label={t("显示{0}", {0:info.name})}/>
      <Icon iconNode={amenityIconNodes[category]} size={14}/><span>{t(info.name)}</span>{count && <small>{total ?? "—"}</small>}
    </label>;
  }
  return <div className="map-amenities">
    <div className="amenity-filters">
      <fieldset aria-label={t("地图周边设施")}><legend className="sr-only">{t("勾选要显示的设施，可多选")}</legend>{primaryAmenityCategories.map(c => option(c))}</fieldset>
      <div className="amenity-tools"><button className={moreOpen ? "active" : ""} aria-expanded={moreOpen} aria-controls="more-amenities" onClick={() => {setMoreOpen(v => !v); setListOpen(false); onExplore();}}><SlidersHorizontal size={12}/>{t("更多设施")}{extraCount > 0 && <b>{extraCount}</b>}</button>
        {categories.length > 0 && <button onClick={onClear}>{t("清除勾选")}</button>}
      </div>
      <div className="amenity-status" aria-live="polite">
        {status === "idle" && <span>{t("大学周边 3 km · 勾选显示")}</span>}
        {status === "loading" && <span><LoaderCircle size={11} className="route-spinner"/>{t("正在读取地点…")}</span>}
        {status === "error" && <><span>{t("地点暂时无法读取")}</span><button onClick={onRetry}>{t("重试")}</button></>}
        {status === "ready" && <><span>{t("显示 {count} 处",{count:visible.length})}</span><button aria-expanded={listOpen && !selected} onClick={() => {onDismiss(); setMoreOpen(false); setListLimit(40); setListOpen(v => !v);}}><List size={11}/>{t("列表")}</button><button onClick={() => {setMoreOpen(false); onFit();}} disabled={!visible.length}><LocateFixed size={11}/>{t("查看周边")}</button></>}
      </div>
      {moreOpen && <div className="amenity-more" id="more-amenities" onKeyDown={e => {if (e.key === "Escape") setMoreOpen(false);}}>
        <div className="amenity-list-heading"><strong>{t("学生生活地图")}</strong><button aria-label={t("关闭更多设施")} onClick={() => setMoreOpen(false)}><X size={15}/></button></div>
        <p className="amenity-more-note">{t("大学周边 3 公里快照 · 可多选")}</p>
        {amenityGroups.map(group => <fieldset key={t(group.name)}><legend>{t(group.name)}</legend><div>{group.categories.map(c => option(c, true))}</div></fieldset>)}
        <div className="amenity-refinements"><label>{t("距离范围")}<select aria-label={t("设施距离范围")} value={radius} onChange={e => onRadius(Number(e.target.value))}>{![0,500,1000,2000].includes(radius) && <option value={radius}>{t("距{origin}直线 {distance} 米内",{origin:listing ? "公寓" : "大学",distance:radius})}</option>}<option value={0}>{t("全部校区范围")}</option>{[500,1000,2000].map(distance => <option key={distance} value={distance}>{t("距{origin}直线 {distance} 米内",{origin:listing ? "公寓" : "大学",distance})}</option>)}</select></label>
          <label>{t("餐饮菜系")}<select aria-label={t("餐饮菜系")} value={cuisine} onChange={e => onCuisine(e.target.value)}><option value="">{t("全部菜系")}</option>{[...new Set([...cuisines, ...(cuisine ? [cuisine] : [])])].map(c => <option key={c} value={c}>{t(cuisineNames[c] ?? c)}</option>)}</select></label>
        </div>
        <p className="amenity-list-note">{t("数字为快照收录数，0 不代表附近没有。亚洲食品店按原始标签识别，自习空间补充大学官方资料。大学建筑可能包括教学、研究及行政用途；开放时间和使用资格请向场所确认。")}</p>
        <button className="amenity-done" onClick={() => setMoreOpen(false)}>{t("完成选择 · 显示 {count} 处",{count:visible.length})}</button>
      </div>}
    </div>
    {listOpen && !selected && data && categories.length > 0 && <div className="amenity-list" aria-label={t("已显示的设施列表")}>
      <div className="amenity-list-heading"><strong>{listing ? t("公寓周边") : t("周边地点")} <span>{visible.length}</span></strong><button onClick={() => setListOpen(false)} aria-label={t("收起设施列表")}><X size={14}/></button></div>
      <ul>{visible.slice(0, listLimit).map(place => <li key={place.id}><button onClick={() => {setListOpen(false); onSelect(place.id);}}><Icon iconNode={amenityIconNodes[place.category]} size={14} style={{color:amenityInfo[place.category].color}}/><span>{place.name}</span><small>{displayDistance(metersBetween(origin, [place.lng, place.lat]),locale)}</small></button></li>)}</ul>
      {visible.length > listLimit && <button className="amenity-load-more" onClick={() => setListLimit(n => n + 40)}>{t("再显示 40 处")}</button>}
      {!visible.length && <p className="amenity-empty">{t("当前筛选没有收录地点，试试其他类别或扩大距离范围。")}</p>}
      <p className="amenity-list-note">{t("按距{origin}的直线距离排序。点击地点可计算真实步行路线；站点位置不代表实时班次，医院分类可能包含院内设施。",{origin:listing ? "所选公寓" : "大学"})}</p>
    </div>}
    {data && <p className="amenity-credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · {new Date(data.source.collectedAt).toLocaleDateString(locale === "en" ? "en-GB" : "zh-CN", {timeZone:"Asia/Shanghai"})} {t("快照 · 可能缺漏，营业状态未核验")}</p>}
  </div>;
}

export function AmenityDetails({ place, listing, route, routeStatus, routeError, onRoute, onFitRoute, onClearRoute, onClose }: {
  place: Amenity; listing: Listing | undefined; route: WalkingRoute | null; routeStatus: "idle" | "loading" | "ready" | "error"; routeError?: string;
  onRoute: () => void; onFitRoute: () => void; onClearRoute: () => void; onClose: () => void;
}) {
  const {t, locale} = useLocale();
  const stationLines = ["rail", "bus"].includes(place.category) ? place.tags.route_ref || place.tags.network : undefined;
  const facts = <>
    {place.address && <p>{place.address}</p>}
    {stationLines && <p>{t("交通记录：")}{stationLines}{place.tags.ref ? ` · ${place.tags.ref}` : ""} {t("· 非实时班次")}</p>}
    {place.tags.cuisine && <p>{t("菜系：")}{amenityCuisines(place.tags.cuisine).map(c => t(cuisineNames[c] ?? c)).join("、")}</p>}
    {place.tags.access && <p>{t("通行记录：")}{place.tags.access} {t("· 进入资格待核验")}</p>}
    {place.tags.operator && <p>{t("运营机构：")}{place.tags.operator}</p>}
    {place.studySource && <p className="amenity-study-source">{t("已收录自习空间 ·")} <a href={place.studySource} target="_blank" rel="noreferrer">{t("大学官方介绍")}<ExternalLink size={10}/></a> {t("· 使用资格请确认")}</p>}
  </>;
  return <div className={`amenity-popup map-amenity-selected${route ? " amenity-route-ready" : ""}`} aria-label={t("设施信息")}>
    <div className="amenity-popup-heading"><span style={{color:amenityInfo[place.category].color}}><Icon iconNode={amenityIconNodes[place.category]} size={14}/>{t(amenityInfo[place.category].name)}</span><button onClick={onClose} aria-label={t("关闭设施信息")}><X size={16}/></button></div>
    <strong>{place.name}</strong>
    {listing && <p>{t("距所选公寓直线")} {displayDistance(metersBetween([listing.lng, listing.lat], [place.lng, place.lat]),locale)}</p>}
    {!route && <div className="amenity-facts">{facts}</div>}
    {listing && <div className="amenity-walk" aria-live="polite">
      {routeStatus === "idle" && <button className="listing-route-button" onClick={onRoute}><Footprints size={15}/>{t("从公寓步行到这里")}</button>}
      {routeStatus === "loading" && <p className="route-message"><LoaderCircle size={15} className="route-spinner"/>{t("正在计算真实步行路线…")}</p>}
      {routeStatus === "error" && <div className="amenity-route-error"><p>{t(routeError || "暂时无法计算步行路线，请稍后重试。") }</p><button onClick={onRoute}>{t("重试路线")}</button></div>}
      {route && <><div className="route-metrics"><strong>{t("约")} {routeMinutes(route.durationSeconds)} <span>{t("分钟")}</span></strong><span>{displayDistance(route.distanceMeters,locale)} {t("· 步行")}</span><button onClick={onFitRoute}>{t("查看全程")}</button></div>
        <p className="route-note">{t("路网估计 · 演示公寓位置，场所入口待核验")}</p>
        {(route.startOffsetMeters > 40 || route.endOffsetMeters > 40) && <p className="route-snap">{t("路线匹配道路的偏移：公寓")} {route.startOffsetMeters} {t("米，目的地")} {route.endOffsetMeters} {t("米，未计入时间。")}</p>}
        <details className="route-directions"><summary>{t("路线详情")}<span>{route.steps.length} {t("段指引")}</span></summary><ol>{route.steps.map((s, i) => <li key={i}><span>{s.instruction}</span>{s.distanceMeters > 0 && <small>{displayDistance(s.distanceMeters,locale)}</small>}</li>)}</ol><p className="route-date">{t("计算于")} {new Date(route.source.calculatedAt).toLocaleDateString(locale === "en" ? "en-GB" : "zh-CN", {timeZone:"Asia/Shanghai"})} {t("· 非实时导航")}</p></details>
        <div className="amenity-route-source"><span>© OpenStreetMap · <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">OSRM</a></span><button onClick={onClearRoute}>{t("收起地点路线")}</button></div>
      </>}
    </div>}
    {route && <details className="amenity-facts"><summary>{t("地点资料与使用资格")}</summary>{facts}</details>}
    <div className="amenity-record"><span>{place.locationType === "area-center" ? t("区域中心，非入口") : t("地图记录位置")}</span><a href={amenitySourceUrl(place)} target="_blank" rel="noreferrer">{t("查看来源")}<ExternalLink size={10}/></a><a href={`https://www.openstreetmap.org/edit?${place.id.replace("/", "=")}`} target="_blank" rel="noreferrer">{t("纠正地图")}</a></div>
  </div>;
}
