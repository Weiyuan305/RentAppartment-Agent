"use client";
import { displayCity } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import MapAttribution from "@/components/map-attribution";
import MapInputHelp from "@/components/map-input-help";
import {installMapCameraInput} from "@/lib/map-camera-input";
import {useMapInputMode} from "@/lib/use-map-input";
import { lazy,Suspense,useEffect, useMemo, useRef, useState, useImperativeHandle, type Ref, type ReactNode } from "react";
import type * as Cesium from "cesium";
import { Building2, Compass, GraduationCap, MapPin, Minus, Navigation, Plus, RotateCw, Search, X } from "lucide-react";
import { cityPhoto, priceLabel, type City, type Listing } from "@/lib/rental-data";
import { resolveMapConfig } from "@/lib/map-config";
import { useWalkingRoute } from "@/lib/use-walking-route";
import WalkingRoutePanel from "@/components/walking-route-panel";
import { drawConceptRoute as drawWalkingRoute, fitConceptRoute as fitWalkingRoute } from "./route-display";
import { useAmenities } from "@/lib/use-amenities";
import { type AmenityCategory } from "@/lib/amenities";
import { selectAmenities } from "@/lib/amenity-query";
import type { MapSelection } from "@/lib/agent/contract";
import { useAmenityRoute } from "@/lib/use-amenity-route";
import { createAmenityLayer, updateAmenityLayer, fitAmenities } from "@/lib/amenity-display";
import AmenityControls, { AmenityDetails } from "@/components/amenity-controls";
const CampusMapLayer=lazy(()=>import("@/components/student/campus-map-layer"));
import {BuildingJourneyPanel,TransitJourneyPanel} from "@/components/student/building-journey-panel";
import {buildingById} from "@/lib/student/catalog";
import {useBuildingRoute,useTransitJourney} from "@/lib/student/use-student-journey";
import type {StudentPlan} from "@/lib/student/state";
import MapLayers from "./map-layers";
import JourneyDisclosure from "./journey-disclosure";
import MapPlaceLabels, {fitMapLabelTarget, type LabelScene} from "./map-place-labels";

import { visibleSidePanel } from "@/lib/map-marker-density";
import type {MapSearchArea} from "@/lib/map-search-area";
import type {CameraView, MapViewHandle} from "@/lib/browse-memory";

