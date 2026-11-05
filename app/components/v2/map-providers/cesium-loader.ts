import type * as Cesium from "cesium";

type Engine = typeof Cesium;
declare global {
  interface Window { Cesium?: Engine; CESIUM_BASE_URL?: string }
}

let enginePromise: Promise<Engine> | null = null;

/** Cesium is loaded only when the Google provider actually starts. */
export function loadCesium() {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (!enginePromise) enginePromise = new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = "/cesium/";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "/cesium/Cesium.js";
    script.async = true;
    script.onload = () => window.Cesium ? resolve(window.Cesium) : reject(new Error("cesium-missing"));
    script.onerror = () => { enginePromise = null; script.remove(); reject(new Error("cesium-script")); };
    document.head.appendChild(script);
  });
  return enginePromise;
}
