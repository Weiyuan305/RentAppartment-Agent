import { campusFrame } from "@/lib/guided/map-provider";
import { destroyLateTileset, loadCesiumScript } from "./cesium-loader";
import { cesiumHandle } from "./google-scene";
import type { SceneHandle } from "./scene-types";

/**
 * Future self-hosted 3D Tiles. Dynamic-import only, and only when VITE_GUIDED_FALLBACK points at a same-origin tileset.
 * The ion token is cleared so this path cannot wait on Cesium ion.
 */
export async function mountTilesScene(container: HTMLElement, options: { url: string; signal: AbortSignal }): Promise<SceneHandle> {
  if (options.signal.aborted) throw new Error("timeout");
  if (!options.url.startsWith("/")) throw new Error("external tileset blocked");
  const C = await loadCesiumScript(options.signal);
  if (options.signal.aborted) throw new Error("timeout");
  C.Ion.defaultAccessToken = "";
  const viewer = new C.Viewer(container, {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, baseLayer: false, globe: false, requestRenderMode: true,
    creditContainer: document.createElement("div"),
  });
  viewer.scene.backgroundColor = C.Color.fromCssColorString("#F6F5F0");
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 3800;
  viewer.camera.setView({
    destination: C.Cartesian3.fromDegrees(campusFrame.lng, campusFrame.lat, 1100),
    orientation: { heading: C.Math.toRadians(-18), pitch: C.Math.toRadians(-48), roll: 0 },
  });
  const tilesPromise = C.Cesium3DTileset.fromUrl(options.url, { maximumScreenSpaceError: 16 });
  try {
    const tiles = await new Promise<Awaited<typeof tilesPromise>>((resolve, reject) => {
      const fail = () => reject(new Error("timeout"));
      if (options.signal.aborted) { destroyLateTileset(tilesPromise); fail(); return; }
      const onAbort = () => { destroyLateTileset(tilesPromise); fail(); };
      options.signal.addEventListener("abort", onAbort, { once: true });
      tilesPromise.then(value => {
        options.signal.removeEventListener("abort", onAbort);
        if (options.signal.aborted) { value.destroy(); fail(); return; }
        resolve(value);
      }, error => {
        options.signal.removeEventListener("abort", onAbort);
        reject(error);
      });
    });
    viewer.scene.primitives.add(tiles);
    await new Promise<void>((resolve, reject) => {
      const remove = tiles.tileLoad.addEventListener(() => { remove(); resolve(); });
      options.signal.addEventListener("abort", () => { remove(); reject(new Error("timeout")); }, { once: true });
    });
    return cesiumHandle(C, viewer, () => { if (!tiles.isDestroyed()) tiles.destroy(); });
  } catch (error) {
    destroyLateTileset(tilesPromise);
    if (!viewer.isDestroyed()) viewer.destroy();
    throw error;
  }
}