type Engine = typeof Cesium;
declare global { interface Window { Cesium?: Engine; CESIUM_BASE_URL?: string } }
let enginePromise: Promise<Engine> | null = null;
function loadEngine() {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (!enginePromise) enginePromise = new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = "/cesium/";
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/cesium/Widgets/widgets.css"; document.head.appendChild(css);
    const script = document.createElement("script"); script.src = "/cesium/Cesium.js"; script.async = true;
    script.onload = () => window.Cesium ? resolve(window.Cesium) : reject(new Error("engine"));
    script.onerror = () => { enginePromise = null; script.remove(); reject(new Error("engine")); }; document.head.appendChild(script);
  });
  return enginePromise;
}
const config = resolveMapConfig({
  VITE_MAP_PROVIDER: import.meta.env.VITE_MAP_PROVIDER,
  VITE_CESIUM_ION_ACCESS_TOKEN: import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN,
  VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
});
export default function CityMap({ city, listings, selected, onSelect, autoLoad, routeListingId, onCloseRoute, selection, onSelectionChange,studentPlan,onBuildingSelect,onStudentClose,onStudentChange,onPlanner,hovered,onHover,viewRef,restoredView,onSearchArea,areaActive,areaResultCount,workspaceControls,showListingInfo,onToggleListingInfo }: {
  workspaceControls?: ReactNode;
  showListingInfo: boolean; onToggleListingInfo: () => void;
  onSearchArea: (area:MapSearchArea)=>void; areaActive:boolean; areaResultCount:number;
  viewRef?: Ref<MapViewHandle>; restoredView?: {key:string;camera:CameraView} | null;
  hovered: string | null; onHover: (id: string | null) => void; onStudentChange: (plan: StudentPlan) => void; onPlanner: () => void;
  studentPlan:StudentPlan;onBuildingSelect:(id:string)=>void;onStudentClose:()=>void;
  city: City; listings: Listing[]; selected: string; onSelect: (id: string) => void;
  autoLoad: boolean; routeListingId: string | null; onCloseRoute: () => void;
  selection: MapSelection; onSelectionChange: (update: (current: MapSelection) => MapSelection) => void;
}) {
  const {t, locale} = useLocale();
  const {mode:inputMode,modeRef:inputModeRef,updateMode:updateInputMode}=useMapInputMode();
  const cityView = useMemo(()=>displayCity(city,locale),[city,locale]);
  const container = useRef<HTMLDivElement>(null);
  const creditContainer = useRef<HTMLDivElement>(null);
  const viewportVisible = useRef(false);
  const [visibilityTick,setVisibilityTick]=useState(0);
  const [viewportSeen, setViewportSeen] = useState(false);
  const [labelScene, setLabelScene] = useState<LabelScene | null>(null);
  const runtime = useRef<{ C: Engine; viewer: Cesium.Viewer; tiles: Cesium.Cesium3DTileset; amenities: Cesium.CustomDataSource; amenityFocus: Cesium.CustomDataSource } | null>(null);
  useImperativeHandle(viewRef, () => ({capture: () => {
    const rt=runtime.current;if(!rt || rt.viewer.isDestroyed())return null;
    const camera=rt.viewer.camera,position=camera.positionCartographic;
    return {longitude:rt.C.Math.toDegrees(position.longitude),latitude:rt.C.Math.toDegrees(position.latitude),height:position.height,heading:camera.heading,pitch:camera.pitch,roll:camera.roll};
  }}), []);
  const restoredCamera = useRef<{key:string;context:string;tick:number;viewer:Cesium.Viewer|null;released:boolean}|null>(null);
  const amenityOverview = useRef<Array<{lng:number;lat:number}> | null>(null);
  const clickCallback = useRef(onSelect);
  useEffect(() => { clickCallback.current = onSelect; }, [onSelect]);
  const [status, setStatus] = useState<"missing" | "idle" | "loading" | "ready" | "error">(config.configured ? "idle" : "missing");
  const [requested, setRequested] = useState(false);
  const [areaError,setAreaError]=useState(false);
  const [retry, setRetry] = useState(0);
  const amenityCategories = selection.categories;
  const selectedAmenityId = selection.selectedPlaceId;
  const patchSelection = (patch: Partial<MapSelection>) => onSelectionChange(current => ({...current, ...patch}));
  const setSelectedAmenityId = (id: string | null) => {if(id && (studentPlan.routeBuilding || studentPlan.transitRequested))onStudentClose();patchSelection({selectedPlaceId: id});};
  const amenityClick = useRef<(id: string | null) => void>(() => {});
  useEffect(() => {amenityClick.current = id => {
    if(id && (studentPlan.routeBuilding || studentPlan.transitRequested))onStudentClose();
    onSelectionChange(current => ({...current,selectedPlaceId:id,routePlaceId:null,campusRoute:false}));
  };}, [studentPlan.routeBuilding,studentPlan.transitRequested,onStudentClose,onSelectionChange]);
  const setAmenityRouteTarget = (key: string | null) => patchSelection({routePlaceId: key?.split(":")[1] ?? null, campusRoute: false});
  const [amenitiesRequested, setAmenitiesRequested] = useState(false);
  const radius = selection.radiusMeters, cuisine = selection.cuisine;
  const active = listings.find(l => l.id === selected);
  const { data: amenitiesData, status: amenitiesStatus, retry: retryAmenities } = useAmenities(city, amenityCategories.length > 0 || amenitiesRequested);
  const visibleAmenities = useMemo(() => {
    const origin: [number, number] = active ? [active.lng, active.lat] : [city.lng, city.lat];
    return selectAmenities(amenitiesData, origin, selection);
  }, [amenitiesData, active, city, selection]);
  const selectedAmenity = visibleAmenities.find(p => p.id === selectedAmenityId);
  const amenityRouteEnabled = Boolean(active && selectedAmenity && selection.routePlaceId === selectedAmenity.id);
  const facilityRoute = useAmenityRoute(active, selectedAmenity, amenityRouteEnabled);
  const routeTarget = active?.id === routeListingId ? active : undefined;
  const { route: campusRoute, status: routeStatus, retry: retryRoute } = useWalkingRoute(routeTarget);
  const selectedBuilding=buildingById(studentPlan.destinationId);
  const buildingRoute=useBuildingRoute(active,selectedBuilding,studentPlan.routeBuilding&&!amenityRouteEnabled);
  const transit=useTransitJourney(active,selectedBuilding,studentPlan.transitRequested&&!amenityRouteEnabled);
  const route = amenityRouteEnabled ? facilityRoute.route : studentPlan.routeBuilding?buildingRoute.route:campusRoute;
  const transitJourney=transit.journeys[0];
  const shouldLoad = requested || autoLoad;
  const [focusTick, setFocusTick] = useState(0);
  const [overlay, setOverlay] = useState<"layers" | "journey" | null>(null);
  function fitCurrentRoute() {
    setOverlay(null);
    requestAnimationFrame(() => setFocusTick(value => value + 1));
  }
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const panel = element.parentElement;
    const amenityControls = panel?.querySelector<HTMLElement>(".concept-amenity-disclosure");
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      panel?.style.setProperty("--map-panel-height", `${Math.floor(bounds.height)}px`);
      const visible = bounds.width > 1 && bounds.height > 1;
      const becameVisible=visible&&!viewportVisible.current;
      viewportVisible.current = visible;
      if (visible) setViewportSeen(true);
      if (visible && panel && amenityControls) {
        const bottom = amenityControls.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
        panel.style.setProperty("--map-amenities-bottom", `${Math.ceil(bottom)}px`);
      }
      const rt = runtime.current;
      if (rt && !rt.viewer.isDestroyed()) {
        rt.viewer.useDefaultRenderLoop = visible;
        if (visible) {rt.viewer.resize(); rt.viewer.scene.requestRender();}
        if(becameVisible)setVisibilityTick(value=>value+1);
      }
    });
    observer.observe(element);
    if (amenityControls) observer.observe(amenityControls);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!shouldLoad || !viewportSeen || !config.configured || !container.current || !creditContainer.current) return;
    let disposed = false; let viewer: Cesium.Viewer | null = null; let removeError: (() => void) | undefined; let removeInput: (() => void) | undefined;
    setStatus("loading");
    void (async () => {
      try {
        const C = await loadEngine(); if (disposed || !container.current || !creditContainer.current) return;
        C.Ion.defaultAccessToken = config.provider === "cesium-ion" ? config.credential : "";
        viewer = new C.Viewer(container.current, { creditContainer: creditContainer.current, useDefaultRenderLoop: false, globe: false, baseLayer: false, geocoder: false, animation: false, timeline: false, baseLayerPicker: false, sceneModePicker: false, homeButton: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, requestRenderMode: true, useBrowserRecommendedResolution: false, contextOptions: {webgl: {antialias: true}} });
        removeInput = installMapCameraInput(C,viewer,()=>inputModeRef.current);
        // Native pixel density up to 2x; FXAA must not soften icon textures.
        viewer.resolutionScale = Math.min(1, 2 / Math.max(1, window.devicePixelRatio));
        viewer.scene.postProcessStages.fxaa.enabled = false;
        viewer.scene.backgroundColor = C.Color.fromCssColorString("#223341");
        const tileOptions = { maximumScreenSpaceError: 12, cacheBytes: 256 * 1024 * 1024, maximumCacheOverflowBytes: 128 * 1024 * 1024, showCreditsOnScreen: true };
        // Explicit ion asset avoids the helper's cached failed request when the user retries.
        // No geocoder is enabled; listing positions and OSM facilities are independent of the imagery.
        const tiles = config.provider === "cesium-ion"
          ? await C.Cesium3DTileset.fromIonAssetId(2275207, tileOptions)
          : await C.createGooglePhotorealistic3DTileset({ key: config.credential, onlyUsingWithGoogleGeocoder: true }, tileOptions);
        if (disposed) { tiles.destroy(); return; }
        viewer.scene.primitives.add(tiles);
        const amenities = createAmenityLayer(C);
        const amenityFocus = new C.CustomDataSource("selected-amenity");
        await viewer.dataSources.add(amenities);
        await viewer.dataSources.add(amenityFocus);
        if (disposed) return;
        // A provider failure must never be presented as an empty but working map.
        removeError = tiles.tileFailed.addEventListener(() => { if (!disposed) setStatus("error"); });
        const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((event: { position: Cesium.Cartesian2 }) => {
          const picked = viewer?.scene.pick(event.position);
          if (picked?.id instanceof C.Entity && picked.id.id.startsWith("listing:")) clickCallback.current(picked.id.id.slice(8));
          if (picked?.id instanceof C.Entity && picked.id.id.startsWith("amenity:")) {amenityClick.current(picked.id.id.slice(8));}
          if (viewer && Array.isArray(picked?.id) && picked.id.length && picked.id.every((e: Cesium.Entity) => e instanceof C.Entity && e.id.startsWith("amenity:"))) {
            const points = (picked.id as Cesium.Entity[]).flatMap(e => {
              const position = e.position?.getValue(C.JulianDate.now());
              if (!position) return [];
              const p = C.Cartographic.fromCartesian(position);
              return [{lng:C.Math.toDegrees(p.longitude), lat:C.Math.toDegrees(p.latitude)}];
            });
            amenityClick.current(null);
            amenityOverview.current = points;
            setFocusTick(value => value + 1);
          }
        }, C.ScreenSpaceEventType.LEFT_CLICK);
        viewer.screenSpaceEventHandler.setInputAction(() => {}, C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        runtime.current = {C, viewer, tiles, amenities, amenityFocus};
        setLabelScene({C,viewer});
        viewer.useDefaultRenderLoop = viewportVisible.current;
        // The tileset metadata loaded; local imagery coverage still needs visual acceptance per city.
        setStatus("ready");
        const originalDestroy = viewer.destroy.bind(viewer);
        viewer.destroy = () => { handler.destroy(); return originalDestroy(); };
      } catch { if (!disposed) setStatus("error"); }
    })();
    return () => { disposed = true; removeInput?.(); removeError?.(); runtime.current = null; if (viewer && !viewer.isDestroyed()) viewer.destroy(); };
  }, [shouldLoad, retry, viewportSeen, inputModeRef]);
  useEffect(() => {
    const rt = runtime.current; if (!rt || status !== "ready") return;
    function adjustClusters() {
      if (!rt || rt.viewer.isDestroyed()) return;
      const height=rt.viewer.camera.positionCartographic.height;
      const spacing=height>2000?64:height>850?48:32;
      if(rt.amenities.clustering.pixelRange!==spacing){rt.amenities.clustering.pixelRange=spacing;rt.viewer.scene.requestRender();}
    }
    const remove=rt.viewer.camera.changed.addEventListener(adjustClusters);
    adjustClusters();return () => remove();
  }, [status]);
  useEffect(() => {
    const rt = runtime.current; if (!rt || status !== "ready") return;
    updateAmenityLayer(rt.C, rt.amenities, rt.amenityFocus, visibleAmenities, selectedAmenity?.id, {nativeSelectedLabel:true});
    rt.viewer.scene.requestRender();
  }, [visibleAmenities, selectedAmenity?.id, status]);
  useEffect(() => {
    const rt = runtime.current; if (!rt || status !== "ready") return;
    // Only route geometry owns these entities; panel/hover changes must not restart the reveal.
    const {C, viewer, tiles} = rt; viewer.entities.removeAll();
    if (route) {
      const cleanup = drawWalkingRoute(C, viewer, tiles, route);
      viewer.scene.requestRender();
      return cleanup;
    }
    // Apartment and campus labels render as native text/SVG above the WebGL scene.
    if(transitJourney){
      for(const [i,leg] of transitJourney.legs.entries())if(leg.coordinates.length>1)viewer.entities.add({id:`transit-leg:${i}`,polyline:{positions:C.Cartesian3.fromDegreesArray(leg.coordinates.flat()),width:leg.mode==="walking"?3:5,clampToGround:true,material:C.Color.fromCssColorString(leg.mode==="walking"?"#3e9d7d":"#587db7")}});
    }
    viewer.scene.requestRender();
  }, [status, route,transitJourney]);
  const cameraContext = JSON.stringify([city.id,selected,routeListingId,selection.selectedPlaceId,selection.routePlaceId,studentPlan.destinationId,studentPlan.routeBuilding,studentPlan.transitRequested,studentPlan.catchmentMinutes]);
  useEffect(() => {
    const rt=runtime.current; if (!rt || status !== "ready") return;
    if (!viewportVisible.current) return;
    const {C, viewer}=rt;
    if (restoredView) {
      if (restoredCamera.current?.key !== restoredView.key) restoredCamera.current={key:restoredView.key,context:cameraContext,tick:focusTick,viewer:null,released:false};
      const memory=restoredCamera.current;
      if (memory.context !== cameraContext || memory.tick !== focusTick) memory.released=true;
      if (!memory.released) {
        if (memory.viewer !== viewer) {
          const pose=restoredView.camera;
          viewer.camera.cancelFlight();
          viewer.camera.setView({destination:C.Cartesian3.fromDegrees(pose.longitude,pose.latitude,pose.height),orientation:{heading:pose.heading,pitch:pose.pitch,roll:pose.roll}});
          viewer.scene.requestRender();memory.viewer=viewer;
        }
        // Late route/POI responses must not replace the view restored from details.
        return;
      }
    }
    if(transitJourney){const coordinates=transitJourney.legs.flatMap(l=>l.coordinates);if(coordinates.length>1){fitWalkingRoute(C,viewer,{coordinates},container.current);return;}}
    if (amenityOverview.current) {
      const points = amenityOverview.current;
      amenityOverview.current = null;
      fitAmenities(C, viewer, points, container.current);
      return;
    }
    if (selectedAmenity && !amenityRouteEnabled) {fitAmenities(C, viewer, [selectedAmenity], container.current); return;}
    if (route) {
      fitWalkingRoute(C, viewer, route, container.current);
      return;
    }
    if (selectedAmenity) {fitAmenities(C, viewer, [selectedAmenity], container.current); return;}
    if(selectedBuilding){fitMapLabelTarget({C,viewer},selectedBuilding.lng,selectedBuilding.lat,studentPlan.catchmentMinutes?Math.max(1800,studentPlan.catchmentMinutes*110):1600);return;}
    fitMapLabelTarget({C,viewer},active?.lng ?? city.lng,active?.lat ?? city.lat,active ? 1200 : 2200);
  }, [city, active, status, focusTick, route, selectedAmenity, amenityRouteEnabled,selectedBuilding,studentPlan.catchmentMinutes,transitJourney,cameraContext,restoredView,visibilityTick]);
  function cameraAction(action: "in" | "out" | "rotate" | "campus") {
    const rt=runtime.current;if(!rt)return;const {C,viewer}=rt;
    if(action==="in")viewer.camera.zoomIn(Math.max(50,viewer.camera.positionCartographic.height*.28));
    if(action==="out")viewer.camera.zoomOut(Math.max(50,viewer.camera.positionCartographic.height*.35));
    if(action==="rotate") {
      if (route) fitWalkingRoute(C, viewer, route, container.current, viewer.camera.heading + Math.PI / 4);
      else fitMapLabelTarget({C,viewer},selectedBuilding?.lng??active?.lng ?? city.lng,selectedBuilding?.lat??active?.lat ?? city.lat,1400,viewer.camera.heading+Math.PI/4);
    }
    if(action==="campus")fitMapLabelTarget({C,viewer},city.lng,city.lat,1800);
    viewer.scene.requestRender();
  }
  function searchVisibleArea() {
    const rt=runtime.current;if(!rt||status!=="ready")return;
    setOverlay(null);
    const {C,viewer}=rt, bounds=viewer.canvas.getBoundingClientRect(),root=container.current?.closest(".concept-lab")??null;
    const leftPanel=visibleSidePanel(root,".listing-panel"),rightPanel=visibleSidePanel(root,".assistant-panel");
    const left=Math.max(0,leftPanel?leftPanel.right-bounds.left:0)+12;
    const right=Math.min(bounds.width,rightPanel?rightPanel.left-bounds.left:bounds.width)-12;
    const top=12,bottom=bounds.height-12;
    if(right-left<40||bottom-top<40){setAreaError(true);return;}
    const polygon:MapSearchArea["polygon"]=[];
    for(const [x,y] of [[left,top],[right,top],[right,bottom],[left,bottom]]) {
      const position=viewer.camera.pickEllipsoid(new C.Cartesian2(x,y),C.Ellipsoid.WGS84);
      if(!position){setAreaError(true);return;}
      const point=C.Cartographic.fromCartesian(position);
      polygon.push([C.Math.toDegrees(point.longitude),C.Math.toDegrees(point.latitude)]);
    }
    setAreaError(false);onSearchArea({id:crypto.randomUUID(),polygon});
  }
  function toggleAmenity(category: AmenityCategory) {
    onSelectionChange(current => ({...current, categories: current.categories.includes(category) ? current.categories.filter(c => c !== category) : [...current.categories, category], placeIds: null}));
    setSelectedAmenityId(null);
    setAmenityRouteTarget(null);
    setRequested(true);
  }
  function focusAmenities(id?: string) {
    if (id) {
      setSelectedAmenityId(id); setAmenityRouteTarget(null);
      setOverlay("journey");
    }
    else {
      setSelectedAmenityId(null);
      amenityOverview.current = visibleAmenities;
      setFocusTick(value => value + 1);
    }
  }
  useEffect(() => {
    const node = container.current;
    if (!node || status !== "ready") return;
    let lastWidth = node.clientWidth, lastHeight = node.clientHeight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      const width=node.clientWidth,height=node.clientHeight;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth=width;lastHeight=height;clearTimeout(timer);
      if (width > 0 && height > 0) timer=setTimeout(()=>{runtime.current?.viewer.resize();runtime.current?.viewer.scene.requestRender();},140);
    });
    observer.observe(node);
    return () => {observer.disconnect();clearTimeout(timer);};
  }, [status]);
  useEffect(() => {
    const render = () => { runtime.current?.viewer.resize();runtime.current?.viewer.scene.requestRender(); };
    window.addEventListener("atlas-workspace-layout", render);
    return () => window.removeEventListener("atlas-workspace-layout", render);
  }, []);
  const live=status==="ready";
  const hasJourney = amenityRouteEnabled || (!selectedAmenity && (Boolean(routeTarget) || studentPlan.routeBuilding || studentPlan.transitRequested));
  const journeyKey = `${selected}:${amenityRouteEnabled ? selectedAmenity?.id : studentPlan.transitRequested ? "transit:" + studentPlan.destinationId : studentPlan.routeBuilding ? studentPlan.destinationId : "campus"}`;
  useEffect(() => {
    const panel=container.current?.parentElement;
    if(!panel)return;
    const layers=panel.querySelector<HTMLElement>(".workspace-layer-body");
    const toolbar=panel.querySelector<HTMLElement>(".map-toolbar");
    const bottomCard=panel.querySelector<HTMLElement>(".map-journey-shell, .map-selected");
    const measure=()=>{
      const bounds=panel.getBoundingClientRect();
      const bottom=bottomCard?.getBoundingClientRect().top ?? bounds.bottom-85;
      const toolbarBottom=(toolbar?.getBoundingClientRect().bottom ?? bounds.top+64)-bounds.top;
      const noticeTop=toolbarBottom+12;
      // Keep the title, camera controls and fallback notice below the real toolbar height.
      panel.style.setProperty("--map-tools-bottom",`${toolbarBottom}px`);
      panel.parentElement?.style.setProperty("--map-tools-bottom",`${toolbarBottom}px`);
      panel.style.setProperty("--map-notice-top",`${noticeTop}px`);
      panel.style.setProperty("--map-notice-room",`${Math.max(0,bottom-bounds.top-noticeTop-12)}px`);
      if(layers && overlay==="layers")layers.style.setProperty("--layer-room",`${Math.max(0,bottom-layers.getBoundingClientRect().top-12)}px`);
    };
    const observer=new ResizeObserver(measure);
    observer.observe(panel);
    if(toolbar)observer.observe(toolbar);
    if(bottomCard)observer.observe(bottomCard);
    const frame=requestAnimationFrame(measure);
    window.addEventListener("atlas-workspace-layout",measure);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener("atlas-workspace-layout",measure);};
  },[overlay,hasJourney,journeyKey,selectedAmenity,live,showListingInfo]);
  const journeyStatus = amenityRouteEnabled ? facilityRoute.status : studentPlan.transitRequested ? transit.status : studentPlan.routeBuilding ? buildingRoute.status : routeStatus;
  const journeyTitle = amenityRouteEnabled ? selectedAmenity!.name : selectedBuilding && (studentPlan.routeBuilding || studentPlan.transitRequested) ? selectedBuilding.name : cityView.university;

  const amenityDetails = selectedAmenity && <AmenityDetails place={selectedAmenity} listing={active} route={facilityRoute.route} routeStatus={facilityRoute.status} routeError={facilityRoute.error}
    onRoute={() => {if(active){setAmenityRouteTarget(`${active.id}:${selectedAmenity.id}`);facilityRoute.retry();setRequested(true);}}}
    onFitRoute={fitCurrentRoute} onClearRoute={() => setAmenityRouteTarget(null)} onClose={() => setSelectedAmenityId(null)}/>;
  const journeyContent = selectedAmenity ? amenityDetails
    : studentPlan.transitRequested && selectedBuilding ? <TransitJourneyPanel listing={active} building={selectedBuilding} journeys={transit.journeys} status={transit.status} onClose={onStudentClose} onRetry={transit.retry} onFit={fitCurrentRoute}/>
    : studentPlan.routeBuilding && selectedBuilding ? <BuildingJourneyPanel building={selectedBuilding} route={buildingRoute.route} status={buildingRoute.status} onClose={onStudentClose} onRetry={buildingRoute.retry} onFit={fitCurrentRoute}/>
    : routeTarget ? <WalkingRoutePanel city={city} listing={routeTarget} status={routeStatus} route={campusRoute} onClose={onCloseRoute} onRetry={retryRoute} onFit={fitCurrentRoute}/>
    : active && showListingInfo && <div className="map-selected">
      <span className="map-selected-icon"><MapPin size={16}/></span>
      <div className="map-selected-copy"><small>{t("已选演示房源")}{!live ? t(" · 地图连接后定位") : ""}</small><div className="map-selected-main"><strong title={active.name}>{active.name}</strong><span className="map-selected-price">{priceLabel(active)} / {cityView.period}</span></div></div>
      <button className="map-selected-close" aria-label={locale === "zh" ? "关闭房源信息" : "Close home summary"} title={locale === "zh" ? "关闭房源信息" : "Close home summary"} onClick={onToggleListingInfo}><X size={16}/></button>
    </div>;
  // Manual coverage check at the sample campus on 2026-10-08, not a country-wide guarantee.
  const limitedCoverage = city.id === "kuala-lumpur";
  const connectionTitle = status === "missing" ? t("实景三维地图待连接") : status === "idle" ? t("实景三维已配置，点击加载") : status === "loading" ? t("正在连接实景城市…") : t("实景地图暂时无法加载");
  const connectionText = !config.validProvider ? t("地图配置无效，请按接入说明选择服务。")
    : status === "missing" ? (config.provider === "cesium-ion" ? t("当前方案：Cesium ion 免费评估。填写 token 后即可开始。") : t("请填写 Google Map Tiles API 浏览器密钥。"))
    : status === "idle" ? t("点击后才请求地图数据；本页切换城市共用一次连接。")
    : status === "loading" ? t("首次加载需要下载城市三维数据。")
    : config.provider === "cesium-ion" ? t("请检查 token、Google 3D 资产权限、允许的网址和本月用量。") : t("请检查网络、地图权限与配额，或稍后重试。");
  return <section className={`city-panel ${live ? "map-live" : ""} ${routeTarget || amenityRouteEnabled||studentPlan.routeBuilding||studentPlan.transitRequested ? "has-route" : ""} ${limitedCoverage ? "limited-coverage" : ""} ${overlay ? "is-overlay-open" : ""}`} aria-label={t("{0}城市地图", {0:city.name})}>
    <div ref={container} className="cesium-mount" aria-label={t("实景三维画布")}/>
    <MapAttribution nativeRef={creditContainer} visible={live}/>
    {live && <MapPlaceLabels scene={labelScene} city={city} listings={listings} selected={selected} hovered={hovered} onHover={onHover} place={selectedAmenity} hideCampus={Boolean(selectedBuilding)} routeActive={Boolean(route)||studentPlan.transitRequested} onSelect={onSelect} onCampus={()=>cameraAction("campus")} onPlace={id=>{setSelectedAmenityId(id);setAmenityRouteTarget(null);}}/>}
    {live&&(studentPlan.showBuildings||studentPlan.destinationId)&&<Suspense fallback={null}><CampusMapLayer scene={labelScene} cityId={city.id} plan={studentPlan} onSelect={onBuildingSelect}/></Suspense>}
    {!live && <><img className="city-photo" src={cityPhoto(city.id)} alt={t("{0}城市风光预览", {0:city.name})}/><div className="city-shade"/></>}
    <div className="map-top"><div className="map-city"><span className="dot"/> EXPLORE {city.english.toUpperCase()}</div><span className="map-mode">{live ? (limitedCoverage ? t("影像地形") : t("实景 3D")) : t("城市照片预览")}</span></div>
    <div className="map-toolbar" role="group" aria-label={locale === "zh" ? "地图工具" : "Map tools"}>
    <MapLayers key={city.id} open={overlay === "layers"} onOpenChange={open=>{setAreaError(false);setOverlay(open?"layers":null);}} plan={studentPlan} amenityCount={amenityCategories.length} onStudentChange={onStudentChange} onPlanner={onPlanner} onClearAmenities={() => patchSelection({categories:[],placeIds:null,selectedPlaceId:null,routePlaceId:null})}><AmenityControls key={city.id} categories={amenityCategories} data={amenitiesData} status={amenitiesStatus} visible={visibleAmenities} selected={selectedAmenity} listing={active} radius={radius} cuisine={cuisine}
      onRadius={value => patchSelection({radiusMeters: value, placeIds: null, selectedPlaceId: null, routePlaceId: null})}
      onCuisine={value => patchSelection({cuisine: value, placeIds: null, selectedPlaceId: null, routePlaceId: null})}
      onExplore={() => setAmenitiesRequested(true)} onClear={() => patchSelection({categories: [], placeIds: null, selectedPlaceId: null, routePlaceId: null})}
      onToggle={toggleAmenity} onSelect={focusAmenities} onDismiss={() => setSelectedAmenityId(null)} onFit={() => focusAmenities()} onRetry={retryAmenities}/></MapLayers>
    {live && <div className="map-area-search">
      <button onClick={searchVisibleArea}><Search size={15}/>{locale==="zh"?"搜索此区域":"Search this area"}</button>
      <span className="sr-only" role="status">{areaActive ? (locale==="zh"?`区域搜索结果：${areaResultCount} 套房源`:`Area search results: ${areaResultCount} homes`) : ""}</span>
      {areaError && <small role="alert">{locale==="zh"?"请调整为俯视地面的角度后重试。":"Tilt toward the ground, then retry."}</small>}
    </div>}
    {workspaceControls}
    </div>
    {live && limitedCoverage && <p className="map-coverage" role="note">{t("当前校区建筑三维细节不足，显示影像地形。2026-10-08 实测；其他区域覆盖可能不同。")}</p>}
    {!live && <div className="map-intro"><p>{t("先认识这座城，再找到你的家。")}</p><h2>{city.english}{locale === "zh" && <span>{cityView.name}</span>}</h2><div className="map-connection"><Building2 size={22}/><div><strong>{connectionTitle}</strong><p>{connectionText}</p><div className="connection-actions">{status==="idle" && <button onClick={()=>setRequested(true)}>{t("加载实景 3D")}</button>}{status==="error" && <button onClick={()=>setRetry(v=>v+1)}>{t("重新连接")}</button>}<a href="/setup" target="_blank" rel="noreferrer">{t("查看接入说明")} <ChevronIcon/></a></div></div></div></div>}
    {live && <div className="map-controls"><button aria-label={t("放大地图")} onClick={()=>cameraAction("in")}><Plus size={19}/></button><button aria-label={t("缩小地图")} onClick={()=>cameraAction("out")}><Minus size={19}/></button><button aria-label={t("旋转地图")} onClick={()=>cameraAction("rotate")}><RotateCw size={18}/></button><button aria-label={t("回到大学")} onClick={()=>cameraAction("campus")}><GraduationCap size={20}/></button><button aria-label={t("重新定位房源")} aria-pressed={showListingInfo} onClick={()=>{onToggleListingInfo();if(!showListingInfo)setFocusTick(v=>v+1);}}><Compass size={20}/></button><MapInputHelp mode={inputMode} onChange={updateInputMode}/></div>}
    {hasJourney || selectedAmenity ? <JourneyDisclosure key={journeyKey} expanded={overlay === "journey"} onExpandedChange={open=>setOverlay(open?"journey":null)} place={!hasJourney} title={selectedAmenity?.name ?? journeyTitle} status={journeyStatus} seconds={studentPlan.transitRequested && !amenityRouteEnabled ? transitJourney ? transitJourney.durationMinutes * 60 : undefined : route?.durationSeconds} meters={studentPlan.transitRequested && !amenityRouteEnabled ? undefined : route?.distanceMeters} transit={studentPlan.transitRequested && !amenityRouteEnabled} onClear={!hasJourney ? () => setSelectedAmenityId(null) : amenityRouteEnabled ? () => setAmenityRouteTarget(null) : studentPlan.routeBuilding || studentPlan.transitRequested ? onStudentClose : onCloseRoute}>
      {journeyContent}
    </JourneyDisclosure> : journeyContent}
    <div className="map-bottom"><div><Navigation size={17}/><span>{cityView.campus}</span></div><span>{live?t("双指滑动平移 · 捏合缩放 · Shift + 滑动旋转"):t("照片预览 · 非可交互地图")}</span></div>
  </section>;
}
function ChevronIcon(){return <span aria-hidden="true">↗</span>;}
