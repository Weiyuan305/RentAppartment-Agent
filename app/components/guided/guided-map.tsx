"use client";

import { useEffect, useRef, useState } from "react";
import { resolveMapConfig } from "@/lib/map-config";
import { buildingById } from "@/lib/student/catalog";
import {
  campusFrame, configuredMapProvider, firstTileTimeoutMs, localBuildingDataset,
  photorealisticConfigured, readProviderPreference, readRememberedProvider, rememberGuidedProvider,
  resolveFallbackDataset, resolveGuidedProvider, type FallbackDataset, type GuidedMapProvider,
} from "@/lib/guided/map-provider";
import type { ShortHome } from "@/lib/guided/decide";
import type { PlacePoint } from "@/lib/guided/decide";
import { mountOsmScene } from "./osm-scene";
import type { SceneHandle } from "./scene-types";

type GuidedEnv = {
  VITE_GUIDED_MAP_PROVIDER?: string;
  VITE_GUIDED_FALLBACK?: string;
  VITE_GUIDED_CAMPUS_VIDEO?: string;
  VITE_MAP_PROVIDER?: string;
  VITE_CESIUM_ION_ACCESS_TOKEN?: string;
  VITE_GOOGLE_MAPS_API_KEY?: string;
};

function env(): GuidedEnv {
  return import.meta.env as unknown as GuidedEnv;
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch { return false; }
}

function nearest(origin: { lng: number; lat: number }, places: PlacePoint[], category: string) {
  let best: { place: PlacePoint; score: number } | null = null;
  for (const place of places) {
    if (place.category !== category) continue;
    const score = Math.hypot(place.lng - origin.lng, place.lat - origin.lat);
    if (!best || score < best.score) best = { place, score };
  }
  return best?.place ?? null;
}

