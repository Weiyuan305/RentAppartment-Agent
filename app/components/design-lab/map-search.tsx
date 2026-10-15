"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Building2, GraduationCap, MapPin, Scan, Search, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { displayCity, displayDistance } from "@/lib/i18n";
import { metersBetween } from "@/lib/walking-route";
import { mapSearchIndex, searchMapPlaces, type MapSearchResult } from "@/lib/map-place-search";
import type { City, Listing } from "@/lib/rental-data";
import type { CityAmenities } from "@/lib/amenities";

export default function MapSearch({ city, homes, selectedHome, amenities, amenitiesStatus, onRetry, open, onOpenChange, onSelect, live, onFilterArea, areaActive, areaResultCount, areaError }: {
  city: City; homes: Listing[]; amenities: CityAmenities | null; amenitiesStatus: "idle" | "loading" | "ready" | "error"; onRetry: () => void;
  selectedHome?: Listing;
  open: boolean; onOpenChange: (open: boolean) => void; onSelect: (result: MapSearchResult) => void;
  live: boolean; onFilterArea: () => void; areaActive: boolean; areaResultCount: number; areaError: boolean;
}) {
  const { locale } = useLocale(), w = (zh: string, en: string) => locale === "zh" ? zh : en;
  const [query, setQuery] = useState("");
  const [activeResult,setActiveResult]=useState("");
  const list=useRef<HTMLDivElement>(null), scrollTop=useRef(0), restoring=useRef(false), rememberedResult=useRef("");
  function changeOpen(next:boolean){restoring.current=next;onOpenChange(next);}
  useEffect(()=>{
    if(!open)return;
    restoring.current=true;
    const frame=requestAnimationFrame(()=>{
      const exists=Array.from(list.current?.querySelectorAll("[cmdk-item]")??[]).some(item=>item.getAttribute("data-value")===rememberedResult.current);
      if(exists)setActiveResult(rememberedResult.current);
      if(list.current)list.current.scrollTop=scrollTop.current;
      restoring.current=false;
    });
    return()=>{cancelAnimationFrame(frame);restoring.current=false;};
  },[open]);
  const input = useRef<HTMLInputElement>(null), labelId = useId(), scopeId = useId();
  const index = useMemo(() => mapSearchIndex(city, homes, amenities, locale), [city, homes, amenities, locale]);
  const origin = selectedHome ?? city;
  const { results, total } = useMemo(() => searchMapPlaces(index, query, [origin.lng, origin.lat]), [index, query, origin]);
  const groups=[
    {label:w("房源","Homes"),items:results.filter(result=>result.kind==="home")},
    {label:w("校园","Campus"),items:results.filter(result=>result.kind==="campus"||result.kind==="building")},
    {label:w("生活设施","Nearby places"),items:results.filter(result=>result.kind==="amenity")},
  ].filter(group=>group.items.length);
  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild><button className="map-search-trigger" aria-label={w("搜索房源与地点", "Search homes and places")} title={w("搜索房源与地点", "Search homes and places")}><Search size={16}/><span>{w("搜索", "Search")}</span></button></PopoverTrigger>
    <PopoverContent className="map-place-search" align="end" sideOffset={8} collisionPadding={12} aria-labelledby={labelId} onOpenAutoFocus={event => {event.preventDefault(); input.current?.focus();}}>
      <div className="map-search-heading"><label id={labelId} htmlFor={`${labelId}-input`}>{w("搜索房源与地点", "Search homes and places")}</label><button aria-label={w("关闭搜索", "Close search")} onClick={() => changeOpen(false)}><X size={16}/></button></div>
      <p className="map-search-scope" id={scopeId}>{w(`仅限${displayCity(city, locale).name}已收录地点 · 房源沿用当前筛选`, `Listed places in ${city.english} · Homes follow current filters`)}</p>
      <Command shouldFilter={false} value={activeResult} onValueChange={value=>{setActiveResult(value);if(!restoring.current)rememberedResult.current=value;}} loop label={w("地点搜索结果", "Place search results")}>
        <CommandInput ref={input} id={`${labelId}-input`} value={query} onValueChange={value=>{setQuery(value);scrollTop.current=0;if(list.current)list.current.scrollTop=0;}} aria-describedby={scopeId} placeholder={w("输入公寓、楼栋或便利店名称…", "Home, building or convenience store…")}/>
        <div className="map-search-count" role="status">{query.trim() ? w(`找到 ${total} 个地点${total > results.length ? ` · 显示前 ${results.length} 个` : ""}`, `${total} places found${total > results.length ? ` · Showing ${results.length}` : ""}`) : w("当前房源与校园", "Current homes and campus")}</div>
        <CommandList ref={list} onScroll={event=>{if(!restoring.current)scrollTop.current=event.currentTarget.scrollTop;}} aria-label={w("地点搜索结果", "Place search results")}>
          {groups.map(group=><CommandGroup key={group.label} heading={group.label}>{group.items.map(result => <CommandItem key={`${result.kind}:${result.id}`} value={`${result.kind}:${result.id}`} onSelect={() => {scrollTop.current=list.current?.scrollTop??0;setActiveResult(`${result.kind}:${result.id}`);onSelect(result);}}>
            {result.kind === "home" ? <Building2/> : result.kind === "building" || result.kind === "campus" ? <GraduationCap/> : <MapPin/>}
            <span className="map-search-result"><strong title={result.name}>{result.name}</strong><small title={result.detail}>{result.kind === "home" ? `${w("演示房源", "Demo home")} · ` : ""}{result.detail}</small>{result.kind === "amenity" && <small>{selectedHome ? w(`距 ${selectedHome.name} 直线`, `From ${selectedHome.name}, straight line`) : w("距校园中心直线", "From campus centre, straight line")} · {displayDistance(metersBetween([origin.lng,origin.lat],[result.lng,result.lat]),locale)}</small>}</span><ArrowUpRight className="map-search-result-arrow"/>
          </CommandItem>)}</CommandGroup>)}
          {query.trim() && !results.length && <p className="map-search-empty">{w("未找到匹配地点。试试更短的名称，或“便利店”“图书馆”等类别；此处不搜索全城地址。", "No matching places. Try a shorter name or a category such as “convenience store”. This searches our catalog, not every address.")}</p>}
        </CommandList>
      </Command>
      {(amenitiesStatus === "loading" || amenitiesStatus === "idle") && <p className="map-search-data" role="status">{w("正在加载生活地点…", "Loading nearby places…")}</p>}
      {amenitiesStatus === "error" && <div className="map-search-data" role="alert">{w("生活地点暂未加载，房源和校园仍可搜索。", "Nearby places unavailable. Homes and campus search still work.")}<button onClick={onRetry}>{w("重试", "Retry")}</button></div>}
      <div className="map-search-area-action"><button disabled={!live} onClick={onFilterArea}><Scan size={16}/>{w("筛选地图内房源", "Filter homes in view")}</button>
        <p role={areaError ? "alert" : "status"}>{areaError ? w("请将视角朝向地面后重试。", "Tilt toward the ground, then retry.") : !live ? w("加载实景地图后可按范围筛选。", "Load the map to filter by its visible area.") : areaActive ? w(`范围筛选已生效 · ${areaResultCount} 套房源`, `Area filter applied · ${areaResultCount} homes`) : w("按当前可见范围筛选左侧房源，无需输入关键词。", "Filter homes by the visible map area. No keywords needed.")}</p>
      </div>
    </PopoverContent>
  </Popover>;
}
