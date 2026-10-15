"use client";
import { displayCity } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import MapAttribution from "@/components/map-attribution";
import MapInputHelp from "@/components/map-input-help";
import {installMapCameraInput} from "@/lib/map-camera-input";
import {useMapInputMode} from "@/lib/use-map-input";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Cesium from "cesium";
import { Building2, Compass, GraduationCap, MapPin, Minus, Navigation, Plus, RotateCw } from "lucide-react";
import { cityPhoto, priceLabel, type City, type Listing } from "@/lib/rental-data";
import { resolveMapConfig } from "@/lib/map-config";
import { useWalkingRoute } from "@/lib/use-walking-route";
import WalkingRoutePanel from "@/components/walking-route-panel";
import { drawWalkingRoute, fitWalkingRoute } from "@/lib/walking-route-display";
import { useAmenities } from "@/lib/use-amenities";
import { type AmenityCategory } from "@/lib/amenities";
import { selectAmenities } from "@/lib/amenity-query";
import type { MapSelection } from "@/lib/agent/contract";
import { useAmenityRoute } from "@/lib/use-amenity-route";
import { createAmenityLayer, updateAmenityLayer, fitAmenities } from "@/lib/amenity-display";
import AmenityControls, { AmenityDetails } from "@/components/amenity-controls";

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
export default function CityMap({ city, listings, selected, onSelect, autoLoad, routeListingId, onCloseRoute, selection, onSelectionChange }: {
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
  const [viewportSeen, setViewportSeen] = useState(false);
  const runtime = useRef<{ C: Engine; viewer: Cesium.Viewer; tiles: Cesium.Cesium3DTileset; amenities: Cesium.CustomDataSource; amenityFocus: Cesium.CustomDataSource } | null>(null);
  const amenityOverview = useRef<Array<{lng:number;lat:number}> | null>(null);
  const clickCallback = useRef(onSelect);
  useEffect(() => { clickCallback.current = onSelect; }, [onSelect]);
  const [status, setStatus] = useState<"missing" | "idle" | "loading" | "ready" | "error">(config.configured ? "idle" : "missing");
  const [requested, setRequested] = useState(false);
  const [retry, setRetry] = useState(0);
  const amenityCategories = selection.categories;
  const selectedAmenityId = selection.selectedPlaceId;
  const patchSelection = (patch: Partial<MapSelection>) => onSelectionChange(current => ({...current, ...patch}));
  const setSelectedAmenityId = (id: string | null) => patchSelection({selectedPlaceId: id});
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
  const route = amenityRouteEnabled ? facilityRoute.route : campusRoute;
  const shouldLoad = requested || autoLoad;
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const panel = element.parentElement;
    const amenityControls = panel?.querySelector<HTMLElement>(".map-amenities");
    const observer = new ResizeObserver(() => {
      const bounds = element.getBoundingClientRect();
      const visible = bounds.width > 1 && bounds.height > 1;
      const becameVisible = visible && !viewportVisible.current;
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
        if (becameVisible) setFocusTick(value => value + 1);
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
        viewer = new C.Viewer(container.current, { creditContainer: creditContainer.current, useDefaultRenderLoop: false, globe: false, baseLayer: false, geocoder: false, animation: false, timeline: false, baseLayerPicker: false, sceneModePicker: false, homeButton: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false, requestRenderMode: true });
        removeInput = installMapCameraInput(C,viewer,()=>inputModeRef.current);
        viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.5);
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
          if (picked?.id instanceof C.Entity && picked.id.id.startsWith("amenity:")) {setSelectedAmenityId(picked.id.id.slice(8)); setAmenityRouteTarget(null);}
          if (viewer && Array.isArray(picked?.id) && picked.id.length && picked.id.every((e: Cesium.Entity) => e instanceof C.Entity && e.id.startsWith("amenity:"))) {
            const points = (picked.id as Cesium.Entity[]).flatMap(e => {
              const position = e.position?.getValue(C.JulianDate.now());
              if (!position) return [];
              const p = C.Cartographic.fromCartesian(position);
              return [{lng:C.Math.toDegrees(p.longitude), lat:C.Math.toDegrees(p.latitude)}];
            });
            setSelectedAmenityId(null);
            amenityOverview.current = points;
            setFocusTick(value => value + 1);
          }
        }, C.ScreenSpaceEventType.LEFT_CLICK);
        viewer.screenSpaceEventHandler.setInputAction(() => {}, C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        runtime.current = {C, viewer, tiles, amenities, amenityFocus};
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
    updateAmenityLayer(rt.C, rt.amenities, rt.amenityFocus, visibleAmenities, selectedAmenity?.id);
    rt.viewer.scene.requestRender();
  }, [visibleAmenities, selectedAmenity?.id, status]);
  useEffect(() => {
    const rt = runtime.current; if (!rt || status !== "ready") return;
    const {C, viewer, tiles} = rt; viewer.entities.removeAll();
    if (route) {
      const cleanup = drawWalkingRoute(C, viewer, tiles, route);
      viewer.scene.requestRender();
      return cleanup;
    }
    viewer.entities.add({id:"campus",position:C.Cartesian3.fromDegrees(city.lng, city.lat),point:{pixelSize:12,color:C.Color.fromCssColorString("#d8a959"),outlineColor:C.Color.WHITE,outlineWidth:3,heightReference:C.HeightReference.CLAMP_TO_3D_TILE,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:cityView.university,font:"14px sans-serif",fillColor:C.Color.WHITE,showBackground:true,backgroundColor:C.Color.fromCssColorString("#85672fee"),pixelOffset:new C.Cartesian2(0,-30),heightReference:C.HeightReference.CLAMP_TO_3D_TILE,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
    for (const l of listings) viewer.entities.add({id:`listing:${l.id}`,position:C.Cartesian3.fromDegrees(l.lng,l.lat),point:{pixelSize:l.id===selected?13:8,color:C.Color.fromCssColorString("#5d80ff"),outlineColor:C.Color.WHITE,outlineWidth:2,heightReference:C.HeightReference.CLAMP_TO_3D_TILE,disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:priceLabel(l),font:`${l.id===selected?"bold ":""}14px sans-serif`,fillColor:l.id===selected?C.Color.WHITE:C.Color.fromCssColorString("#23416b"),showBackground:true,backgroundColor:C.Color.fromCssColorString(l.id===selected?"#345cf0":"#fffffff2"),backgroundPadding:new C.Cartesian2(9,7),pixelOffset:new C.Cartesian2(0,-28),heightReference:C.HeightReference.CLAMP_TO_3D_TILE,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
    viewer.scene.requestRender();
  }, [city, cityView.university, listings, selected, status, route]);
  useEffect(() => {
    const rt=runtime.current; if (!rt || status !== "ready") return;
    if (!viewportVisible.current) return;
    const {C, viewer}=rt;
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
    viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(active?.lng ?? city.lng,active?.lat ?? city.lat,40),80),{duration:window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:1.4,offset:new C.HeadingPitchRange(0,-0.62,active?1000:2200)});
  }, [city, active, status, focusTick, route, selectedAmenity, amenityRouteEnabled]);
  function cameraAction(action: "in" | "out" | "rotate" | "campus") {
    const rt=runtime.current;if(!rt)return;const {C,viewer}=rt;
    if(action==="in")viewer.camera.zoomIn(Math.max(50,viewer.camera.positionCartographic.height*.28));
    if(action==="out")viewer.camera.zoomOut(Math.max(50,viewer.camera.positionCartographic.height*.35));
    if(action==="rotate") {
      if (route) fitWalkingRoute(C, viewer, route, container.current, viewer.camera.heading + Math.PI / 4);
      else {viewer.camera.lookAt(C.Cartesian3.fromDegrees(active?.lng??city.lng,active?.lat??city.lat,30),new C.HeadingPitchRange(viewer.camera.heading+Math.PI/4,-.65,1400));viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);}
    }
    if(action==="campus")viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(city.lng,city.lat,30),80),{offset:new C.HeadingPitchRange(0,-.65,1800),duration:1.2});
    viewer.scene.requestRender();
  }
  function toggleAmenity(category: AmenityCategory) {
    onSelectionChange(current => ({...current, categories: current.categories.includes(category) ? current.categories.filter(c => c !== category) : [...current.categories, category], placeIds: null}));
    setSelectedAmenityId(null);
    setAmenityRouteTarget(null);
    setRequested(true);
  }
  function focusAmenities(id?: string) {
    if (id) {setSelectedAmenityId(id); setAmenityRouteTarget(null);}
    else {
      setSelectedAmenityId(null);
      amenityOverview.current = visibleAmenities;
      setFocusTick(value => value + 1);
    }
  }
  const live=status==="ready";
  // Manual coverage check at the sample campus on 2026-10-08, not a country-wide guarantee.
  const limitedCoverage = city.id === "kuala-lumpur";
  const connectionTitle = status === "missing" ? t("实景三维地图待连接") : status === "idle" ? t("实景三维已配置，点击加载") : status === "loading" ? t("正在连接实景城市…") : t("实景地图暂时无法加载");
  const connectionText = !config.validProvider ? t("地图配置无效，请按接入说明选择服务。")
    : status === "missing" ? (config.provider === "cesium-ion" ? t("当前方案：Cesium ion 免费评估。填写 token 后即可开始。") : t("请填写 Google Map Tiles API 浏览器密钥。"))
    : status === "idle" ? t("点击后才请求地图数据；本页切换城市共用一次连接。")
    : status === "loading" ? t("首次加载需要下载城市三维数据。")
    : config.provider === "cesium-ion" ? t("请检查 token、Google 3D 资产权限、允许的网址和本月用量。") : t("请检查网络、地图权限与配额，或稍后重试。");
  return <section className={`city-panel ${live ? "map-live" : ""} ${routeTarget ? "has-route" : ""} ${limitedCoverage ? "limited-coverage" : ""}`} aria-label={t("{0}城市地图", {0:city.name})}>
    <div ref={container} className="cesium-mount" aria-label={t("实景三维画布")}/>
    <MapAttribution nativeRef={creditContainer} visible={live}/>
    {!live && <><img className="city-photo" src={cityPhoto(city.id)} alt={t("{0}城市风光预览", {0:city.name})}/><div className="city-shade"/></>}
    <div className="map-top"><div className="map-city"><span className="dot"/> EXPLORE {city.english.toUpperCase()}</div><span className="map-mode">{live ? (limitedCoverage ? t("影像地形") : t("实景 3D")) : t("城市照片预览")}</span></div>
    <AmenityControls key={city.id} categories={amenityCategories} data={amenitiesData} status={amenitiesStatus} visible={visibleAmenities} selected={selectedAmenity} listing={active} radius={radius} cuisine={cuisine}
      onRadius={value => patchSelection({radiusMeters: value, placeIds: null, selectedPlaceId: null, routePlaceId: null})}
      onCuisine={value => patchSelection({cuisine: value, placeIds: null, selectedPlaceId: null, routePlaceId: null})}
      onExplore={() => setAmenitiesRequested(true)} onClear={() => patchSelection({categories: [], placeIds: null, selectedPlaceId: null, routePlaceId: null})}
      onToggle={toggleAmenity} onSelect={focusAmenities} onDismiss={() => setSelectedAmenityId(null)} onFit={() => focusAmenities()} onRetry={retryAmenities}/>
    {live && limitedCoverage && <p className="map-coverage" role="note">{t("当前校区建筑三维细节不足，显示影像地形。2026-10-08 实测；其他区域覆盖可能不同。")}</p>}
    {!live && <div className="map-intro"><p>{t("先认识这座城，再找到你的家。")}</p><h2>{city.english}{locale === "zh" && <span>{cityView.name}</span>}</h2><div className="map-connection"><Building2 size={22}/><div><strong>{connectionTitle}</strong><p>{connectionText}</p><div className="connection-actions">{status==="idle" && <button onClick={()=>setRequested(true)}>{t("加载实景 3D")}</button>}{status==="error" && <button onClick={()=>setRetry(v=>v+1)}>{t("重新连接")}</button>}<a href="/setup" target="_blank" rel="noreferrer">{t("查看接入说明")} <ChevronIcon/></a></div></div></div></div>}
    {live && <div className="map-controls"><button aria-label={t("放大地图")} onClick={()=>cameraAction("in")}><Plus size={19}/></button><button aria-label={t("缩小地图")} onClick={()=>cameraAction("out")}><Minus size={19}/></button><button aria-label={t("旋转地图")} onClick={()=>cameraAction("rotate")}><RotateCw size={18}/></button><button aria-label={t("回到大学")} onClick={()=>cameraAction("campus")}><GraduationCap size={20}/></button><button aria-label={t("重新定位房源")} onClick={()=>setFocusTick(v=>v+1)}><Compass size={20}/></button><MapInputHelp mode={inputMode} onChange={updateInputMode}/></div>}
    {selectedAmenity ? <AmenityDetails place={selectedAmenity} listing={active} route={facilityRoute.route} routeStatus={facilityRoute.status} routeError={facilityRoute.error}
      onRoute={() => {if (active) {setAmenityRouteTarget(`${active.id}:${selectedAmenity.id}`); facilityRoute.retry(); setRequested(true);}}}
      onFitRoute={() => setFocusTick(v => v + 1)} onClearRoute={() => setAmenityRouteTarget(null)} onClose={() => setSelectedAmenityId(null)}/>
      : routeTarget ? <WalkingRoutePanel city={city} listing={routeTarget} status={routeStatus} route={campusRoute} onClose={onCloseRoute} onRetry={retryRoute} onFit={() => setFocusTick(v => v + 1)}/> : active && <div className="map-selected"><span className="map-selected-icon"><MapPin size={17}/></span><div><small>{t("已选演示房源")}{!live ? t(" · 地图连接后定位") : ""}</small><strong>{active.name} <span>{priceLabel(active)} / {cityView.period}</span></strong></div></div>}
    <div className="map-bottom"><div><Navigation size={17}/><span>{cityView.campus}</span></div><span>{live?t("双指滑动平移 · 捏合缩放 · Shift + 滑动旋转"):t("照片预览 · 非可交互地图")}</span></div>
  </section>;
}
function ChevronIcon(){return <span aria-hidden="true">↗</span>;}
