import type * as Cesium from "cesium";
import { resolveMapConfig } from "@/lib/map-config";
import { GOOGLE_FIRST_TILE_MS } from "@/lib/overseas-failfast";
import { CAMPUS_VIEW, GOOGLE_TILE_BYTES, googleTileBudget } from "@/lib/v2/map-provider";
import { flightDurationMs } from "@/lib/v2/map-engine";
import { v2Ease } from "@/lib/v2/motion";
import { loadCesium } from "./cesium-loader";
import type { CameraTarget, MapHost, MapSession } from "./types";

const config = resolveMapConfig({
  VITE_MAP_PROVIDER: import.meta.env.VITE_MAP_PROVIDER,
  VITE_CESIUM_ION_ACCESS_TOKEN: import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN,
  VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
});

/**
 * Google Photorealistic 3D Tiles via the Cesium ion asset already used by the
 * current home (2275207), or the Google Map Tiles API when that provider is configured.
 * No new key is read. The overview image stays up until the caller is told the
 * first tiles are actually on screen.
 */
export async function startGooglePhotorealistic(host: MapHost): Promise<MapSession> {
  if (!config.configured) throw new Error("google-not-configured");
  const budget = googleTileBudget(host.viewport);
  const started = performance.now();
  const C = await loadCesium();
  // Cesium ships a default ion token. Clear it before the Viewer exists so
  // startup does not request ion imagery, terrain, or the credit logo.
  C.Ion.defaultAccessToken = "";
  let viewer: Cesium.Viewer | null = null;
  let tiles: Cesium.Cesium3DTileset | null = null;
  let discarded = false;
  let removeLoad = () => {};
  let removeFail = () => {};
  let removeInitial = () => {};
  let timer = 0;
  const routeEntity: { current: Cesium.Entity | null } = { current: null };
  const deadline = window.setTimeout(() => { discarded = true; }, GOOGLE_FIRST_TILE_MS);
  const giveUp = () => {
    window.clearTimeout(deadline);
    window.clearTimeout(timer);
    discarded = true;
    C.Ion.defaultAccessToken = "";
    removeLoad(); removeFail(); removeInitial();
    tiles?.destroy();
    if (viewer && !viewer.isDestroyed()) viewer.destroy();
    viewer = null;
  };
  try {
  viewer = new C.Viewer(host.canvas, {
    creditContainer: host.credits,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    baseLayer: false,
    globe: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  });
  viewer.scene.backgroundColor = C.Color.fromCssColorString("#F6F5F0");
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 2200;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
  look(C, viewer, { lng: CAMPUS_VIEW.lng, lat: CAMPUS_VIEW.lat, altitude: "campus" }, true);
  const tileOptions = {
    maximumScreenSpaceError: budget.screenSpaceError,
    cacheBytes: budget.cacheBytes,
    maximumCacheOverflowBytes: budget.overflowBytes,
    skipLevelOfDetail: true,
    immediatelyLoadDesiredLevelOfDetail: false,
    loadSiblings: false,
    cullWithChildrenBounds: true,
    foveatedScreenSpaceError: true,
    dynamicScreenSpaceError: true,
    dynamicScreenSpaceErrorFactor: 8,
    showCreditsOnScreen: false,
  };
  if (discarded) throw new Error("google-first-tile-timeout");
  if (config.provider === "cesium-ion") C.Ion.defaultAccessToken = config.credential;
  const loadedTiles = (config.provider === "cesium-ion"
    ? C.Cesium3DTileset.fromIonAssetId(2275207, tileOptions)
    : C.createGooglePhotorealistic3DTileset({ key: config.credential, onlyUsingWithGoogleGeocoder: true }, tileOptions)
  ).then((created) => {
    if (discarded) { created.destroy(); throw new Error("google-first-tile-timeout"); }
    return created;
  });
  tiles = await loadedTiles;
  const activeTiles = tiles;
  if (!viewer || !activeTiles || discarded) throw new Error("google-first-tile-timeout");
  viewer.scene.primitives.add(activeTiles);
  host.credits.textContent = "Google Photorealistic 3D Tiles";
  let loaded = 0;
  let failed = 0;
  let settled = false;
  let ready: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  const readyPromise = new Promise<void>((resolve, reject) => { ready = resolve; fail = reject; });
  removeLoad = activeTiles.tileLoad.addEventListener(() => {
    loaded += 1;
    host.onProgress({
      loaded,
      pending: 0,
      approxBytes: loaded * GOOGLE_TILE_BYTES,
      label: `实景瓦片 ${loaded} · 约 ${mb(loaded * GOOGLE_TILE_BYTES)}MB`,
    });
    if (loaded >= budget.maxRequests) activeTiles.maximumScreenSpaceError = Math.max(budget.screenSpaceError, 64);
    if (loaded >= 1) finish();
    viewer?.scene.requestRender();
  });
  removeFail = activeTiles.tileFailed.addEventListener(() => {
    failed += 1;
    if (!settled && failed >= 3 && loaded === 0) fail(new Error("google-tiles-failed"));
  });
  removeInitial = activeTiles.initialTilesLoaded.addEventListener(() => { if (loaded >= 1) finish(); });
  const remaining = Math.max(0, GOOGLE_FIRST_TILE_MS - (performance.now() - started));
  timer = window.setTimeout(() => { if (!settled) fail(new Error("google-first-tile-timeout")); }, remaining);
  function finish() {
    if (settled || discarded) return;
    settled = true;
    window.clearTimeout(timer);
    window.clearTimeout(deadline);
    ready();
  }
    await readyPromise;
  } catch (error) {
    giveUp();
    throw error;
  }
  const liveViewer = viewer;
  const liveTiles = tiles;
  if (!liveViewer || !liveTiles) throw new Error("google-first-tile-timeout");
  return {
    id: "google-photorealistic",
    flyTo(target) { look(C, liveViewer, target, host.reducedMotion); },
    setRoute(coordinates) { drawRoute(C, liveViewer, routeEntity, coordinates, host.reducedMotion); },
    project(lng, lat) {
      const position = C.Cartesian3.fromDegrees(lng, lat, 20);
      const point = C.SceneTransforms.worldToWindowCoordinates(liveViewer.scene, position);
      return point ? { x: point.x, y: point.y } : null;
    },
    highlightBuilding() {},
    nearestBuildingId() { return null; },
    destroy() {
      removeLoad();
      removeFail();
      removeInitial();
      C.Ion.defaultAccessToken = "";
      if (!liveViewer.isDestroyed()) liveViewer.destroy();
    },
  };
}

