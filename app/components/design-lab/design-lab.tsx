"use client";
import { displayCity, displayArea } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
/* eslint-disable @next/next/no-html-link-for-pages -- Full document links avoid vinext production client-router failures. */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useRentalWebMCP } from "@/lib/use-rental-webmcp";
import { LanguageSwitch } from "@/components/language-switch";
import { AccountMenu } from "@/components/account-menu";
import { emptyFilters, matchesFilters, type Filters } from "@/lib/assistant";
import { ArrowDownUp, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Compass, Footprints, GraduationCap, Heart, MapPin, Search, Play, Square, ArrowUpRight, Layers3, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, Maximize2, Minimize2, RotateCcw, LocateFixed } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CityMap from "./concept-city-map";
import { LibrarySyncStatus, usePersonalLibrary } from "@/components/personal-library-provider";
import DecisionSummary from "@/components/student/decision-summary";
import { ListingDossierDialog } from "@/components/student/listing-dossier";
import {emptyStudentPlan,type StudentPlan} from "@/lib/student/state";
import {validateStudentPlan} from "@/lib/student/planner";
import {buildingById} from "@/lib/student/catalog";
const StudentPlanner=lazy(()=>import("@/components/student/student-planner"));
const ApartmentComparison=lazy(()=>import("@/components/student/apartment-comparison"));
import DestinationPicker from "@/components/destination-picker";
import { useWorkspaceLayout } from "@/components/use-workspace-layout";
import RentalChat from "@/components/rental-chat";
import { emptyMapSelection, type MapSelection, type RentalState } from "@/lib/agent/contract";
import { cities, getCity, listings, priceLabel, type CityId, type Listing } from "@/lib/rental-data";

