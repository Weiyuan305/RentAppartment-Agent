import type * as Cesium from "cesium";
import { campusFrame } from "@/lib/guided/map-provider";
import { destroyLateTileset, loadCesiumScript } from "./cesium-loader";
import type { SceneHandle, ScenePadding } from "./scene-types";

type Engine = typeof Cesium;

function aborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error("timeout");
}

/** Dynamic-import only. The fallback path must not load this file or set an ion token. */
export async function mountGoogleScene(container: HTMLElement, options: {
  credential: string;
  mode: "cesium-ion" | "google-maps";
  signal: AbortSignal;
}): Promise<SceneHandle> {
  aborted(options.signal);
  const C = await loadCesiumScript(options.signal);
  aborted(options.signal);
  C.Ion.defaultAccessToken = options.mode === "cesium-ion" ? options.credential : "";
  const credit = document.createElement("div");
  const viewer = new C.Viewer(container, {
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
    creditContainer: credit,
  });
  viewer.scene.backgroundColor = C.Color.fromCssColorString("#F6F5F0");
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 3800;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 80;
  viewer.camera.setView({
    destination: C.Cartesian3.fromDegrees(campusFrame.lng, campusFrame.lat, 1100),
    orientation: { heading: C.Math.toRadians(-18), pitch: C.Math.toRadians(-48), roll: 0 },
  });
  const tileOptions = { maximumScreenSpaceError: 16 };
  const tilesPromise = options.mode === "google-maps"
    ? C.createGooglePhotorealistic3DTileset({ key: options.credential, onlyUsingWithGoogleGeocoder: true }, tileOptions)
    : C.Cesium3DTileset.fromIonAssetId(2275207, tileOptions);
  let tiles: Cesium.Cesium3DTileset;
  try {
    tiles = await raceTiles(tilesPromise, options.signal);
    aborted(options.signal);
    viewer.scene.primitives.add(tiles);
    await firstTile(tiles, options.signal);
    aborted(options.signal);
  } catch (error) {
    destroyLateTileset(tilesPromise);
    if (!viewer.isDestroyed()) viewer.destroy();
    throw error;
  }
  return cesiumHandle(C, viewer, () => { if (!tiles.isDestroyed()) tiles.destroy(); });
}

function raceTiles(promise: Promise<Cesium.Cesium3DTileset>, signal: AbortSignal) {
  return new Promise<Cesium.Cesium3DTileset>((resolve, reject) => {
    const fail = () => reject(new Error("timeout"));
    if (signal.aborted) { destroyLateTileset(promise); fail(); return; }
    const onAbort = () => { destroyLateTileset(promise); fail(); };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(value => {
      signal.removeEventListener("abort", onAbort);
      if (signal.aborted) { value.destroy(); fail(); return; }
      resolve(value);
    }, error => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
}

function firstTile(tiles: Cesium.Cesium3DTileset, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("timeout")); return; }
    const remove = tiles.tileLoad.addEventListener(() => { remove(); resolve(); });
    signal.addEventListener("abort", () => { remove(); reject(new Error("timeout")); }, { once: true });
  });
}

export function cesiumHandle(C: Engine, viewer: Cesium.Viewer, extraDestroy?: () => void): SceneHandle {
  let frame = 0;
  let padding: ScenePadding = { top: 0, right: 0, bottom: 0, left: 0 };
  const listeners = new Set<() => void>();
  const post = () => { for (const listener of listeners) listener(); };
  viewer.scene.postRender.addEventListener(post);
  const fly = (lng: number, lat: number, durationMs: number) => {
    const shift = (padding.bottom - padding.top) / Math.max(viewer.scene.canvas.clientHeight, 1);
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(lng, lat - shift * 0.004, 480),
      orientation: { heading: C.Math.toRadians(-18), pitch: C.Math.toRadians(-50), roll: 0 },
      duration: durationMs / 1000,
    });
  };
  return {
    flyTo(target, durationMs) { if (!viewer.isDestroyed()) fly(target.lng, target.lat, durationMs); },
    project(target) {
      if (viewer.isDestroyed()) return null;
      const position = C.Cartesian3.fromDegrees(target.lng, target.lat, 18);
      const windowPosition = C.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
      if (!windowPosition) return null;
      return { x: windowPosition.x, y: windowPosition.y };
    },
    setRoute(coordinates, durationMs) {
      cancelAnimationFrame(frame);
      const paint = (slice: Array<[number, number]>) => {
        if (viewer.isDestroyed()) return;
        viewer.entities.removeById("guided-route-paper");
        viewer.entities.removeById("guided-route");
        if (slice.length >= 2) {
          const positions = C.Cartesian3.fromDegreesArray(slice.flat());
          viewer.entities.add({ id: "guided-route-paper", polyline: { positions, width: 8, material: C.Color.fromCssColorString("#F6F5F0") } });
          viewer.entities.add({ id: "guided-route", polyline: { positions, width: 3, material: C.Color.fromCssColorString("#15181A") } });
        }
        viewer.scene.requestRender();
      };
      if (coordinates.length < 2 || durationMs <= 0) { paint(coordinates); return; }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        paint(coordinates.slice(0, Math.max(2, Math.ceil(coordinates.length * t))));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    setPadding(next) { padding = next; },
    resize() { if (!viewer.isDestroyed()) { viewer.resize(); viewer.scene.requestRender(); } },
    onMove(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      cancelAnimationFrame(frame);
      listeners.clear();
      if (!viewer.isDestroyed()) {
        viewer.scene.postRender.removeEventListener(post);
        viewer.destroy();
      }
      extraDestroy?.();
    },
  };
}
