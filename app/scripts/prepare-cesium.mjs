import { cpSync, mkdirSync } from 'node:fs';
mkdirSync(new URL('../public/cesium', import.meta.url), { recursive: true });
cpSync(new URL('../node_modules/cesium/Build/Cesium/', import.meta.url), new URL('../public/cesium/', import.meta.url), { recursive: true });
