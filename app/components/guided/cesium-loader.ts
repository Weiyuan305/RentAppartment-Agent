import type * as Cesium from "cesium";

type Engine = typeof Cesium;
declare global {
  interface Window { Cesium?: Engine; CESIUM_BASE_URL?: string }
}

let enginePromise: Promise<Engine> | null = null;

/** Loads the same-origin Cesium build. Callers that use ion set the token themselves, after this returns. */
export function loadCesiumScript(signal: AbortSignal): Promise<Engine> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (signal.aborted) return Promise.reject(new Error("timeout"));
  if (!enginePromise) enginePromise = new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = "/cesium/";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "/cesium/Cesium.js";
    script.async = true;
    const fail = () => { enginePromise = null; script.remove(); reject(new Error("cesium-script")); };
    script.onload = () => window.Cesium ? resolve(window.Cesium) : fail();
    script.onerror = fail;
    document.head.appendChild(script);
  });
  if (signal.aborted) return Promise.reject(new Error("timeout"));
  return enginePromise;
}

export function destroyLateTileset(promise: Promise<{ destroy?: () => void }>) {
  void promise.then(tiles => {
    try { tiles.destroy?.(); } catch { /* The viewer may already own it. */ }
  }).catch(() => {});
}
