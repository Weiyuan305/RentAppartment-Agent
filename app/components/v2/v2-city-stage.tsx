"use client";
import { cityPhoto, type Listing } from "@/lib/rental-data";
import { probePhotorealisticHosts } from "@/lib/v2/google-reachability";
import { approximateMegabytes, connectionFromNavigator, decide3DLoad, overviewStillVisible, writeStoredProvider, MAP_PROVIDER_IDS, type LoadDecision, type MapProviderId, type V2MapPerf } from "@/lib/v2/map-provider";
import { signpostMinutes, signpostPlace } from "@/lib/v2/signpost";
import { useEffect, useRef, useState } from "react";
import { startMapProvider, type MapSession } from "./map-providers";
import { projectStill } from "./map-providers/aerial";
import { Signpost } from "./signpost";

export type StageFocus = { token: number; lng: number; lat: number; altitude: "overview" | "campus" | "home" };

export function V2CityStage({ providerId, providerReady, probeGoogle, country, startToken, listings, selectedId, shownIds, hoveredId, buildingId, locale, focus, route, onSelect, onHover, onProvider }: {
  providerId: MapProviderId;
  providerReady: boolean;
  probeGoogle: boolean;
  country: string | null;
  startToken: number;
  listings: Listing[];
  selectedId: string;
  shownIds: Set<string>;
  hoveredId: string | null;
  buildingId: string | null;
  locale: "zh" | "en";
  focus: StageFocus;
  route: [number, number][] | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onProvider: (id: MapProviderId) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const pins = useRef(new Map<string, HTMLButtonElement>());
  const session = useRef<MapSession | null>(null);
  const [phase, setPhase] = useState<"photo" | "loading" | "ready">("photo");
  const [decision, setDecision] = useState<LoadDecision | null>(null);
  const [progress, setProgress] = useState("");
  const [active, setActive] = useState<MapProviderId | null>(null);
  const [tap, setTap] = useState(0);
  const place = signpostPlace(buildingId, locale);
  const selected = listings.find((listing) => listing.id === selectedId);
  const reveal = phase === "ready" && !(active === "aerial" && focus.altitude !== "home");

  useEffect(() => {
    const started = performance.now();
    let cancelled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewport = window.matchMedia("(max-width: 899px)").matches ? "mobile" as const : "desktop" as const;
    const publish = (partial: Partial<V2MapPerf>) => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      window.__v2MapPerf = {
        overviewMs: Math.round(started),
        readyMs: null,
        provider: "photo",
        reason: "overview",
        googleRequests: 0,
        bytes: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
        requests: resources.length,
        ...window.__v2MapPerf,
        ...partial,
      };
    };
    publish({ overviewMs: Math.round(started), reason: "overview" });
    const boot = async () => {
      if (!providerReady) return;
      const userRequested = tap > 0 || startToken > 0;
      if (!userRequested) await whenInteractive();
      if (cancelled || !canvas.current || !credits.current) return;
      const nav = navigator as Navigator & { connection?: { saveData?: boolean; type?: string } };
      const next = decide3DLoad({
        provider: providerId,
        viewport,
        interactive: true,
        connection: connectionFromNavigator(nav),
        userRequested,
      });
      setDecision(next);
      if (!next.start) return;
      let requested = providerId;
      if (probeGoogle && requested === "google-photorealistic") {
        setProgress(locale === "zh" ? "正在确认实景瓦片是否可达 · 3 秒" : "Checking whether photorealistic tiles answer · 3s");
        const reachable = await probePhotorealisticHosts();
        if (cancelled || !canvas.current || !credits.current) return;
        if (!reachable) {
          requested = "osm-buildings";
          writeStoredProvider(window.localStorage, requested);
          setProgress(locale === "zh" ? "实景瓦片没有在 3 秒内响应，改用自建建筑体块" : "Photorealistic tiles did not answer in 3s. Using the self-hosted model.");
        }
      }
      setPhase("loading");
      setProgress(locale === "zh" ? `正在准备三维 · ${sizeCopy(requested, viewport, locale)}` : `Preparing the city · ${sizeCopy(requested, viewport, locale)}`);
      try {
        const created = await startMapProvider(requested, {
          canvas: canvas.current,
          credits: credits.current,
          viewport,
          reducedMotion: reduced,
          onProgress: (item) => { if (!cancelled) setProgress(item.label); },
        });
        if (cancelled) { created.destroy(); return; }
        session.current = created;
        setActive(created.id);
        setPhase("ready");
        setProgress(created.id === "osm-buildings"
          ? (locale === "zh" ? "建筑体块已就绪 · 不经过 Google" : "Building model ready · no Google tiles")
          : (locale === "zh" ? "三维已就绪" : "3D city ready"));
        created.flyTo(focus);
        created.setRoute(route);
        if (created.id !== requested) writeStoredProvider(window.localStorage, created.id);
        publish({
          readyMs: Math.round(performance.now()),
          provider: created.id,
          reason: created.id === providerId ? next.reason : "google-fallback",
          googleRequests: created.id === "google-photorealistic" ? 4 : 0,
        });
      } catch {
        if (!cancelled) { setPhase("photo"); setProgress(locale === "zh" ? "三维没有就绪，城市全景仍可使用" : "The 3D city is not ready. The overview stays usable."); }
      }
    };
    void boot();
    return () => { cancelled = true; session.current?.destroy(); session.current = null; };
    // focus and route are applied by the effects below; restarting the engine for them would reload tiles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, providerReady, probeGoogle, startToken, tap, locale]);

  useEffect(() => { session.current?.flyTo(focus); }, [focus]);
  useEffect(() => {
    const listing = listings.find((item) => item.id === selectedId);
    if (!listing || phase !== "ready" || !session.current) return;
    session.current.highlightBuilding(session.current.nearestBuildingId(listing.lng, listing.lat));
  }, [selectedId, phase, listings]);
  useEffect(() => { if (phase === "ready") session.current?.setRoute(route); }, [route, phase]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      for (const listing of listings) {
        const node = pins.current.get(listing.id);
        if (!node) continue;
        const point = session.current?.project(listing.lng, listing.lat) ?? projectStill(listing.lng, listing.lat, box.width, box.height);
        node.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [listings, phase]);

  const waiting = decision && !decision.start;
  const viewport = typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches ? "mobile" : "desktop";
  return <div ref={root} className={`v2-map${reveal ? " is-ready" : ""}`} data-engine={active ?? "photo"} data-engine-ready={reveal ? "true" : "false"} data-overview-visible={overviewStillVisible(reveal ? "ready" : phase) ? "true" : "false"}>
    <img className="v2-overview" src={cityPhoto("manchester")} alt={locale === "zh" ? "曼彻斯特城市全景" : "Manchester overview"} />
    <div ref={canvas} className="v2-map-canvas" />
    {active === "aerial" && reveal && selected ? <img className="v2-aerial-still" src={selected.photos[0]} alt="" /> : null}
    <div className="v2-pins">
      {listings.map((listing) => <button
        key={listing.id}
        ref={(node) => { if (node) pins.current.set(listing.id, node); else pins.current.delete(listing.id); }}
        className={`v2-pin${listing.id === selectedId ? " is-on" : ""}${listing.id === hoveredId ? " is-hot" : ""}${shownIds.has(listing.id) ? "" : " is-dim"}`}
        onClick={() => onSelect(listing.id)}
        onMouseEnter={() => onHover(listing.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(listing.id)}
        onBlur={() => onHover(null)}
      >
        <Signpost minutes={signpostMinutes(listing, buildingId)} place={place} />
      </button>)}
    </div>
    <div className="v2-map-progress" role="status">
      <strong>{locale === "zh" ? "城市全景" : "City overview"}</strong>
      <span>{progress || (waiting ? sizeCopy(providerId, viewport, locale) : locale === "zh" ? "房源可以先看，三维在全景后面准备" : "Homes stay usable while the city prepares")}</span>
      {phase === "loading" ? <span className="v2-progress-bar" /> : null}
      {waiting ? <button type="button" onClick={() => setTap((value) => value + 1)}>{locale === "zh" ? `显示三维 · ${sizeCopy(providerId, viewport, locale)}` : `Show the 3D city · ${sizeCopy(providerId, viewport, locale)}`}</button> : null}
      {active && active !== providerId ? <span>{locale === "zh" ? "实景瓦片不可用，已改用建筑体块" : "Photorealistic tiles failed. Showing building massing."}</span> : null}
      {country === "CN" ? <span className="v2-country-note">{locale === "zh" ? "当前地区默认使用自建模型，不请求 Google" : "This region starts on the self-hosted model and does not call Google"}</span> : null}
      <div className="v2-provider-switch" role="group" aria-label={locale === "zh" ? "地图来源" : "Map source"}>
        {MAP_PROVIDER_IDS.map((id) => <button type="button" key={id} aria-pressed={(active ?? providerId) === id} onClick={() => onProvider(id)}>{providerLabel(id, locale)}</button>)}
      </div>
    </div>
    <div ref={credits} className="v2-credits" />
  </div>;
}

function providerLabel(id: MapProviderId, locale: "zh" | "en") {
  if (id === "google-photorealistic") return locale === "zh" ? "实景" : "Photorealistic";
  if (id === "aerial") return locale === "zh" ? "照片" : "Photos";
  return locale === "zh" ? "建筑体块" : "Buildings";
}

function sizeCopy(provider: MapProviderId, viewport: "desktop" | "mobile", locale: "zh" | "en") {
  const mb = approximateMegabytes(provider, viewport);
  if (provider === "google-photorealistic") return locale === "zh" ? `约 ${mb}MB` : `about ${mb}MB`;
  if (provider === "osm-buildings") return locale === "zh" ? "约 0.3MB，不经过 Google" : "about 0.3MB, no Google tiles";
  return locale === "zh" ? "不请求实景瓦片" : "no photorealistic tiles";
}

function whenInteractive() {
  if (document.readyState === "complete") return idle();
  return new Promise<void>((resolve) => {
    window.addEventListener("load", () => { void idle().then(resolve); }, { once: true });
  });
}

function idle() {
  return new Promise<void>((resolve) => {
    const idleWindow = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(() => resolve(), { timeout: 1200 });
    else globalThis.setTimeout(resolve, 250);
  });
}