export default function GuidedMap({
  country, asking, load3d, homes, selectedId, buildingId, route, places, onSelect,
}: {
  country: string | null;
  asking: boolean;
  load3d: boolean;
  homes: ShortHome[];
  selectedId: string | null;
  buildingId: string | null;
  route: Array<[number, number]> | null;
  places: PlacePoint[];
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const introRef = useRef(false);
  const homesRef = useRef(homes);
  const placesRef = useRef(places);
  const buildingRef = useRef(buildingId);
  homesRef.current = homes;
  placesRef.current = places;
  buildingRef.current = buildingId;
  const [provider, setProvider] = useState<GuidedMapProvider | null>(null);
  const [visual, setVisual] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [shell, setShell] = useState<{ mobile: boolean; webgl: boolean } | null>(null);
  const video = env().VITE_GUIDED_CAMPUS_VIDEO?.trim() || "";
  const dataset: FallbackDataset = tilesFailed
    ? { kind: "osm-extrusion", url: localBuildingDataset }
    : resolveFallbackDataset(env().VITE_GUIDED_FALLBACK);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 899px)");
    const read = () => setShell({ mobile: mobileQuery.matches, webgl: hasWebGL() });
    read();
    mobileQuery.addEventListener("change", read);
    return () => mobileQuery.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    if (!load3d || !shell) return;
    let dead = false;
    const settings = env();
    const preference = readProviderPreference(settings.VITE_GUIDED_MAP_PROVIDER);
    const remembered = readRememberedProvider(window.localStorage);
    void resolveGuidedProvider({
      preference,
      webgl: shell.webgl,
      photorealisticConfigured: photorealisticConfigured(settings),
      country,
      remembered,
    }).then(choice => {
      if (dead) return;
      if (choice.reason === "google-unreachable") rememberGuidedProvider(window.localStorage, "osm-buildings");
      setProvider(choice.provider);
    });
    return () => { dead = true; };
  }, [load3d, shell, country]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !provider || provider === "prerendered-video") return;
    let dead = false;
    let handle: SceneHandle | null = null;
    const settings = env();
    const adopt = (next: SceneHandle) => {
      if (dead) { next.destroy(); return; }
      handle = next;
      sceneRef.current = next;
      const mobile = window.matchMedia("(max-width: 899px)").matches;
      next.setPadding(mobile ? { top: 48, right: 16, bottom: 230, left: 16 } : { top: 24, right: 404, bottom: 24, left: 384 });
      next.resize();
    };
    if (provider === "google-photorealistic") {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), firstTileTimeoutMs);
      void import("./google-scene").then(mod => {
        if (dead || controller.signal.aborted) throw new Error("timeout");
        const config = resolveMapConfig(settings);
        return mod.mountGoogleScene(host, { credential: config.credential, mode: configuredMapProvider(settings), signal: controller.signal });
      }).then(next => {
        window.clearTimeout(timer);
        adopt(next);
        if (!dead) {
          rememberGuidedProvider(window.localStorage, "google-photorealistic");
          setVisual(true);
        }
      }).catch(() => {
        window.clearTimeout(timer);
        if (dead) return;
        rememberGuidedProvider(window.localStorage, "osm-buildings");
        setProvider("osm-buildings");
      });
      return () => { dead = true; window.clearTimeout(timer); handle?.destroy(); if (sceneRef.current === handle) sceneRef.current = null; setVisual(false); };
    }
    if (dataset.kind === "3d-tiles") {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), firstTileTimeoutMs);
      void import("./tiles-scene").then(mod => {
        if (dead) throw new Error("cancelled");
        return mod.mountTilesScene(host, { url: dataset.url, signal: controller.signal });
      }).then(next => {
        window.clearTimeout(timer);
        adopt(next);
        if (!dead) setVisual(true);
      }).catch(() => {
        window.clearTimeout(timer);
        if (!dead) setTilesFailed(true);
      });
      return () => { dead = true; window.clearTimeout(timer); handle?.destroy(); if (sceneRef.current === handle) sceneRef.current = null; setVisual(false); };
    }
    try {
      handle = mountOsmScene(host, {
        url: dataset.url,
        onReady: () => { if (!dead) setVisual(true); },
        onFailed: () => { if (!dead) setVisual(false); },
      });
      sceneRef.current = handle;
      const mobile = window.matchMedia("(max-width: 899px)").matches;
      handle.setPadding(mobile ? { top: 48, right: 16, bottom: 230, left: 16 } : { top: 24, right: 404, bottom: 24, left: 384 });
      handle.resize();
    } catch { setVisual(false); }
    return () => { dead = true; handle?.destroy(); if (sceneRef.current === handle) sceneRef.current = null; setVisual(false); };
  }, [provider, dataset.kind, dataset.url]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let frame = 0;
    let last = "";
    const publish = () => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const home of homesRef.current) {
        const point = scene.project({ lng: home.listing.lng, lat: home.listing.lat });
        if (point) next[home.listing.id] = point;
      }
      const building = buildingById(buildingRef.current);
      if (building) {
        const point = scene.project({ lng: building.lng, lat: building.lat });
        if (point) next.building = point;
      }
      const origin = homesRef.current.find(home => home.listing.id === selectedId)?.listing ?? { lng: campusFrame.lng, lat: campusFrame.lat };
      const rail = nearest(origin, placesRef.current, "rail");
      const shop = nearest(origin, placesRef.current, "supermarket") ?? nearest(origin, placesRef.current, "asian_grocery");
      if (rail) {
        const point = scene.project(rail);
        if (point) next.rail = point;
      }
      if (shop) {
        const point = scene.project(shop);
        if (point) next.shop = point;
      }
      const key = Object.entries(next).map(([id, point]) => `${id}:${Math.round(point.x)}:${Math.round(point.y)}`).join("|");
      if (key !== last) { last = key; setPositions(next); }
    };
    const stop = scene.onMove(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(publish);
    });
    publish();
    return () => { stop(); cancelAnimationFrame(frame); };
  }, [visual, selectedId, homes, places, buildingId]);

  useEffect(() => {
    const scene = sceneRef.current;
    const home = homesRef.current.find(item => item.listing.id === selectedId);
    if (!scene || !visual || asking || !home) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const intro = !introRef.current;
    introRef.current = true;
    scene.flyTo({ lng: home.listing.lng, lat: home.listing.lat }, reduced ? 0 : intro ? 800 : 750);
  }, [visual, asking, selectedId]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !visual) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scene.setRoute(route ?? [], reduced ? 0 : 700);
  }, [route, visual]);

  const building = buildingById(buildingId);
  const selected = homes.find(home => home.listing.id === selectedId)?.listing;
  const origin = selected ?? { lng: campusFrame.lng, lat: campusFrame.lat };
  const rail = nearest(origin, places, "rail");
  const shop = nearest(origin, places, "supermarket") ?? nearest(origin, places, "asian_grocery");
  const photoGone = provider === "prerendered-video" ? Boolean(video) : visual;
  const inView = (point: { x: number; y: number }) => {
    if (typeof window === "undefined") return false;
    const mobile = shell?.mobile ?? false;
    const left = mobile ? 12 : 372;
    const right = window.innerWidth - (mobile ? 12 : 392);
    const bottom = window.innerHeight - (mobile ? 210 : 64);
    return point.x >= left && point.x <= right && point.y >= 48 && point.y <= bottom;
  };
  const note = provider === "google-photorealistic"
    ? "Google 实景三维（Cesium ion 资产 2275207）。8 秒内没有第一张瓦片，就改用本校托管的建筑。"
    : provider === "osm-buildings"
      ? dataset.kind === "3d-tiles"
        ? "三维模型来自本校托管的文件，不经过 Cesium ion。"
        : "校园建筑是本校托管的 OpenStreetMap 轮廓。没有实测高度的楼按 12 米示意，不是测绘。换模型只改一项配置。© OpenStreetMap / ODbL"
      : provider === "prerendered-video"
        ? "先用曼彻斯特的照片。没有配置校园视频时，不会假装已经飞过城市。"
        : "画面先停在曼彻斯特的照片上，校园建筑准备好后再换过去。";

  return (
    <div className="gd-stage" data-provider={provider ?? "pending"} data-country={country ?? ""}>
      <img className={photoGone ? "gd-photo is-gone" : "gd-photo"} src="/photos/manchester.jpg" alt="曼彻斯特牛津路一带的城市概览" />
      <div ref={hostRef} className={visual ? "gd-scene is-live" : "gd-scene"} aria-label="曼彻斯特大学牛津路三维校园" />
      {provider === "prerendered-video" && video ? <video className="gd-scene is-live" src={video} autoPlay muted playsInline loop /> : null}
      {visual && homes.map(home => {
        const point = positions[home.listing.id];
        if (!point || !inView(point)) return null;
        const selectedHome = home.listing.id === selectedId;
        return (
          <button key={home.listing.id} type="button" className={selectedHome ? "gd-sign is-selected" : "gd-sign"} style={{ left: point.x, top: point.y }} onClick={() => onSelect(home.listing.id)}>
            <small>{home.listing.name}</small>
            {home.sign}
          </button>
        );
      })}
      {visual && building && positions.building && inView(positions.building) ? <div className="gd-landmark" style={{ left: positions.building.x, top: positions.building.y }}>{building.name}</div> : null}
      {visual && rail && positions.rail && inView(positions.rail) ? <div className="gd-landmark" style={{ left: positions.rail.x, top: positions.rail.y }}>{rail.name}</div> : null}
      {visual && shop && positions.shop && inView(positions.shop) ? <div className="gd-landmark" style={{ left: positions.shop.x, top: positions.shop.y }}>{shop.name}</div> : null}
      <p className="gd-map-note gd-12">{note}</p>
    </div>
  );
}
