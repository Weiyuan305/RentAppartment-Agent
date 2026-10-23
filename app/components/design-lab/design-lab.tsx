"use client";
import { useListings } from "@/components/listing-catalog-provider";
import { displayCity, displayArea, schoolTag } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
/* eslint-disable @next/next/no-html-link-for-pages -- Full document links avoid vinext production client-router failures. */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRentalWebMCP } from "@/lib/use-rental-webmcp";
import { LanguageSwitch } from "@/components/language-switch";
import { AccountMenu } from "@/components/account-menu";
import { MerchantEntry } from "@/components/merchant-entry";
import { BrandMark } from "@/components/brand-mark";
import { emptyFilters, type Filters } from "@/lib/assistant";
import { ArrowDownUp, ArrowRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Footprints, GraduationCap, Heart, MapPin, Search, Play, Square, ArrowUpRight, Layers3, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, Maximize2, Minimize2, RotateCcw, LocateFixed } from "lucide-react";
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
import { CountryFlag } from "@/components/country-flag";
import DestinationPicker from "@/components/destination-picker";
import { useWorkspaceLayout } from "@/components/use-workspace-layout";
import { WorkspaceResizeHandle } from "@/components/workspace-resize-handle";
import { RentalFilterChips } from "@/components/rental-filter-chips";
import { removeRentalFilter, sameRentalFilters, type FilterSnapshot, type FilterKey } from "@/lib/rental-filter-actions";
import { browseStorageKey, readBrowseSnapshot, type BrowseSnapshot, type MapViewHandle } from "@/lib/browse-memory";
import { matchingHomes, recoverySuggestions, filterNames } from "@/lib/rental-recovery";
import { type MapSearchArea } from "@/lib/map-search-area";
import { actionChanges, canUndoAgentAction } from "@/lib/agent/action-receipt";
import { AgentActionReceipt } from "@/components/agent-action-receipt";
import RentalChat from "@/components/rental-chat";
import { emptyMapSelection, type MapSelection, type RentalState } from "@/lib/agent/contract";
import { cities, defaultCityId, getCity, priceLabel, type CityId, type Listing } from "@/lib/rental-data";
import { ListingCommute } from "@/components/listing-commute";
import { ViewingRequestSheet } from "@/components/viewing-request-sheet";
import { trackAtlasEvent } from "@/lib/atlas-events";

