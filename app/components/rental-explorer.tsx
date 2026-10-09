"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Full document links avoid vinext production client-router failures. */
import { useEffect, useMemo, useState } from "react";
import { useRentalWebMCP } from "@/lib/use-rental-webmcp";
import { emptyFilters, matchesFilters, type Filters } from "@/lib/assistant";
import { ArrowDownUp, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Compass, Footprints, GraduationCap, Heart, MapPin, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CityMap from "@/components/city-map";
import RentalChat from "@/components/rental-chat";
import { emptyMapSelection, type MapSelection, type RentalState } from "@/lib/agent/contract";
import { cities, cityPhoto, getCity, listings, priceLabel, type CityId, type Listing } from "@/lib/rental-data";

export default function RentalExplorer() {
  const [cityId, setCityId] = useState<CityId>("london");
  const [picker, setPicker] = useState(false);
  const [country, setCountry] = useState<CityId | null>(null);
  const [selected, setSelected] = useState("london-1");
  const [routeTarget, setRouteTarget] = useState<string | null>(null);
  const [mapRequested, setMapRequested] = useState(false);
  const [details, setDetails] = useState<Listing | null>(null);
  const [filters, setFilters] = useState<Filters>({...emptyFilters});
  const roomType = filters.roomType;
  const setRoomType = (value: string) => changeFilters({...filters, roomType:value as Filters["roomType"]});
  const [mapSelection, setMapSelection] = useState<MapSelection>(emptyMapSelection);
  const [uiRevision, setUiRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [sort, setSort] = useState("recommended");
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [mobileTab, setMobileTab] = useState("list");
  const city = getCity(cityId);
  const shown = useMemo(() => listings.filter(l => l.cityId === cityId && matchesFilters(l, filters) && (!onlySaved || saved.includes(l.id))).sort((a, b) => sort === "price" ? a.price - b.price : 0), [cityId, filters, onlySaved, saved, sort]);
  const effectiveSelected = shown.some(l=>l.id===selected)?selected:(shown[0]?.id ?? "");
  useRentalWebMCP(city,shown,effectiveSelected);
  function changeFilters(next: Filters) {
    setFilters(next); setUiRevision(v => v + 1);
    const matching = listings.filter(l => l.cityId === cityId && matchesFilters(l, next));
    const id = matching.some(l => l.id === selected) ? selected : matching[0]?.id ?? selected;
    if (!matching.length || id !== selected) {
      setSelected(id); setRouteTarget(null);
      setMapSelection(current => ({...current, placeIds:null,selectedPlaceId:null,routePlaceId:null,campusRoute:false}));
      window.history.replaceState({}, "", `/?city=${cityId}&listing=${id}`);
    }
  }
  function selectListing(id: string) {
    setUiRevision(v => v + 1); setMapSelection(emptyMapSelection());
    setSelected(id); setRouteTarget(current => current === id ? current : null); setMobileTab("map");
    window.history.replaceState({}, "", `/?city=${cityId}&listing=${id}${routeTarget === id ? "&route=walk" : ""}`);
  }
  function showRoute(listing: Listing) {
    setUiRevision(v => v + 1); setMapSelection({...emptyMapSelection(), campusRoute:true});
    setSelected(listing.id); setRouteTarget(listing.id); setMapRequested(true); setDetails(null); setMobileTab("map");
    window.history.replaceState({}, "", `/?city=${listing.cityId}&listing=${listing.id}&route=walk`);
  }
  function clearRoute() {
    setUiRevision(v => v + 1); setMapSelection(s => ({...s,campusRoute:false})); setRouteTarget(null);
    const url = new URL(window.location.href); url.searchParams.delete("route");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
  function changeCity(id: CityId) { setRouteTarget(null); setCityId(id); setSelected(`${id}-1`); setFilters({...emptyFilters}); setOnlySaved(false); setMapSelection(emptyMapSelection()); setUiRevision(v => v + 1); setPicker(false); setCountry(null); window.history.pushState({}, "", `/?city=${id}`); }
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(window.location.search);
      const requested = cities.find(c => c.id === params.get("city"));
      if (requested) {setCityId(requested.id); const l = listings.find(l => l.id === params.get("listing") && l.cityId === requested.id); setSelected(l?.id ?? `${requested.id}-1`); setPicker(false); setRouteTarget(l && params.get("route") === "walk" ? l.id : null); if(l){setMobileTab("map"); if(params.get("route") === "walk")setMapRequested(true);}} else setPicker(true);
      setFilters({...emptyFilters});setMapSelection(emptyMapSelection());setUiRevision(v => v + 1);setReady(true);
    }
    restore();
    try {const stored = JSON.parse(localStorage.getItem("campus-atlas-saved") ?? "[]"); if(Array.isArray(stored)) {
      // Hydrate this browser's saved items after SSR; localStorage is an external system.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaved(stored.filter(id => typeof id === "string" && listings.some(l => l.id === id)));
    }}catch{}
    window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  }, []);
  function toggleSaved(id:string) {setSaved(v=>{const next=v.includes(id)?v.filter(x=>x!==id):[...v,id];try{localStorage.setItem("campus-atlas-saved",JSON.stringify(next));}catch{}return next;});}
  const agentState: RentalState = {cityId, listingId:effectiveSelected || selected, filters, map:{...mapSelection,campusRoute:routeTarget === effectiveSelected}};
  function applyAgentState(next: RentalState) {
    if (next.cityId !== cityId) return;
    setFilters(next.filters);setOnlySaved(false);setSelected(next.listingId);setMapSelection(next.map);
    setRouteTarget(next.map.campusRoute ? next.listingId : null);
    if (next.map.categories.length || next.map.campusRoute) setMapRequested(true);
    window.history.replaceState({}, "", `/?city=${cityId}&listing=${next.listingId}${next.map.campusRoute ? "&route=walk" : ""}`);
  }
  return <main className="explorer">
    <header className="topbar">
      <a className="brand" href="/" aria-label="远居首页"><span className="brand-mark"><Compass size={26}/></span><span>远居<span className="brand-en">CAMPUS ATLAS</span></span></a>
      <div className="main-nav"><button className={!onlySaved ? "active" : ""} onClick={() => setOnlySaved(false)}>发现新家</button><button onClick={() => setOnlySaved(v => !v)} className={onlySaved ? "active" : ""}>我的收藏 <span>{saved.length}</span></button></div>
      <div className="header-end"><span className="sample-badge">体验样本</span><span className="language">简体中文 · {city.currency}</span><span className="avatar">Y</span></div>
    </header>
    <section className="searchbar" aria-label="找房条件">
      <button className="location-switch" onClick={() => { setCountry(null); setPicker(true); }}><span className="flag">{city.flag}</span><span><small>国家 / 城市</small><strong>{city.country} · {city.name}</strong></span><ChevronDown size={16}/></button>
      <div className="campus-select"><GraduationCap size={23}/><span><small>你的大学</small><strong>{city.university}</strong></span><span className="campus-label">{city.campus}</span></div>
      <div className="filter-controls"><Select value={filters.budget?.toString() ?? "all"} onValueChange={v => changeFilters({...filters, budget:v === "all" ? null : Number(v)})}><SelectTrigger aria-label="预算"><SelectValue placeholder="租金预算"/></SelectTrigger><SelectContent><SelectItem value="all">租金不限</SelectItem>{Array.from(new Set([...city.prices, ...(filters.budget ? [filters.budget] : [])])).sort((a,b)=>a-b).map(p => <SelectItem key={p} value={p.toString()}>≤ {city.currency}{p.toLocaleString("en-US")} / {city.period}</SelectItem>)}</SelectContent></Select><Select value={roomType} onValueChange={setRoomType}><SelectTrigger aria-label="房型"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">全部房型</SelectItem>{["独卫单间", "独立 Studio", "合租单间"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><button className="filter-button" onClick={() => setOnlySaved(v => !v)}><Heart size={17} fill={onlySaved ? "currentColor" : "none"}/>{onlySaved ? "已收藏" : "收藏房源"}</button></div>
    </section>
    <nav className="mobile-tabs" aria-label="切换面板">{[["list","房源"],["map","城市"],["chat","助手"]].map(([id,label]) => <button key={id} className={mobileTab === id ? "active" : ""} onClick={() => setMobileTab(id)}>{label}</button>)}</nav>
    {(filters.walkMinutes || filters.safety || filters.shopping || filters.bills || filters.budget) && <div className="active-filters"><span>你的偏好</span>{filters.budget && <span>预算 ≤ {city.currency}{filters.budget} / {city.period}</span>}{filters.bills && <span>含水电网</span>}{filters.walkMinutes && <span >大学步行 ≤ {filters.walkMinutes} 分钟 · 路网估计</span>}{filters.safety && <span className="pending">区域安全 · 待核验</span>}{filters.shopping && <span className="pending">购物便利 · 待核验</span>}<button onClick={()=>changeFilters({...emptyFilters})}>清除偏好</button></div>}
    <div className={`workspace tab-${mobileTab}`}>
      <section className="listing-panel" aria-label="房源列表"><div className="list-heading"><div><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>在{city.name}，找到新家</h1><p><strong>{shown.length}</strong> 套演示房源 <span>· 大学校区周边</span></p></div><button className="sort-button" title="切换价格排序" aria-label="切换价格排序" onClick={() => setSort(s => s === "price" ? "recommended" : "price")}><ArrowDownUp size={18}/></button></div>
        <div className="list-meta"><span><span className="dot"/> {sort === "price" ? "价格从低到高" : "为留学生活而选"}</span><span>样本数据</span></div>
        <div className="listing-scroll">{shown.map((listing, i) => <ListingCard key={listing.id} listing={listing} selected={effectiveSelected === listing.id} saved={saved.includes(listing.id)} index={i} onSelect={() => selectListing(listing.id)} onRoute={() => showRoute(listing)} onDetail={() => setDetails(listing)} onSave={() => toggleSaved(listing.id)}/>)}{shown.length === 0 && <div className="empty-state"><Search/><h3>还没有符合条件的房源</h3><p>试试切换房型，或收藏一套喜欢的房源。</p><button onClick={() => {setOnlySaved(false);changeFilters({...emptyFilters});}}>重置筛选</button></div>}<p className="list-disclaimer">房源、位置与租金为虚构演示，图片为室内风格参考，不可预订。</p></div>
      </section>
      <CityMap city={city} listings={shown} selected={effectiveSelected} onSelect={selectListing} autoLoad={mapRequested} routeListingId={routeTarget === effectiveSelected ? routeTarget : null} onCloseRoute={clearRoute} selection={mapSelection} onSelectionChange={update => {setMapSelection(update);setUiRevision(v => v + 1);}}/>
      {ready && <RentalChat key={cityId} city={city} state={agentState} uiRevision={uiRevision} onState={applyAgentState}/>}
    </div>
    <Dialog open={picker} onOpenChange={setPicker}><DialogContent className="destination-dialog sm:max-w-[720px]"><DialogTitle>{country ? "下一站，选择你的城市" : "你的留学生活，从哪里开始？"}</DialogTitle><DialogDescription>01 选择国家 / 地区 <span className={country ? "step-active" : ""}>—— 02 选择城市</span></DialogDescription>{!country ? <div className="destination-grid">{cities.map(c => <button key={c.id} onClick={() => setCountry(c.id)}><span>{c.flag}</span><strong>{c.country}</strong><small>1 座城市</small><ArrowRight size={17}/></button>)}</div> : <><button className="back-link" onClick={() => setCountry(null)}><ChevronLeft size={16}/> 返回国家 / 地区</button><button className="city-choice" onClick={() => changeCity(country)}><img src={cityPhoto(country)} alt=""/><div><small>{getCity(country).country}</small><h3>{getCity(country).name} <span>{getCity(country).english}</span></h3><p>{getCity(country).university}</p><span className="city-choice-cta">开始探索 <ArrowRight size={17}/></span></div></button></>}<p className="dialog-footnote">首批开放 5 座城市 · 悉尼为澳大利亚体验城市</p></DialogContent></Dialog>
    <Dialog open={!!details} onOpenChange={open => {if(!open)setDetails(null);}}><DialogContent className="detail-dialog sm:max-w-[780px]">{details && <><DialogTitle>{details.name}</DialogTitle><DialogDescription>{getCity(details.cityId).name} · {details.area} · 演示房源</DialogDescription><img className="detail-photo" src={details.photos[0]} alt="演示房源室内风格参考"/><div className="detail-row"><div><h3>{details.roomType} · {details.size} m²</h3><p>{details.bills ? "演示条件：租金包含水电网" : "演示条件：账单另计"}</p></div><div className="price">{priceLabel(details)}<small> / {getCity(details.cityId).period}</small></div></div><p className="detail-note">这是用于验证找房体验的虚构房源。照片仅为风格参考；地址、租金、房型与账单条件均为样本。可查看基于真实路网计算的步行路线；楼门、校门、安全和购物便利度仍待核验。</p><div className="detail-actions"><a className="primary-button" href={`/listing/${details.id}`}>打开完整详情 <ArrowRight size={17}/></a><button className="secondary-button" onClick={() => {selectListing(details.id);setDetails(null);}}>在城市中定位 <MapPin size={17}/></button><button className="secondary-button" onClick={() => showRoute(details)}>到学校路线 <Footprints size={17}/></button></div></>}</DialogContent></Dialog>
  </main>;
}
function ListingCard({listing, selected, saved, index, onSelect, onDetail, onSave, onRoute}: {listing: Listing; selected: boolean; saved: boolean; index: number; onSelect: () => void; onDetail: () => void; onSave: () => void; onRoute: () => void}) {
  const [photo, setPhoto] = useState(0);
  return <article className={`listing-card ${selected ? "selected" : ""}`}><div className="listing-image"><button className="photo-open" onClick={onDetail} aria-label={`查看 ${listing.name} 详情`}><img src={listing.photos[photo]} alt={`${listing.name} 室内风格参考 ${photo + 1}`} loading={index < 2 ? "eager" : "lazy"}/></button><span className="photo-tag">{listing.roomType}</span><button className={`save-button ${saved ? "saved" : ""}`} onClick={onSave} aria-label={`${saved ? "取消收藏" : "收藏"} ${listing.name}`}><Heart size={18} fill={saved ? "currentColor" : "none"}/></button><button className="photo-arrow left" onClick={() => setPhoto(p => (p + 2) % 3)} aria-label={`${listing.name} 上一张照片`}><ChevronLeft size={17}/></button><button className="photo-arrow right" onClick={() => setPhoto(p => (p + 1) % 3)} aria-label={`${listing.name} 下一张照片`}><ChevronRight size={17}/></button><div className="photo-dots">{listing.photos.map((_, i) => <span key={i} className={photo === i ? "active" : ""}/>)}</div><span className="demo-photo">风格参考</span></div><div className="listing-body"><div className="listing-title"><button onClick={onDetail}>{listing.name}</button><button className={`locate-button ${selected ? "active" : ""}`} onClick={onSelect} aria-label={`在地图定位 ${listing.name}`}><MapPin size={17}/></button></div><p className="listing-area"><MapPin size={13}/>{listing.area} <span>· {listing.size} m²</span></p><div className="listing-tags"><span>配备家具</span><span>{listing.bills ? "含水电网" : "账单另计"}</span><span>演示房源</span></div><div className="listing-price-row"><span className="price">{priceLabel(listing)}<small> / {getCity(listing.cityId).period}</small></span><button onClick={onDetail}>查看详情 <ArrowRight size={15}/></button></div><button className="listing-route-button" onClick={onRoute} aria-label={`查看 ${listing.name} 到学校的步行路线`}><Footprints size={16}/>到学校路线<ArrowRight size={14}/></button></div></article>;
}