export default function DesignLab({preview = true}: {preview?: boolean}) {
  const {t, locale} = useLocale();
  const [variant, setVariant] = useState<"editorial" | "spatial">(preview ? "editorial" : "spatial");
  const [sampleStage, setSampleStage] = useState<"idle" | "select" | "detail" | "route">("idle");
  const [playing, setPlaying] = useState(false);
  const [details, setDetails] = useState<Listing | null>(null);
  const [dossier,setDossier]=useState<Listing|null>(null);
  const [mapNotice,setMapNotice]=useState(false);
  const [detailPhoto, setDetailPhoto] = useState("");
  const detailImage = useRef<HTMLImageElement>(null);
  const photoOrigin = useRef<{rect:DOMRect; source:HTMLImageElement} | null>(null);
  const flight = useRef<{animation:Animation; image:HTMLImageElement} | null>(null);
  const sample = useRef<AbortController | null>(null);
  const closing = useRef(false);
  const words = (zh:string, en:string) => locale === "zh" ? zh : en;
  function explorerUrl(id: CityId, listingId?: string, walking = false, planning:StudentPlan=student) {
    const params = new URLSearchParams({city:id});
    if (preview) params.set("variant",variant);
    if (listingId) params.set("listing",listingId);
    if (walking) params.set("route","walk");
    params.set("building",planning.destinationId??"university-default");
    params.set("compare",planning.compareIds.join(","));
    return `${preview ? "/design-lab" : "/"}?${params}`;
  }
  function stopSample() {sample.current?.abort(); sample.current = null; setPlaying(false);}
  function switchVariant(next:"editorial" | "spatial") {
    stopSample(); setVariant(next);
    const url = new URL(window.location.href); url.searchParams.set("variant",next);
    window.history.replaceState({}, "", url.pathname + url.search);
  }
  function openDetails(listing:Listing) {
    const image = document.querySelector<HTMLImageElement>(`.concept-lab [data-listing-id="${listing.id}"] .photo-open img`);
    photoOrigin.current = image ? {rect:image.getBoundingClientRect(),source:image} : null;
    setDetailPhoto(image?.getAttribute("src") ?? listing.photos[0]); setDetails(listing);
  }
  async function animatePhoto(reverse=false) {
    const target = detailImage.current, origin = photoOrigin.current;
    if (!target || !origin || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    flight.current?.animation.cancel(); flight.current?.image.remove();
    const to = target.getBoundingClientRect();
    const from = reverse ? origin.source.getBoundingClientRect() : origin.rect;
    if (from.width < 1 || to.width < 1 || from.bottom < 0 || from.top > innerHeight) return;
    const clone = new Image(); clone.src = target.src; clone.alt = "";
    clone.setAttribute("aria-hidden","true");
    Object.assign(clone.style,{position:"fixed",left:`${to.left}px`,top:`${to.top}px`,width:`${to.width}px`,height:`${to.height}px`,objectFit:"cover",zIndex:"100",pointerEvents:"none",transformOrigin:"top left",borderRadius:"12px"});
    document.body.appendChild(clone); target.style.opacity="0";
    const transform = `translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`;
    const animation = clone.animate(reverse ? [{transform:"none"},{transform}] : [{transform},{transform:"none"}], {duration:280,easing:"cubic-bezier(0.77,0,0.175,1)",fill:"both"});
    flight.current = {animation,image:clone};
    try {await animation.finished;} catch {} finally {
      clone.remove(); target.style.opacity="";
      if (flight.current?.animation === animation) flight.current = null;
    }
  }
  async function closeDetails() {
    if (closing.current) return;
    closing.current=true;
    await animatePhoto(true); setDetails(null); closing.current=false;
  }
  useEffect(() => () => {sample.current?.abort();flight.current?.animation.cancel();flight.current?.image.remove();}, []);
  const [cityId, setCityId] = useState<CityId>("london");
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState("london-1");
  const [routeTarget, setRouteTarget] = useState<string | null>(null);
  const [mapRequested, setMapRequested] = useState(preview);
  const [filters, setFilters] = useState<Filters>({...emptyFilters});
  const [student,setStudent]=useState<StudentPlan>(emptyStudentPlan);
  const [plannerOpen,setPlannerOpen]=useState(false),[comparisonOpen,setComparisonOpen]=useState(false);
  const roomType = filters.roomType;
  const setRoomType = (value: string) => changeFilters({...filters, roomType:value as Filters["roomType"]});
  const [mapSelection, setMapSelection] = useState<MapSelection>(emptyMapSelection);
  const [uiRevision, setUiRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [sort, setSort] = useState("recommended");
  const library = usePersonalLibrary();
  const saved = Object.keys(library.favorites).filter(id=>library.favorites[id].saved);
  const [onlySaved, setOnlySaved] = useState(false);
  const [mobileTab, setMobileTab] = useState("list");
  const workspace = useWorkspaceLayout();
  const listHidden = variant === "spatial" && workspace.listHidden, chatHidden = variant === "spatial" && workspace.chatHidden;
  const [hoveredListing, setHoveredListing] = useState<string | null>(null);
  const [unreadReply, setUnreadReply] = useState(false);
  const hiddenChat = useRef(false);
  useEffect(() => {hiddenChat.current = chatHidden;}, [chatHidden]);
  function scrollListing(id: string) {
    requestAnimationFrame(() => {
      const scroller = document.querySelector<HTMLElement>(".concept-lab .listing-scroll");
      const card = Array.from(scroller?.querySelectorAll<HTMLElement>("[data-listing-id]") ?? []).find(node => node.dataset.listingId === id);
      if (scroller && card) {
        const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTo({top: Math.max(0, top - 8), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
      }
    });
  }
  function togglePanel(panel: "list" | "chat") {
    const closing = panel === "list" ? !listHidden : !chatHidden;
    if (closing) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-workspace-restore="${panel}"]`)?.focus());
    workspace.dispatch(panel);
    if (panel === "chat") setUnreadReply(false);
    setHoveredListing(null);
  }
  useEffect(() => {const frame=requestAnimationFrame(() => window.dispatchEvent(new Event("atlas-workspace-layout")));return () => cancelAnimationFrame(frame);}, [listHidden,chatHidden]);
  function onReplyReady() {if (hiddenChat.current) setUnreadReply(true);}

  const city = getCity(cityId);
  const cityView = displayCity(city, locale);
  const shown = listings.filter(l => l.cityId === cityId && matchesFilters(l, filters,student) && (!onlySaved || saved.includes(l.id))).sort((a, b) => sort === "price" ? a.price - b.price : 0);
  const effectiveSelected = shown.some(l=>l.id===selected)?selected:(shown[0]?.id ?? "");
  useRentalWebMCP(city,shown,effectiveSelected);
  async function playSample() {
    stopSample();
    const controller = new AbortController(); sample.current=controller; setPlaying(true);
    const wait = (ms:number) => new Promise<void>((resolve,reject) => {
      if(controller.signal.aborted) {reject(new DOMException("Stopped","AbortError"));return;}
      const timer=setTimeout(resolve,ms);
      controller.signal.addEventListener("abort",()=>{clearTimeout(timer);reject(new DOMException("Stopped","AbortError"));},{once:true});
    });
    try {
      if (details) await closeDetails();
      if(controller.signal.aborted) return;
      const listing = shown[1] ?? shown[0]; if (!listing) return;
      clearRoute(true); setSampleStage("select"); selectListing(listing.id,true); setMobileTab("list"); setMapRequested(true);
      document.querySelector(`[data-listing-id="${listing.id}"]`)?.scrollIntoView({block:"nearest",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
      await wait(1100); setSampleStage("detail"); openDetails(listing);
      await wait(2100); await closeDetails(); await wait(300);
      setSampleStage("route"); showRoute(listing,true); await wait(1800);
    } catch (error) {if (!(error instanceof DOMException && error.name === "AbortError")) throw error;}
    finally {if (sample.current === controller) {setPlaying(false);sample.current=null;}}
  }
  function changeFilters(next: Filters) {
    stopSample();
    setFilters(next); setUiRevision(v => v + 1);
    const matching = listings.filter(l => l.cityId === cityId && matchesFilters(l, next,student));
    const id = matching.some(l => l.id === selected) ? selected : matching[0]?.id ?? selected;
    if (!matching.length || id !== selected) {
      setSelected(id); setRouteTarget(null);
      setMapSelection(current => ({...current, placeIds:null,selectedPlaceId:null,routePlaceId:null,campusRoute:false}));
      window.history.replaceState({}, "", explorerUrl(cityId,id));
    }
  }
  function changeStudent(input:StudentPlan,preferredListingId=selected) {
    const next=validateStudentPlan(input,cityId);stopSample();setStudent(next);setUiRevision(v=>v+1);
    const matching=listings.filter(l=>l.cityId===cityId&&matchesFilters(l,filters,next));
    const id=matching.some(l=>l.id===preferredListingId)?preferredListingId:matching[0]?.id??selected;
    if(next.destinationId!==student.destinationId||id!==selected){setSelected(id);setRouteTarget(null);setMapSelection(s=>({...s,selectedPlaceId:null,routePlaceId:null,campusRoute:false}));}
    if(next.showBuildings||next.routeBuilding||next.catchmentMinutes||next.transitRequested)setMapRequested(true);
    window.history.replaceState({},"",explorerUrl(cityId,id,false,next));
  }
  function resetRentalFilters(){
    stopSample();setFilters({...emptyFilters});setStudent(s=>({...s,housing:emptyStudentPlan().housing}));setOnlySaved(false);setUiRevision(v=>v+1);
  }
  function toggleCompare(id:string){
    if(student.compareIds.includes(id))changeStudent({...student,compareIds:student.compareIds.filter(x=>x!==id)});
    else if(student.compareIds.length<3)changeStudent({...student,compareIds:[...student.compareIds,id]});
    else setComparisonOpen(true);
  }
  function selectBuilding(id:string){const b=buildingById(id);if(b&&b.cityId===cityId){changeStudent({...student,destinationId:id,campusId:b.campusId,showBuildings:true,routeBuilding:false,transitRequested:false});setMobileTab("map");}}
  function showStudentJourney(transit=false){changeStudent({...student,routeBuilding:!transit,transitRequested:transit,showBuildings:true});setRouteTarget(null);setMapSelection(s=>({...s,campusRoute:false,routePlaceId:null,selectedPlaceId:null}));setMapRequested(true);setMobileTab("map");}
  function selectListing(id: string, fromSample=false) {
    if (fromSample !== true) stopSample();
    setUiRevision(v => v + 1); setMapSelection(emptyMapSelection());
    setSelected(id); setRouteTarget(current => fromSample === true ? null : current === id ? current : null); setMobileTab("map");
    window.history.replaceState({}, "", explorerUrl(cityId,id,fromSample !== true && routeTarget === id));
  }
  function showRoute(listing: Listing, fromSample=false) {
    if (fromSample !== true) stopSample();
    if(student.destinationId){setSelected(listing.id);changeStudent({...student,routeBuilding:true,transitRequested:false},listing.id);setMapRequested(true);setDetails(null);setMobileTab("map");return;}
    setUiRevision(v => v + 1); setMapSelection({...emptyMapSelection(), campusRoute:true});
    setSelected(listing.id); setRouteTarget(listing.id); setMapRequested(true); setDetails(null); setMobileTab("map");
    window.history.replaceState({}, "", explorerUrl(listing.cityId,listing.id,true));
  }
  function clearRoute(fromSample=false) {
    if (fromSample !== true) stopSample();
    setUiRevision(v => v + 1); setMapSelection(s => ({...s,campusRoute:false})); setRouteTarget(null);setStudent(s=>({...s,routeBuilding:false,transitRequested:false}));
    const url = new URL(window.location.href); url.searchParams.delete("route");
    window.history.replaceState({}, "", url.pathname + url.search);
  }
  function changeCity(id: CityId) { stopSample();setMapNotice(false);setDossier(null);setHoveredListing(null);scrollListing(`${id}-1`); setRouteTarget(null); setCityId(id); setSelected(`${id}-1`); setFilters({...emptyFilters});setStudent(emptyStudentPlan());setPlannerOpen(false);setComparisonOpen(false); setOnlySaved(false); setMapSelection(emptyMapSelection()); setUiRevision(v => v + 1); setPicker(false); window.history.pushState({}, "", explorerUrl(id,undefined,false,emptyStudentPlan())); }
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(window.location.search);
      if (preview && ["editorial","spatial"].includes(params.get("variant") ?? "")) setVariant(params.get("variant") as "editorial" | "spatial");
      const requested = cities.find(c => c.id === params.get("city"));
      if (requested) {setCityId(requested.id); const l = listings.find(l => l.id === params.get("listing") && l.cityId === requested.id); setSelected(l?.id ?? `${requested.id}-1`); setPicker(false); setRouteTarget(l && params.get("route") === "walk" ? l.id : null); if(l){setMobileTab("map"); if(params.get("route") === "walk")setMapRequested(true);}} else setPicker(!preview);
      const initial=emptyStudentPlan(),b=buildingById(params.get("building"));
      if(b&&b.cityId===requested?.id){initial.destinationId=b.id;initial.campusId=b.campusId;initial.showBuildings=true;if(params.get("route")==="walk"){initial.routeBuilding=true;setRouteTarget(null);}}
      const compared=(params.get("compare")??"").split(",").filter(Boolean);
      if(compared.length<=3&&new Set(compared).size===compared.length&&compared.every(id=>listings.some(l=>l.id===id&&l.cityId===requested?.id)))initial.compareIds=compared;
      setStudent(initial);if(initial.compareIds.length>=2)setComparisonOpen(true);if(initial.showBuildings)setMapRequested(true);
      setFilters({...emptyFilters});setMapSelection(emptyMapSelection());setUiRevision(v => v + 1);setReady(true);
    }
    restore();
    window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  }, [preview]);
  function toggleSaved(id:string) {void library.toggleFavorite(id);}
  const agentState: RentalState = {cityId, listingId:effectiveSelected || selected, filters,student, map:{...mapSelection,campusRoute:routeTarget === effectiveSelected}};
  function applyAgentState(next: RentalState) {
    stopSample();
    if (next.cityId !== cityId) return;
    setStudent(validateStudentPlan(next.student,cityId));setFilters(next.filters);setOnlySaved(false);setSelected(next.listingId);setMapSelection(next.map);
    setRouteTarget(next.map.campusRoute ? next.listingId : null);
    if(next.map.categories.length||next.map.campusRoute||next.student?.routeBuilding)setMapNotice(true);
    if (next.map.categories.length || next.map.campusRoute||next.student?.showBuildings||next.student?.routeBuilding||next.student?.transitRequested) setMapRequested(true);
    window.history.replaceState({}, "", explorerUrl(cityId,next.listingId,next.map.campusRoute,validateStudentPlan(next.student,cityId)));
  }
  return <main className={`explorer concept-lab concept-${variant} concept-locale-${locale} ${listHidden ? "is-list-collapsed" : ""} ${chatHidden ? "is-chat-collapsed" : ""} ${workspace.layout.focus ? "is-map-focused" : ""} ${preview ? "" : "atlas-production"}`} onPointerDownCapture={e=>{if(playing && e.target instanceof Element && !e.target.closest(".concept-play"))stopSample();}} onKeyDownCapture={e=>{if(playing && e.key !== "Tab" && e.target instanceof Element && !e.target.closest(".concept-play"))stopSample();}}>
    {preview && <div className="concept-review-bar">
      <a href="/?city=london" className="concept-return"><ArrowUpRight size={14}/>{words("返回当前网站","Current website")}</a>
      <div className="concept-variants" aria-label={words("视觉方案","Visual concepts")}>
        <button aria-pressed={variant === "editorial"} onClick={()=>switchVariant("editorial")}><span>A</span>{words("生活杂志","The Editorial")}</button>
        <button aria-pressed={variant === "spatial"} onClick={()=>switchVariant("spatial")}><span>B</span>{words("城市漫游","The Observatory")}</button>
      </div>
      <button className="concept-play" disabled={!shown.length} onClick={()=>playing ? stopSample() : void playSample()}>{playing ? <Square size={12}/> : <Play size={12}/>}<span>{playing ? words("停止样片","Stop preview") : words("播放动效样片","Play motion preview")}</span></button>
    </div>}
    <header className="topbar">
      <a className="brand" href="/" aria-label={t("远居首页")}><span className="brand-mark"><Compass size={26}/></span><span className="concept-wordmark">Campus Atlas<span className="brand-en">{words("远居 · 留学生找房","STUDENT HOMES, A WORLD AWAY")}</span></span></a>
      <div className="main-nav"><button className={!onlySaved ? "active" : ""} onClick={() => setOnlySaved(false)}>{t("发现新家")}</button><button onClick={() => setOnlySaved(v => !v)} className={onlySaved ? "active" : ""}>{t("我的收藏")} <span>{saved.length}</span></button></div>
      <div className="header-end"><span className="sample-badge">{words("留学生活，从这里开始","A place for your next chapter")}</span><button className="student-launch" onClick={()=>setPlannerOpen(true)} aria-label={words("打开留学规划","Open student planner")}><GraduationCap size={18}/><span>{words("留学规划","Planner")}</span></button><LanguageSwitch/><AccountMenu/></div>
    </header>
    <section className="searchbar" aria-label={t("找房条件")}>
      <button className="location-switch" onClick={() => { setPicker(true); }}><span className="flag">{city.flag}</span><span><small>{t("国家 / 城市")}</small><strong>{cityView.country} · {cityView.name}</strong></span><ChevronDown size={16}/></button>
      <button className="campus-select" onClick={()=>setPlannerOpen(true)} aria-label={words("选择大学楼栋与通勤条件","Choose campus destination and commute")}><GraduationCap size={23}/><span><small>{student.destinationId?words("通勤目的地","Commute destination"):t("你的大学")}</small><strong>{buildingById(student.destinationId)?.name??cityView.university}</strong></span><span className="campus-label">{cityView.campus}</span></button>
      <div className="filter-controls"><Select value={filters.budget?.toString() ?? "all"} onValueChange={v => changeFilters({...filters, budget:v === "all" ? null : Number(v)})}><SelectTrigger aria-label={t("预算")}><SelectValue placeholder={t("租金预算")}/></SelectTrigger><SelectContent className="concept-select"><SelectItem value="all">{t("租金不限")}</SelectItem>{Array.from(new Set([...city.prices, ...(filters.budget ? [filters.budget] : [])])).sort((a,b)=>a-b).map(p => <SelectItem key={p} value={p.toString()}>≤ {city.currency}{p.toLocaleString("en-US")} / {cityView.period}</SelectItem>)}</SelectContent></Select><Select value={roomType} onValueChange={setRoomType}><SelectTrigger aria-label={t("房型")}><SelectValue/></SelectTrigger><SelectContent className="concept-select"><SelectItem value="all">{t("全部房型")}</SelectItem>{["独卫单间", "独立 Studio", "合租单间"].map(v => <SelectItem key={v} value={v}>{t(v)}</SelectItem>)}</SelectContent></Select><button className="filter-button" aria-label={onlySaved ? t("已收藏") : t("收藏房源")} aria-pressed={onlySaved} onClick={() => setOnlySaved(v => !v)}><Heart size={17} fill={onlySaved ? "currentColor" : "none"}/><span>{onlySaved ? t("已收藏") : t("收藏房源")}</span></button></div>
    </section>
    {student.compareIds.length>0&&<button className="student-compare-launch" onClick={()=>setComparisonOpen(true)}>{words("对比公寓","Compare homes")} · {student.compareIds.length}/3</button>}
    <nav className="mobile-tabs" aria-label={t("切换面板")}>{[["list",t("房源")],["map",t("城市")],["chat",t("助手")]].map(([id,label]) => <button key={id} className={mobileTab === id ? "active" : ""} onClick={() => setMobileTab(id)}>{label}</button>)}</nav>
    {mapNotice&&mobileTab!=="map"&&<button className="agent-map-notice" onClick={()=>{setMobileTab("map");setMapNotice(false);}}><MapPin size={16}/>{words("地图结果已更新 · 查看地图","Map results updated · View map")}<ArrowRight size={15}/></button>}
    {(filters.roomType!=="all" || filters.walkMinutes || filters.safety || filters.shopping || filters.bills || filters.budget||student.housing.moveIn||student.housing.leaseMonths||student.housing.availableOnly) && <div className="active-filters"><span>{t("你的偏好")}</span>{filters.roomType!=="all"&&<span>{t(filters.roomType)}</span>}{filters.budget && <span>{t("预算 ≤")} {city.currency}{filters.budget} / {cityView.period}</span>}{filters.bills && <span>{t("含水电网")}</span>}{filters.walkMinutes && <span >{buildingById(student.destinationId)?.name??t("大学步行 ≤")} {student.destinationId?"≤ ":""}{filters.walkMinutes} {t("分钟 · 路网估计")}</span>}{filters.safety && <span className="pending">{t("区域安全 · 待核验")}</span>}{filters.shopping && <span className="pending">{t("购物便利 · 待核验")}</span>}{student.housing.moveIn&&<span>{words("入住","Move in")} {student.housing.moveIn}</span>}{student.housing.leaseMonths&&<span>{student.housing.leaseMonths} {words("个月租期","month lease")}</span>}{student.housing.availableOnly&&<span>{words("演示可租","Demo available")}</span>}<button onClick={resetRentalFilters}>{t("清除偏好")}</button></div>}
    <div className={`workspace tab-${mobileTab}`}>
      {variant === "spatial" && <>
        <button data-workspace-restore="list" className="workspace-restore restore-list" aria-controls="workspace-list" aria-expanded={!listHidden} onClick={() => togglePanel("list")}><PanelLeftOpen size={17}/><span>{words("房源", "Homes")} · {shown.length}</span></button>
        <div className="workspace-tools" aria-label={words("工作区布局", "Workspace layout")}><button aria-pressed={workspace.layout.focus} onClick={() => {workspace.dispatch("focus");if(workspace.layout.focus && workspace.layout.chat)setUnreadReply(false);setHoveredListing(null);}}>{workspace.layout.focus ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}<span>{workspace.layout.focus ? words("退出专注", "Exit focus") : words("专注地图", "Focus map")}</span></button><button title={words("恢复默认布局", "Reset layout")} aria-label={words("恢复默认布局", "Reset layout")} onClick={() => {workspace.dispatch("reset");setUnreadReply(false);}}><RotateCcw size={15}/></button><button disabled={!effectiveSelected} aria-label={words("回到所选房源", "Show selected home")} title={words("回到所选房源", "Show selected home")} onClick={() => {if(listHidden)workspace.dispatch("list");scrollListing(effectiveSelected);}}><LocateFixed size={16}/></button></div>
        <button data-workspace-restore="chat" className="workspace-restore restore-chat" aria-controls="workspace-chat" aria-expanded={!chatHidden} onClick={() => togglePanel("chat")}><PanelRightOpen size={17}/><span>{words("AI 助手", "AI assistant")}</span>{unreadReply && chatHidden && <i className="workspace-unread" aria-label={words("有新回复", "New reply")}/>}</button>
      </>}

      <section id="workspace-list" className="listing-panel" inert={listHidden} aria-label={t("房源列表")}><div className="list-heading"><div><h1>{locale === "zh" ? <>{cityView.name}，<em>{variant === "editorial" ? "住进新生活。" : "由你探索。"}</em></> : <>{city.english}.<em>{variant === "editorial" ? "Your next chapter." : "Make it yours."}</em></>}</h1><p><strong>{shown.length}</strong> {t("套演示房源")} <span>{t("· 大学校区周边")}</span></p></div><button className="sort-button" title={t("切换价格排序")} aria-label={t("切换价格排序")} onClick={() => setSort(s => s === "price" ? "recommended" : "price")}><ArrowDownUp size={18}/></button>{variant === "spatial" && <button className="panel-collapse" aria-label={words("收起房源列表", "Collapse homes")} aria-controls="workspace-list" aria-expanded={!listHidden} onClick={() => togglePanel("list")}><PanelLeftClose size={17}/></button>}</div>
        <div className="list-meta"><span><span className="dot"/> {sort === "price" ? t("价格从低到高") : t("为留学生活而选")}</span><span>{t("样本数据")}</span></div>
        <LibrarySyncStatus/><div className="listing-scroll">{shown.map((listing, i) => <ListingCard key={listing.id} listing={listing} selected={effectiveSelected === listing.id} hovered={hoveredListing === listing.id} onHover={setHoveredListing} saved={saved.includes(listing.id)} saveDisabled={!library.ready||library.busy} index={i} onSelect={() => selectListing(listing.id)} onRoute={() => showRoute(listing)} onDetail={() => {stopSample();openDetails(listing);}} onSave={() => toggleSaved(listing.id)} compared={student.compareIds.includes(listing.id)} onCompare={()=>toggleCompare(listing.id)} plan={student} filters={filters} onPlan={()=>setPlannerOpen(true)} onDossier={()=>setDossier(listing)}/>)}{shown.length === 0 && <div className="empty-state"><Search/><h3>{t("还没有符合条件的房源")}</h3><p>{t("试试切换房型，或收藏一套喜欢的房源。")}</p><button onClick={resetRentalFilters}>{t("重置筛选")}</button></div>}<p className="list-disclaimer">{t("房源、位置与租金为虚构演示，图片为室内风格参考，不可预订。")}</p></div>
      </section>
      <div className={`concept-map-stage ${routeTarget || mapSelection.routePlaceId||student.routeBuilding||student.transitRequested ? "route-active" : ""}`}><div className="concept-map-title"><span><Layers3 size={15}/>{words("城市生活地图","A closer look at city life")}</span><h2>{city.english}<small>{cityView.campus}</small></h2></div><CityMap city={city} listings={shown} selected={effectiveSelected} hovered={hoveredListing} onHover={setHoveredListing} onSelect={id => {selectListing(id);scrollListing(id);}} studentPlan={student} onBuildingSelect={selectBuilding} onStudentChange={changeStudent} onPlanner={() => setPlannerOpen(true)} onStudentClose={()=>changeStudent({...student,routeBuilding:false,transitRequested:false})} autoLoad={mapRequested} routeListingId={routeTarget === effectiveSelected ? routeTarget : null} onCloseRoute={clearRoute} selection={mapSelection} onSelectionChange={update => {setMapSelection(update);setUiRevision(v => v + 1);}}/></div>
      {ready && <RentalChat key={cityId} city={city} state={agentState} uiRevision={uiRevision} onState={applyAgentState} collapsed={chatHidden} onReplyReady={onReplyReady} headerControl={variant === "spatial" ? <button className="panel-collapse" aria-label={words("收起 AI 助手", "Collapse AI assistant")} aria-controls="workspace-chat" aria-expanded={!chatHidden} onClick={() => togglePanel("chat")}><PanelRightClose size={17}/></button> : undefined}/>}
    </div>
    {(plannerOpen||comparisonOpen)&&<Suspense fallback={<div className="student-loading" role="status">{words("正在打开规划…","Opening planner…")}</div>}>{plannerOpen&&<StudentPlanner open={plannerOpen} onOpenChange={setPlannerOpen} city={city} listing={listings.find(l=>l.id===effectiveSelected)} listings={listings.filter(l=>l.cityId===cityId)} plan={student} onChange={changeStudent} filters={filters} onFilters={changeFilters} onWalk={()=>showStudentJourney()} onTransit={()=>showStudentJourney(true)}/>} {comparisonOpen&&<ApartmentComparison open={comparisonOpen} onOpenChange={setComparisonOpen} city={city} plan={student} onChange={changeStudent}/>}</Suspense>}
    {preview && <div className={`concept-motion-track ${playing ? "is-playing" : ""}`} aria-live="polite"><span>{words("动效样片","Motion preview")}</span>{[["select",words("选中房源","Select a home")],["detail",words("图片展开","Open the details")],["route",words("真实路线","Real walking route")]].map(([id,label])=><span key={id} className={sampleStage === id ? "active" : ""}><i/>{label}</span>)}<small>{words("可随时手动操作；演示房源不可预订","You can explore freely · Demo homes, no bookings")}</small></div>}
    <ListingDossierDialog listing={dossier} onClose={()=>setDossier(null)}/>
    <DestinationPicker open={picker} onOpenChange={setPicker} onSelect={changeCity} variant={variant}/>
    <Dialog open={!!details} onOpenChange={open => {if(!open){stopSample();void closeDetails();}}}><DialogContent className={`detail-dialog concept-detail concept-dialog-${variant} sm:max-w-[780px]`}>{details && <><DialogTitle>{details.name}</DialogTitle><DialogDescription>{displayCity(getCity(details.cityId),locale).name} · {displayArea(details.area,locale)} {t("· 演示房源")}</DialogDescription><img src={detailPhoto || details.photos[0]} ref={detailImage} onLoad={()=>void animatePhoto()} className="detail-photo" alt={t("演示房源室内风格参考")}/><div className="detail-row"><div><h3>{t(details.roomType)} · {details.size} m²</h3><p>{details.bills ? t("演示条件：租金包含水电网") : t("演示条件：账单另计")}</p></div><div className="price">{priceLabel(details)}<small> / {displayCity(getCity(details.cityId),locale).period}</small></div></div><p className="detail-note">{t("这是用于验证找房体验的虚构房源。照片仅为风格参考；地址、租金、房型与账单条件均为样本。可查看基于真实路网计算的步行路线；楼门、校门、安全和购物便利度仍待核验。")}</p><div className="detail-actions"><a className="primary-button" href={`/listing/${details.id}?${new URLSearchParams({building:student.destinationId??"university-default",compare:student.compareIds.join(",")})}`}>{t("打开完整详情")} <ArrowRight size={17}/></a><button className="secondary-button" onClick={() => void closeDetails().then(()=>selectListing(details.id))}>{t("在城市中定位")} <MapPin size={17}/></button><button className="secondary-button" onClick={() => void closeDetails().then(()=>showRoute(details))}>{t("到学校路线")} <Footprints size={17}/></button></div></>}</DialogContent></Dialog>
  </main>;
}
function ListingCard({saveDisabled,listing, selected, hovered, onHover, saved, index, onSelect, onDetail, onSave, onRoute,compared,onCompare,plan,filters,onPlan,onDossier}: {saveDisabled:boolean;plan:StudentPlan;filters:Filters;onPlan:()=>void;onDossier:()=>void;listing: Listing; selected: boolean; hovered: boolean; onHover: (id: string | null) => void; saved: boolean; index: number; onSelect: () => void; onDetail: () => void; onSave: () => void; onRoute: () => void; compared:boolean;onCompare:()=>void}) {
  const {t, locale} = useLocale();
  const [photo, setPhoto] = useState(0);
  return <article data-listing-id={listing.id} onPointerEnter={() => onHover(listing.id)} onPointerLeave={() => onHover(null)} onFocusCapture={() => onHover(listing.id)} onBlurCapture={e => {if(!e.currentTarget.contains(e.relatedTarget))onHover(null);}} className={`listing-card ${selected ? "selected" : ""} ${hovered ? "is-linked" : ""}`}><div className="listing-image"><button className="photo-open" onClick={onDetail} aria-label={t("查看 {0} 详情", {0:listing.name})}><img key={photo} src={listing.photos[photo]} alt={t("{0} 室内风格参考 {1}", {0:listing.name,1:photo + 1})} loading={index < 2 ? "eager" : "lazy"}/></button><span className="photo-tag">{t(listing.roomType)}</span><button className={`save-button ${saved ? "saved" : ""}`} disabled={saveDisabled} onClick={onSave} aria-pressed={saved} aria-label={t("{0} {1}", {0:saved ? t("取消收藏") : t("收藏"),1:listing.name})}><Heart size={18} fill={saved ? "currentColor" : "none"}/></button><button className="photo-arrow left" onClick={() => setPhoto(p => (p + 2) % 3)} aria-label={t("{0} 上一张照片", {0:listing.name})}><ChevronLeft size={17}/></button><button className="photo-arrow right" onClick={() => setPhoto(p => (p + 1) % 3)} aria-label={t("{0} 下一张照片", {0:listing.name})}><ChevronRight size={17}/></button><div className="photo-dots">{listing.photos.map((_, i) => <span key={i} className={photo === i ? "active" : ""}/>)}</div><span className="demo-photo">{t("风格参考")}</span></div><div className="listing-body"><div className="listing-title"><button onClick={onDetail}>{listing.name}</button><button className={`locate-button ${selected ? "active" : ""}`} onClick={onSelect} aria-pressed={selected} aria-label={t("在地图定位 {0}", {0:listing.name})}><MapPin size={17}/></button></div><p className="listing-area"><MapPin size={13}/>{displayArea(listing.area,locale)} <span>· {listing.size} m²</span></p><div className="listing-tags"><span>{t("配备家具")}</span><span>{listing.bills ? t("含水电网") : t("账单另计")}</span><span>{t("演示房源")}</span></div><div className="listing-price-row"><span className="price">{priceLabel(listing)}<small> / {displayCity(getCity(listing.cityId),locale).period}</small></span><button onClick={onDetail}>{t("查看详情")} <ArrowRight size={15}/></button></div><DecisionSummary listing={listing} plan={plan} filters={filters} onPlan={onPlan}/><button className="listing-route-button" onClick={onRoute} aria-label={t("查看 {0} 到学校的步行路线", {0:listing.name})}><Footprints size={16}/>{t("到学校路线")}<ArrowRight size={14}/></button><div className="listing-decision-actions"><button className="dossier-open" onClick={onDossier}>{locale==="zh"?"资料与看房记录":"Facts & viewing notes"}</button><button className="student-add-compare" aria-pressed={compared} aria-label={`${locale==="zh"?"对比":"Compare"} ${listing.name}`} onClick={onCompare}>{compared?(locale==="zh"?"✓ 已加入对比":"✓ In comparison"):(locale==="zh"?"＋ 加入对比":"＋ Compare")}</button></div></div></article>;
}