export default function DesignLab({preview = true}: {preview?: boolean}) {
  const listings=useListings();
  const listingsRef=useRef(listings);
  useEffect(()=>{listingsRef.current=listings;},[listings]);
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
    setDetailReturnToken(crypto.randomUUID());
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
    const motion = getComputedStyle(document.documentElement);
    const duration = Math.min(320, Number.parseFloat(motion.getPropertyValue("--motion-normal")) || 280);
    const easing = motion.getPropertyValue("--ease-in-out").trim() || "cubic-bezier(0.77,0,0.175,1)";
    const animation = clone.animate(reverse ? [{transform:"none"},{transform}] : [{transform},{transform:"none"}], {duration,easing,fill:"both"});
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
  const [cityId, setCityId] = useState<CityId>(defaultCityId);
  const [picker, setPicker] = useState(false);
  const [selected, setSelected] = useState(`${defaultCityId}-1`);
  const [viewing, setViewing] = useState<Listing | null>(null);
  const [hiddenListingInfo, setHiddenListingInfo] = useState<string | null>(null);
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
  const [sort, setSort] = useState<"recommended" | "price">("recommended");
  const library = usePersonalLibrary();
  const saved = Object.keys(library.favorites).filter(id=>library.favorites[id].saved);
  const [onlySaved, setOnlySaved] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [searchArea,setSearchArea] = useState<MapSearchArea|null>(null);
  const [searchView,setSearchView] = useState<{key:string;camera:NonNullable<BrowseSnapshot["camera"]>}|null>(null);
  const [agentReceipt,setAgentReceipt] = useState<{id:string;before:RentalState;after:RentalState;onlySaved:boolean;area:MapSearchArea|null;revision:number;undone:boolean}|null>(null);
  const [filterUndo, setFilterUndo] = useState<{city: CityId; before: FilterSnapshot; after: FilterSnapshot} | null>(null);
  const [restoredBrowse, setRestoredBrowse] = useState<BrowseSnapshot | null>(null);
  const mapRestore = useMemo(()=>searchView ?? (restoredBrowse?.camera ? {key:restoredBrowse.token,camera:restoredBrowse.camera} : null),[restoredBrowse,searchView]);
  const [detailReturnToken, setDetailReturnToken] = useState("");
  const pendingScroll = useRef<BrowseSnapshot["scroll"] | null>(null);
  const explorerRoot = useRef<HTMLElement>(null);
  const mapView = useRef<MapViewHandle>(null);
  const [mobileTab, setMobileTab] = useState<"list" | "map" | "chat">("list");
  const workspace = useWorkspaceLayout();
  const preferencesCollapsed = workspace.layout.preferencesCollapsed;
  const filterSnapshot: FilterSnapshot = {filters, housing: student.housing, onlySaved, area:searchArea};
  const canUndo = !!filterUndo && filterUndo.city === cityId && sameRentalFilters(filterSnapshot, filterUndo.after);
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
  useEffect(() => {const frame=requestAnimationFrame(() => window.dispatchEvent(new Event("atlas-workspace-layout")));return () => cancelAnimationFrame(frame);}, [listHidden,chatHidden,workspace.widths.list,workspace.widths.chat]);
  function onReplyReady() {if (hiddenChat.current) setUnreadReply(true);}

  const city = getCity(cityId);
  const cityView = displayCity(city, locale);
  const shown = matchingHomes(listings.filter(l => l.cityId === cityId),filterSnapshot,student,saved).sort((a, b) => sort === "price" ? a.price - b.price : 0);
  const recoveries = shown.length ? [] : recoverySuggestions(listings.filter(l=>l.cityId===cityId),filterSnapshot,student,saved);
  const effectiveSelected = shown.some(l=>l.id===selected)?selected:(shown[0]?.id ?? "");
  const listingInfoVisible = !!effectiveSelected && hiddenListingInfo !== effectiveSelected;
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
  function applyRentalFilters(next: FilterSnapshot) {
    stopSample();
    const nextStudent = {...student, housing: next.housing};
    setFilters(next.filters); setStudent(nextStudent); setOnlySaved(next.onlySaved); setSearchArea(next.area??null); setUiRevision(v => v + 1);
    const matching = matchingHomes(listings.filter(l=>l.cityId===cityId),next,nextStudent,saved);
    const id = matching.some(l => l.id === selected) ? selected : matching[0]?.id ?? selected;
    if (!matching.length || id !== selected) {
      setSelected(id); setRouteTarget(null);
      setMapSelection(current => ({...current, placeIds:null,selectedPlaceId:null,routePlaceId:null,campusRoute:false}));
      window.history.replaceState({}, "", explorerUrl(cityId,id));
    }
  }
  function changeFilters(next: Filters) { setFilterUndo(null); applyRentalFilters({...filterSnapshot, filters: next}); }
  function changeSavedOnly(value: boolean) { setFilterUndo(null); applyRentalFilters({...filterSnapshot, onlySaved: value}); }
  function removeFilter(key: FilterKey | "all") {
    const after = removeRentalFilter(filterSnapshot, key);
    setFilterUndo({city: cityId, before: filterSnapshot, after}); applyRentalFilters(after);
  }
  function undoFilter() {
    if (canUndo && filterUndo) applyRentalFilters(filterUndo.before);
    setFilterUndo(null);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".filter-chip, .preferences-toggle")?.focus());
  }
  function changeStudent(input:StudentPlan,preferredListingId=selected) {
    const next=validateStudentPlan(input,cityId,listings);setFilterUndo(null);stopSample();setStudent(next);setUiRevision(v=>v+1);
    const matching=matchingHomes(listings.filter(l=>l.cityId===cityId),{...filterSnapshot,housing:next.housing},next,saved);
    const id=matching.some(l=>l.id===preferredListingId)?preferredListingId:matching[0]?.id??selected;
    if(next.destinationId!==student.destinationId||id!==selected){setSelected(id);setRouteTarget(null);setMapSelection(s=>({...s,selectedPlaceId:null,routePlaceId:null,campusRoute:false}));}
    if(next.showBuildings||next.routeBuilding||next.catchmentMinutes||next.transitRequested)setMapRequested(true);
    window.history.replaceState({},"",explorerUrl(cityId,id,false,next));
  }
  function resetRentalFilters(){
    removeFilter("all");
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
    setHiddenListingInfo(null);
    setUiRevision(v => v + 1); setMapSelection(emptyMapSelection());
    setSelected(id); setRouteTarget(current => fromSample === true ? null : current === id ? current : null); setMobileTab("map");
    window.history.replaceState({}, "", explorerUrl(cityId,id,fromSample !== true && routeTarget === id));
  }
  function toggleListingInfo(id: string) {
    if (!id) return;
    if (id !== effectiveSelected) {selectListing(id);return;}
    stopSample();
    // This disclosure is local UI state; keep the route and agent's selected home.
    setHiddenListingInfo(current => current === id ? null : id);
    setMobileTab("map");
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
  function openViewing(listing: Listing) {
    trackAtlasEvent({name: "viewing_entry_click", listingId: listing.id, cityId: listing.cityId, locale});
    setViewing(listing);
  }
  function changeCity(id: CityId) { setSearchArea(null);setSearchView(null);setAgentReceipt(null); setRestoredBrowse(null);pendingScroll.current=null;setExpandedIds([]);setFilterUndo(null);stopSample();setMapNotice(false);setDossier(null);setHoveredListing(null);scrollListing(`${id}-1`); setRouteTarget(null); setCityId(id); setSelected(`${id}-1`); setFilters({...emptyFilters});setStudent(emptyStudentPlan());setPlannerOpen(false);setComparisonOpen(false); setOnlySaved(false); setMapSelection(emptyMapSelection()); setUiRevision(v => v + 1); setPicker(false); window.history.pushState({}, "", explorerUrl(id,undefined,false,emptyStudentPlan())); }
  useEffect(() => {
    function restore() {
      const listings=listingsRef.current;
      const params = new URLSearchParams(window.location.search);
      if (preview && ["editorial","spatial"].includes(params.get("variant") ?? "")) setVariant(params.get("variant") as "editorial" | "spatial");
      const requested = cities.find(c => c.id === params.get("city"));
      let snapshot: BrowseSnapshot | null = null;
      if (requested) try { snapshot = readBrowseSnapshot(sessionStorage.getItem(browseStorageKey(requested.id)), params.get("restore") ?? window.history.state?.atlasBrowse, requested.id,listings); } catch {}
      setSearchArea(snapshot?.area??null);setSearchView(null);setAgentReceipt(null);
      setRestoredBrowse(snapshot);setFilterUndo(null);setExpandedIds(snapshot?.expandedIds ?? []);
      if (snapshot) {
        const state = snapshot.state;
        setCityId(state.cityId);setSelected(state.listingId);setStudent(validateStudentPlan(state.student,state.cityId,listings));
        setFilters(state.filters);setMapSelection(state.map);setOnlySaved(snapshot.onlySaved);setSort(snapshot.sort);setMobileTab(snapshot.mobileTab);
        setRouteTarget(state.map.campusRoute ? state.listingId : null);setPicker(false);setComparisonOpen(false);
        pendingScroll.current = snapshot.scroll;
        setMapRequested(!!snapshot.camera || state.map.categories.length > 0 || state.map.campusRoute || !!state.student?.showBuildings);
        // Consume this return marker so a later refresh cannot replay stale filters.
        const clean = new URL(window.location.href);clean.searchParams.delete("restore");
        const restoredHistory={...window.history.state};delete restoredHistory.atlasBrowse;
        window.history.replaceState(restoredHistory, "", clean.pathname+clean.search);
        setUiRevision(v=>v+1);setReady(true);return;
      }
      pendingScroll.current=null;setOnlySaved(false);
      if (requested) {setCityId(requested.id); const l = listings.find(l => l.id === params.get("listing") && l.cityId === requested.id); setSelected(l?.id ?? `${requested.id}-1`); setPicker(false); setRouteTarget(l && params.get("route") === "walk" ? l.id : null); if(l){setMobileTab("map"); if(params.get("route") === "walk")setMapRequested(true);}} else {setCityId(defaultCityId); setSelected(`${defaultCityId}-1`); setPicker(false); const url = new URL(window.location.href); if (!url.searchParams.get("city")) {url.searchParams.set("city", defaultCityId); window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);} }
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
  useEffect(() => {
    if (!ready || !workspace.hydrated || !library.ready || !pendingScroll.current) return;
    const scroller = explorerRoot.current?.querySelector<HTMLElement>(".listing-scroll");
    if (!scroller) return;
    function restoreScroll() {
      const memory = pendingScroll.current;
      if (!memory || !scroller || scroller.clientHeight < 1) return;
      const card = Array.from(scroller.querySelectorAll<HTMLElement>("[data-listing-id]")).find(node => node.dataset.listingId === memory.anchorId);
      const top = card ? card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop + memory.offset : memory.top;
      scroller.scrollTo({top, behavior: "instant"});pendingScroll.current = null;
    }
    const observer = new ResizeObserver(restoreScroll);observer.observe(scroller);
    const frame=requestAnimationFrame(restoreScroll);
    return () => {observer.disconnect();cancelAnimationFrame(frame);};
  }, [ready,workspace.hydrated,library.ready,mobileTab]);
  function rememberBrowse() {
    if (!detailReturnToken) return;
    const scroller = explorerRoot.current?.querySelector<HTMLElement>(".listing-scroll");
    const bounds = scroller?.getBoundingClientRect();
    const anchor = bounds ? Array.from(scroller!.querySelectorAll<HTMLElement>("[data-listing-id]")).find(node => node.getBoundingClientRect().bottom > bounds.top + 1) : undefined;
    const snapshot: BrowseSnapshot = {
      version:1,token:detailReturnToken,url:explorerUrl(cityId,effectiveSelected || selected,!!routeTarget),state:agentState,
      onlySaved,sort,mobileTab,expandedIds,area:searchArea,camera:mapView.current?.capture() ?? null,
      scroll:{anchorId:anchor?.dataset.listingId ?? null,offset:anchor && bounds ? bounds.top-anchor.getBoundingClientRect().top : 0,top:scroller?.scrollTop ?? 0},
    };
    try {sessionStorage.setItem(browseStorageKey(cityId),JSON.stringify(snapshot));window.history.replaceState({...window.history.state,atlasBrowse:detailReturnToken}, "");} catch {}
  }
  function toggleSaved(id:string) {void library.toggleFavorite(id);}
  const agentState: RentalState = {cityId, listingId:effectiveSelected || selected, filters,student, map:{...mapSelection,campusRoute:routeTarget === effectiveSelected}};
  function applyAgentState(next: RentalState, actionId?:string) {
    stopSample();setFilterUndo(null);
    if (next.cityId !== cityId) return;
    if(actionId)setAgentReceipt(previous=>({id:actionId,before:previous?.id===actionId?previous.before:agentState,after:next,onlySaved:previous?.id===actionId?previous.onlySaved:onlySaved,area:previous?.id===actionId?previous.area:searchArea,revision:uiRevision,undone:false}));
    setSearchArea(null);
    setStudent(validateStudentPlan(next.student,cityId,listings));setFilters(next.filters);setOnlySaved(false);setSelected(next.listingId);setMapSelection(next.map);
    setRouteTarget(next.map.campusRoute ? next.listingId : null);
    if(next.map.categories.length||next.map.campusRoute||next.student?.routeBuilding)setMapNotice(true);
    if (next.map.categories.length || next.map.campusRoute||next.student?.showBuildings||next.student?.routeBuilding||next.student?.transitRequested) setMapRequested(true);
    window.history.replaceState({}, "", explorerUrl(cityId,next.listingId,next.map.campusRoute,validateStudentPlan(next.student,cityId,listings)));
  }
  function undoAgentAction() {
    if(!agentReceipt||!canUndoAgentAction(agentReceipt.revision,uiRevision,agentReceipt.undone))return;
    applyAgentState(agentReceipt.before);
    setOnlySaved(agentReceipt.onlySaved);setSearchArea(agentReceipt.area);
    setUiRevision(v=>v+1);setAgentReceipt({...agentReceipt,undone:true});
  }
  function searchMapArea(area:MapSearchArea) {
    const camera=mapView.current?.capture();
    if(camera)setSearchView({key:area.id,camera});
    setFilterUndo(null);applyRentalFilters({...filterSnapshot,area});
  }
  function acceptRecovery(value:FilterSnapshot) {
    setFilterUndo({city:cityId,before:filterSnapshot,after:value});applyRentalFilters(value);
    requestAnimationFrame(()=>{
      explorerRoot.current?.querySelector<HTMLElement>(".listing-scroll")?.scrollTo({top:0,behavior:"instant"});
      document.querySelector<HTMLButtonElement>(".filter-undo")?.focus();
    });
  }
  const receiptChanges=agentReceipt?[
    ...actionChanges(agentReceipt.before,agentReceipt.after,locale,t,listings),
    ...(agentReceipt.onlySaved?[words("已取消仅看收藏","Saved-only filter cleared")]:[]),
    ...(agentReceipt.area?[words("已取消地图范围筛选","Map area filter cleared")]:[]),
  ]:[];
  const mapWorkspaceControls = variant === "spatial" ? <div className="workspace-tools" aria-label={words("工作区布局", "Workspace layout")}><button aria-pressed={workspace.layout.focus} onClick={() => {workspace.dispatch("focus");if(workspace.layout.focus && workspace.layout.chat)setUnreadReply(false);setHoveredListing(null);}}>{workspace.layout.focus ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}<span>{workspace.layout.focus ? words("退出专注", "Exit focus") : words("专注地图", "Focus map")}</span></button><button title={words("恢复默认布局", "Reset layout")} aria-label={words("恢复默认布局", "Reset layout")} onClick={() => {workspace.dispatch("reset");setUnreadReply(false);}}><RotateCcw size={15}/></button><button disabled={!effectiveSelected} aria-label={words("回到所选房源", "Show selected home")} title={words("回到所选房源", "Show selected home")} aria-pressed={listingInfoVisible} onClick={() => {toggleListingInfo(effectiveSelected);if(listHidden)workspace.dispatch("list");scrollListing(effectiveSelected);}}><LocateFixed size={16}/></button></div> : null;
  return <main ref={explorerRoot} style={{"--panel-list-width":`${workspace.widths.list}px`,"--panel-chat-width":`${workspace.widths.chat}px`} as CSSProperties} className={`explorer concept-lab concept-${variant} concept-locale-${locale} ${listHidden ? "is-list-collapsed" : ""} ${chatHidden ? "is-chat-collapsed" : ""} ${workspace.layout.focus ? "is-map-focused" : ""} ${preview ? "" : "atlas-production"}`} onPointerDownCapture={e=>{if(playing && e.target instanceof Element && !e.target.closest(".concept-play"))stopSample();}} onKeyDownCapture={e=>{if(playing && e.key !== "Tab" && e.target instanceof Element && !e.target.closest(".concept-play"))stopSample();}}>
    {preview && <div className="concept-review-bar">
      <a href="/?city=london" className="concept-return"><ArrowUpRight size={14}/>{words("返回当前网站","Current website")}</a>
      <div className="concept-variants" aria-label={words("视觉方案","Visual concepts")}>
        <button aria-pressed={variant === "editorial"} onClick={()=>switchVariant("editorial")}><span>A</span>{words("生活杂志","The Editorial")}</button>
        <button aria-pressed={variant === "spatial"} onClick={()=>switchVariant("spatial")}><span>B</span>{words("城市漫游","The Observatory")}</button>
      </div>
      <button className="concept-play" disabled={!shown.length} onClick={()=>playing ? stopSample() : void playSample()}>{playing ? <Square size={12}/> : <Play size={12}/>}<span>{playing ? words("停止样片","Stop preview") : words("播放动效样片","Play motion preview")}</span></button>
    </div>}
    <header className="topbar">
      <a className="brand" href="/" aria-label={t("远居首页")}><BrandMark/><span className="concept-wordmark">Campus Atlas<span className="brand-en">{words("远居 · 留学生找房","STUDENT HOMES, A WORLD AWAY")}</span></span></a>
      <button type="button" className="school-switch" aria-haspopup="dialog" aria-label={`${t("切换学校")} ${schoolTag(city, locale)}`} onClick={() => setPicker(true)}>{schoolTag(city, locale)} ▾</button>
      <div className="main-nav"><button className={!onlySaved ? "active" : ""} onClick={() => changeSavedOnly(false)}>{t("发现新家")}</button><button onClick={() => changeSavedOnly(!onlySaved)} className={onlySaved ? "active" : ""}>{t("我的收藏")} <span>{saved.length}</span></button></div>
      <div className="header-end"><MerchantEntry/><button className="student-launch" onClick={()=>setPlannerOpen(true)} aria-label={words("打开留学规划","Open student planner")}><GraduationCap size={18}/><span>{words("留学规划","Planner")}</span></button><LanguageSwitch/><AccountMenu/></div>
    </header>
    <section className={`rental-preferences ${preferencesCollapsed ? "is-collapsed" : ""}`} aria-label={t("找房条件")}>
    <div id="rental-preferences-fields" className="searchbar" hidden={preferencesCollapsed}>
      <button className="location-switch" onClick={() => { setPicker(true); }}><span className="flag"><CountryFlag countryId={city.countryId}/></span><span><small>{t("国家 / 城市")}</small><strong>{cityView.country} · {cityView.name}</strong></span><ChevronDown size={16}/></button>
      <button className="campus-select" onClick={()=>setPlannerOpen(true)} aria-label={words("选择大学楼栋与通勤条件","Choose campus destination and commute")}><GraduationCap size={23}/><span><small>{student.destinationId?words("通勤目的地","Commute destination"):t("你的大学")}</small><strong>{buildingById(student.destinationId)?.name??cityView.university}</strong></span><span className="campus-label">{cityView.campus}</span></button>
      <div className="filter-controls"><Select value={filters.budget?.toString() ?? "all"} onValueChange={v => changeFilters({...filters, budget:v === "all" ? null : Number(v)})}><SelectTrigger aria-label={t("预算")}><SelectValue placeholder={t("租金预算")}/></SelectTrigger><SelectContent className="concept-select"><SelectItem value="all">{t("租金不限")}</SelectItem>{Array.from(new Set([...city.prices, ...(filters.budget ? [filters.budget] : [])])).sort((a,b)=>a-b).map(p => <SelectItem key={p} value={p.toString()}>≤ {city.currency}{p.toLocaleString("en-US")} / {cityView.period}</SelectItem>)}</SelectContent></Select><Select value={roomType} onValueChange={setRoomType}><SelectTrigger aria-label={t("房型")}><SelectValue/></SelectTrigger><SelectContent className="concept-select"><SelectItem value="all">{t("全部房型")}</SelectItem>{["独卫单间", "独立 Studio", "合租单间"].map(v => <SelectItem key={v} value={v}>{t(v)}</SelectItem>)}</SelectContent></Select><button className="filter-button" aria-label={onlySaved ? t("已收藏") : t("收藏房源")} aria-pressed={onlySaved} onClick={() => changeSavedOnly(!onlySaved)}><Heart size={17} fill={onlySaved ? "currentColor" : "none"}/><span>{onlySaved ? t("已收藏") : t("收藏房源")}</span></button></div>
    </div>
    <div className="preferences-summary" hidden={!preferencesCollapsed}>
      <span className="preferences-location" title={`${cityView.country} · ${cityView.name}`}><CountryFlag countryId={city.countryId}/><strong>{cityView.name}</strong></span>
      <span className="preferences-destination" title={buildingById(student.destinationId)?.name??cityView.university}><GraduationCap size={16}/><span>{buildingById(student.destinationId)?.name??cityView.university}</span></span>
      {onlySaved&&<span className="preferences-saved"><Heart size={14}/>{words("仅看收藏","Saved only")}</span>}
    </div>
    <button className="preferences-toggle" aria-controls="rental-preferences-fields" aria-expanded={!preferencesCollapsed} aria-label={preferencesCollapsed?words("展开筛选条件","Expand rental filters"):words("收起筛选条件","Collapse rental filters")} title={preferencesCollapsed?words("展开筛选条件","Expand rental filters"):words("收起筛选条件","Collapse rental filters")} onClick={()=>workspace.dispatch("preferences")}><span>{preferencesCollapsed?words("展开筛选","Filters"):words("收起","Hide")}</span><ChevronUp size={16}/></button>
    </section>
    {student.compareIds.length>0&&listHidden&&<button className="student-compare-launch" onClick={()=>setComparisonOpen(true)}>{words("对比公寓","Compare homes")} · {student.compareIds.length}/3</button>}
    <nav className="mobile-tabs" aria-label={t("切换面板")}>{[["list",t("房源")],["map",t("城市")],["chat",t("助手")]].map(([id,label]) => <button key={id} className={mobileTab === id ? "active" : ""} onClick={() => setMobileTab(id as "list" | "map" | "chat")}>{label}</button>)}{student.compareIds.length>0&&<button className="mobile-compare-launch" aria-label={`${words("对比公寓","Compare homes")} · ${student.compareIds.length}/3`} onClick={()=>setComparisonOpen(true)}>{words("对比","Compare")} {student.compareIds.length}</button>}</nav>
    {mapNotice&&mobileTab!=="map"&&<button className="agent-map-notice" onClick={()=>{setMobileTab("map");setMapNotice(false);}}><MapPin size={16}/>{words("地图结果已更新 · 查看地图","Map results updated · View map")}<ArrowRight size={15}/></button>}
    <RentalFilterChips value={filterSnapshot} city={city} destination={buildingById(student.destinationId)?.name} undo={canUndo} onRemove={removeFilter} onUndo={undoFilter}/>
    <div className={`workspace tab-${mobileTab}`}>
      {variant === "spatial" && <>
        <button data-workspace-restore="list" className="workspace-restore restore-list" aria-controls="workspace-list" aria-expanded={!listHidden} onClick={() => togglePanel("list")}><PanelLeftOpen size={17}/><span>{words("房源", "Homes")} · {shown.length}</span></button>

        <button data-workspace-restore="chat" className="workspace-restore restore-chat" aria-controls="workspace-chat" aria-expanded={!chatHidden} onClick={() => togglePanel("chat")}><PanelRightOpen size={17}/><span>{words("AI 助手", "AI assistant")}</span>{unreadReply && chatHidden && <i className="workspace-unread" aria-label={words("有新回复", "New reply")}/>}</button>
      </>}

      <section id="workspace-list" className={`listing-panel ${variant === "spatial" ? "listing-panel--compact" : ""}`} inert={listHidden} aria-label={t("房源列表")}>
        <div className="list-heading">
          <div className="list-heading-copy">
            <h1>{variant === "spatial" ? words(`${cityView.name}房源`, `${city.english} homes`) : locale === "zh" ? <>{cityView.name}，<em>住进新生活。</em></> : <>{city.english}.<em>Your next chapter.</em></>}</h1>
            {variant === "editorial" && <p><strong>{shown.length}</strong> {words("套房源","homes")} <span>{t("· 大学校区周边")}</span></p>}
          </div>
          <div className="panel-heading-actions list-heading-actions" role="group" aria-label={words("房源列表操作", "Home list actions")}>
            {variant === "spatial" && <button className="panel-collapse" title={words("收起房源列表", "Collapse homes")} aria-label={words("收起房源列表", "Collapse homes")} aria-controls="workspace-list" aria-expanded={!listHidden} onClick={() => togglePanel("list")}><PanelLeftClose size={18}/></button>}
            <button className="sort-button" title={t("切换价格排序")} aria-label={t("切换价格排序")} aria-pressed={sort === "price"} onClick={() => setSort(s => s === "price" ? "recommended" : "price")}><ArrowDownUp size={18}/></button>
          </div>
        </div>
        <div className="list-meta">{variant === "spatial" ? <><span><strong>{shown.length}</strong> {words("套房源","homes")}</span><span>{sort === "price" ? t("价格从低到高") : words("推荐排序", "Recommended")}</span></> : <><span><span className="dot"/> {sort === "price" ? t("价格从低到高") : t("为留学生活而选")}</span><span>{t("样本数据")}</span></>}</div>
        <LibrarySyncStatus compact={variant === "spatial"}/><div className="listing-scroll">{shown.map((listing, i) => <ListingCard key={listing.id} listing={listing} selected={effectiveSelected === listing.id} infoVisible={effectiveSelected === listing.id && listingInfoVisible} hovered={hoveredListing === listing.id} onHover={setHoveredListing} saved={saved.includes(listing.id)} saveDisabled={!library.ready||library.busy} index={i} onSelect={() => toggleListingInfo(listing.id)} onRoute={() => showRoute(listing)} onDetail={() => {stopSample();openDetails(listing);}} onSave={() => toggleSaved(listing.id)} compared={student.compareIds.includes(listing.id)} onCompare={()=>toggleCompare(listing.id)} plan={student} filters={filters} onPlan={()=>setPlannerOpen(true)} onDossier={()=>setDossier(listing)} onViewing={openViewing} expanded={expandedIds.includes(listing.id)} onExpanded={open=>setExpandedIds(ids=>open?Array.from(new Set([...ids,listing.id])):ids.filter(id=>id!==listing.id))}/>)}{shown.length === 0 && <div className="empty-state"><Search/><h3>{t("还没有符合条件的房源")}</h3><p>{recoveries.length?words("以下调整可找到演示房源，点击后才会应用。","These changes find demo homes. Choose one to apply it."):words("当前城市暂无可匹配的演示数据。","No matching demo data in this city.")}</p><div className="recovery-options">{recoveries.map((r,i)=><button key={i} onClick={()=>acceptRecovery(r.value)}><span>{words("取消","Remove")} {r.keys.map(key=>filterNames[key][locale==="zh"?0:1]).join(locale==="zh"?"、":", ")}</span><strong>{words(`${r.count} 套`,`${r.count} homes`)}</strong></button>)}</div><button onClick={resetRentalFilters}>{t("重置筛选")}</button></div>}<p className="list-disclaimer">{words("标为演示的房源不可预订；商家房源的库存与条款请向商家确认。","Demo listings cannot be booked. Confirm partner availability and terms with the host.")}</p></div>
        {student.compareIds.length>0&&<div className="listing-panel-footer"><button className="student-compare-launch" onClick={()=>setComparisonOpen(true)}>{words("对比公寓","Compare homes")} · {student.compareIds.length}/3<ArrowRight size={16}/></button></div>}
      </section>
      {variant === "spatial" && workspace.desktop && !listHidden && <WorkspaceResizeHandle panel="list" width={workspace.widths.list} limit={workspace.widths.budget-workspace.widths.chat} root={explorerRoot} onCommit={width=>workspace.dispatch({panel:"list",width})}/>}
      {variant === "spatial" && workspace.desktop && !chatHidden && <WorkspaceResizeHandle panel="chat" width={workspace.widths.chat} limit={workspace.widths.budget-workspace.widths.list} root={explorerRoot} onCommit={width=>workspace.dispatch({panel:"chat",width})}/>}
      <div className={`concept-map-stage ${routeTarget || mapSelection.routePlaceId||student.routeBuilding||student.transitRequested ? "route-active" : ""}`}><div className="concept-map-title"><span><Layers3 size={15}/>{words("城市生活地图","A closer look at city life")}</span><h2>{city.english}<small>{cityView.campus}</small></h2></div><CityMap showListingInfo={listingInfoVisible} onToggleListingInfo={() => toggleListingInfo(effectiveSelected)} workspaceControls={mapWorkspaceControls} onSearchArea={searchMapArea} areaActive={!!searchArea} areaResultCount={shown.length} viewRef={mapView} restoredView={mapRestore} city={city} listings={shown} selected={effectiveSelected} hovered={hoveredListing} onHover={setHoveredListing} onSelect={id => {selectListing(id);scrollListing(id);}} studentPlan={student} onBuildingSelect={selectBuilding} onStudentChange={changeStudent} onPlanner={() => setPlannerOpen(true)} onStudentClose={()=>changeStudent({...student,routeBuilding:false,transitRequested:false})} autoLoad={mapRequested} routeListingId={routeTarget === effectiveSelected ? routeTarget : null} onCloseRoute={clearRoute} selection={mapSelection} onSelectionChange={update => {setMapSelection(update);setUiRevision(v => v + 1);}}/></div>
      {ready && <RentalChat onLocateContext={()=>{setHiddenListingInfo(null);setMobileTab("map");setMapRequested(true);setMapNotice(false);scrollListing(effectiveSelected);requestAnimationFrame(()=>mapView.current?.focusHome?.());}} onActionClear={()=>setAgentReceipt(null)} actionReceipt={agentReceipt&&<AgentActionReceipt changes={receiptChanges} undone={agentReceipt.undone} canUndo={canUndoAgentAction(agentReceipt.revision,uiRevision,agentReceipt.undone)} onUndo={undoAgentAction} onMap={()=>{setMobileTab("map");setMapRequested(true);setMapNotice(false);}}/>} preserveInitialState={!!restoredBrowse} key={cityId} city={city} state={agentState} uiRevision={uiRevision} onState={applyAgentState} collapsed={chatHidden} onReplyReady={onReplyReady} headerControl={variant === "spatial" ? <button className="panel-collapse" title={words("收起 AI 助手", "Collapse AI assistant")} aria-label={words("收起 AI 助手", "Collapse AI assistant")} aria-controls="workspace-chat" aria-expanded={!chatHidden} onClick={() => togglePanel("chat")}><PanelRightClose size={18}/></button> : undefined}/>}
    </div>
    {(plannerOpen||comparisonOpen)&&<Suspense fallback={<div className="student-loading" role="status">{words("正在打开规划…","Opening planner…")}</div>}>{plannerOpen&&<StudentPlanner open={plannerOpen} onOpenChange={setPlannerOpen} city={city} listing={listings.find(l=>l.id===effectiveSelected)} listings={listings.filter(l=>l.cityId===cityId)} plan={student} onChange={changeStudent} filters={filters} onFilters={changeFilters} onWalk={()=>showStudentJourney()} onTransit={()=>showStudentJourney(true)}/>} {comparisonOpen&&<ApartmentComparison open={comparisonOpen} onOpenChange={setComparisonOpen} city={city} plan={student} onChange={changeStudent}/>}</Suspense>}
    {preview && <div className={`concept-motion-track ${playing ? "is-playing" : ""}`} aria-live="polite"><span>{words("动效样片","Motion preview")}</span>{[["select",words("选中房源","Select a home")],["detail",words("图片展开","Open the details")],["route",words("真实路线","Real walking route")]].map(([id,label])=><span key={id} className={sampleStage === id ? "active" : ""}><i/>{label}</span>)}<small>{words("可随时手动操作；演示房源不可预订","You can explore freely · Demo homes, no bookings")}</small></div>}
    <ListingDossierDialog listing={dossier} onClose={()=>setDossier(null)}/>
    <DestinationPicker open={picker} onOpenChange={setPicker} onSelect={changeCity} variant={variant}/>
    <ViewingRequestSheet listing={viewing} open={!!viewing} onOpenChange={open => {if (!open) setViewing(null);}}/>
    <Dialog open={!!details} onOpenChange={open => {if(!open){stopSample();void closeDetails();}}}><DialogContent closeLabel={words("关闭详情","Close details")} className={`detail-dialog concept-detail concept-dialog-${variant} sm:max-w-[780px]`}>{details && <><DialogTitle>{details.name}</DialogTitle><DialogDescription>{displayCity(getCity(details.cityId),locale).name} · {displayArea(details.area,locale)} {details.merchant?words("· 商家房源","· Partner listing"):t("· 演示房源")}</DialogDescription><div className="detail-dialog-scroll"><div className="detail-photo-frame"><span className="detail-photo-skeleton" aria-hidden="true">{t("风格参考")}</span><img src={detailPhoto || details.photos[0]} ref={detailImage} onLoad={()=>void animatePhoto()} className="detail-photo" alt={details.merchant?details.name:t("演示房源室内风格参考")}/></div><div className="detail-row"><div><h3>{t(details.roomType)} · {details.size} m²</h3><p>{details.merchant?details.merchant.billDetails:details.bills ? t("演示条件：租金包含水电网") : t("演示条件：账单另计")}</p></div><div className="price">{priceLabel(details)}<small> / {displayCity(getCity(details.cityId),locale).period}</small></div></div><p className="detail-note">{details.merchant?(locale==="en"&&details.merchant.descriptionEn?details.merchant.descriptionEn:details.merchant.description):t("这是用于验证找房体验的虚构房源。照片仅为风格参考；地址、租金、房型与账单条件均为样本。可查看基于真实路网计算的步行路线；楼门、校门、安全和购物便利度仍待核验。")}</p><ListingCommute listing={details}/><div className="detail-actions"><button type="button" className="listing-viewing-button" onClick={() => openViewing(details)}>{t("预约看房")}</button><a className="secondary-button" onClick={rememberBrowse} href={`/listing/${details.id}?${new URLSearchParams({building:student.destinationId??"university-default",compare:student.compareIds.join(","),return:detailReturnToken})}`}>{t("打开完整详情")} <ArrowRight size={17}/></a><button className="secondary-button" onClick={() => void closeDetails().then(()=>selectListing(details.id))}>{t("在城市中定位")} <MapPin size={17}/></button><button className="secondary-button" onClick={() => void closeDetails().then(()=>showRoute(details))}>{t("到学校路线")} <Footprints size={17}/></button></div></div></>}</DialogContent></Dialog>
  </main>;
}
function ListingCard({saveDisabled,listing, selected, infoVisible, hovered, onHover, saved, index, onSelect, onDetail, onSave, onRoute,compared,onCompare,plan,filters,onPlan,onDossier,onViewing,expanded,onExpanded}: {expanded:boolean;onExpanded:(value:boolean)=>void;saveDisabled:boolean;plan:StudentPlan;filters:Filters;onPlan:()=>void;onDossier:()=>void;onViewing:(listing: Listing)=>void;listing: Listing; selected: boolean; infoVisible: boolean; hovered: boolean; onHover: (id: string | null) => void; saved: boolean; index: number; onSelect: () => void; onDetail: () => void; onSave: () => void; onRoute: () => void; compared:boolean;onCompare:()=>void}) {
  const {t, locale} = useLocale();
  const [photo, setPhoto] = useState(0);
  return <article data-listing-id={listing.id} onPointerEnter={() => onHover(listing.id)} onPointerLeave={() => onHover(null)} onFocusCapture={() => onHover(listing.id)} onBlurCapture={e => {if(!e.currentTarget.contains(e.relatedTarget))onHover(null);}} className={`listing-card ${selected ? "selected" : ""} ${hovered ? "is-linked" : ""}`}><div className="listing-image"><button className="photo-open" onClick={onDetail} aria-label={t("查看 {0} 详情", {0:listing.name})}><img key={photo} src={listing.photos[photo]} alt={t("{0} 室内风格参考 {1}", {0:listing.name,1:photo + 1})} loading={index < 2 ? "eager" : "lazy"}/></button><span className="photo-tag">{t(listing.roomType)}</span><button className={`save-button ${saved ? "saved" : ""}`} disabled={saveDisabled} onClick={onSave} aria-pressed={saved} aria-label={t("{0} {1}", {0:saved ? t("取消收藏") : t("收藏"),1:listing.name})}><Heart size={18} fill={saved ? "currentColor" : "none"}/></button><button className="photo-arrow left" onClick={() => setPhoto(p => (p + listing.photos.length - 1) % listing.photos.length)} aria-label={t("{0} 上一张照片", {0:listing.name})}><ChevronLeft size={17}/></button><button className="photo-arrow right" onClick={() => setPhoto(p => (p + 1) % listing.photos.length)} aria-label={t("{0} 下一张照片", {0:listing.name})}><ChevronRight size={17}/></button><div className="photo-dots">{listing.photos.map((_, i) => <span key={i} className={photo === i ? "active" : ""}/>)}</div><span className="demo-photo">{listing.merchant?(locale==="zh"?"商家照片":"Partner photo"):t("风格参考")}</span></div><div className="listing-body"><div className="listing-title"><button onClick={onDetail}>{listing.name}</button><button className={`locate-button ${infoVisible ? "active" : ""}`} onClick={onSelect} aria-pressed={infoVisible} title={infoVisible ? (locale === "zh" ? "收起房源信息" : "Hide home summary") : (locale === "zh" ? "定位并显示房源信息" : "Locate and show home summary")} aria-label={t("在地图定位 {0}", {0:listing.name})}><MapPin size={17}/></button></div><div className="listing-price-row"><span className="price">{priceLabel(listing)}<small> / {displayCity(getCity(listing.cityId),locale).period}</small></span><button onClick={onDetail}>{t("查看详情")} <ArrowRight size={15}/></button></div><p className="listing-area"><MapPin size={13}/>{displayArea(listing.area,locale)} <span>· {listing.size} m²</span></p><div className="listing-tags">{(!listing.merchant||listing.merchant.facilities.includes("furnished"))&&<span>{t("配备家具")}</span>}<span>{listing.bills ? t("含水电网") : t("账单另计")}</span><span>{listing.merchant?(locale==="zh"?"商家房源":"Partner listing"):t("演示房源")}</span></div><ListingCommute listing={listing}/><DecisionSummary expanded={expanded} onExpanded={onExpanded} listing={listing} plan={plan} filters={filters} onPlan={onPlan}/><button className="listing-route-button" onClick={onRoute} aria-label={t("查看 {0} 到学校的步行路线", {0:listing.name})}><Footprints size={16}/>{t("到学校路线")}<ArrowRight size={14}/></button><button type="button" className="listing-viewing-button" onClick={() => onViewing(listing)}>{t("预约看房")}</button><div className="listing-decision-actions"><button className="dossier-open" onClick={onDossier}>{locale==="zh"?"资料与看房记录":"Facts & viewing notes"}</button><button className="student-add-compare" aria-pressed={compared} aria-label={`${locale==="zh"?"对比":"Compare"} ${listing.name}`} onClick={onCompare}>{compared?(locale==="zh"?"✓ 已加入对比":"✓ In comparison"):(locale==="zh"?"＋ 加入对比":"＋ Compare")}</button></div></div></article>;
}
