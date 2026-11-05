import { cpSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('../public/cesium', import.meta.url), { recursive: true });
cpSync(new URL('../node_modules/cesium/Build/Cesium/', import.meta.url), new URL('../public/cesium/', import.meta.url), { recursive: true });
// MapLibre looks for its worker beside the prebundled module. Serve the real file from our domain instead.
mkdirSync(new URL('../public/guided', import.meta.url), { recursive: true });
cpSync(new URL('../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url), new URL('../public/guided/maplibre-gl-worker.mjs', import.meta.url));