function mb(bytes: number) {
  return Math.max(0.1, Math.round(bytes / (1024 * 1024) * 10) / 10);
}

function look(C: typeof Cesium, viewer: Cesium.Viewer, target: CameraTarget, instant: boolean) {
  const height = target.altitude === "home" ? 420 : target.altitude === "overview" ? 1400 : CAMPUS_VIEW.height;
  viewer.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(target.lng, target.lat, height),
    orientation: { heading: 0, pitch: C.Math.toRadians(target.altitude === "home" ? -42 : CAMPUS_VIEW.pitchDeg), roll: 0 },
    duration: instant ? 0 : flightDurationMs(false) / 1000,
    easingFunction: (time) => v2Ease(time),
  });
  viewer.scene.requestRender();
}

function drawRoute(C: typeof Cesium, viewer: Cesium.Viewer, slot: { current: Cesium.Entity | null }, coordinates: [number, number][] | null, reduced: boolean) {
  if (slot.current) { viewer.entities.remove(slot.current); slot.current = null; }
  if (!coordinates || coordinates.length < 2) { viewer.scene.requestRender(); return; }
  const positions = coordinates.map(([lng, lat]) => C.Cartesian3.fromDegrees(lng, lat, 18));
  const started = performance.now();
  const duration = reduced ? 0 : 700;
  slot.current = viewer.entities.add({
    polyline: {
      positions: new C.CallbackProperty(() => {
        const t = duration === 0 ? 1 : Math.min(1, (performance.now() - started) / duration);
        const count = Math.max(2, Math.ceil(positions.length * v2Ease(t)));
        viewer.scene.requestRender();
        return positions.slice(0, count);
      }, false),
      width: 4,
      material: C.Color.fromCssColorString("#15181A"),
      arcType: C.ArcType.NONE,
    },
  });
  viewer.scene.requestRender();
}
