"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { getCity, type CityId } from "@/lib/rental-data";
import { useLocale } from "../locale-provider";
import "leaflet/dist/leaflet.css";

export function EntranceMap({
  cityId,
  lat,
  lng,
  chosen,
  disabled,
  onChoose,
}: {
  cityId: CityId;
  lat: number;
  lng: number;
  chosen: boolean;
  disabled: boolean;
  onChoose: (lat: number, lng: number) => void;
}) {
  const { locale } = useLocale(),
    en = locale === "en";
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    marker = useRef<Marker | null>(null);
  const latest = useRef({ lat, lng, chosen, disabled, onChoose });
  useEffect(() => {
    latest.current = { lat, lng, chosen, disabled, onChoose };
  });
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading"),
    [tilesFailed, setTilesFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false,
      cleanup = () => {};
    import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        const c = getCity(cityId),
          p = latest.current;
        const m = L.map(container.current, {
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true,
          minZoom: 10,
          maxZoom: 19,
          maxBounds: [
            [c.lat - 0.55, c.lng - 0.8],
            [c.lat + 0.55, c.lng + 0.8],
          ],
          maxBoundsViscosity: 1,
        });
        map.current = m;
        m.setView([p.lat, p.lng], p.chosen ? 17 : 12);
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
          },
        ).addTo(m);
        tiles.on("tileerror", () => {
          if (!cancelled) setTilesFailed(true);
        });
        m.attributionControl.setPrefix(false);
        const pin = L.marker([p.lat, p.lng], {
          draggable: !p.disabled,
          keyboard: true,
          title: en
            ? "Property entrance — drag to adjust"
            : "公寓入口，可拖动调整",
          icon: L.divIcon({
            className: "mw-entrance-pin",
            html: '<svg viewBox="0 0 32 40" width="32" height="40" aria-hidden="true"><path d="M16 38S2 23 2 15a14 14 0 0 1 28 0c0 8-14 23-14 23Z" fill="#245d48" stroke="#fffef4" stroke-width="2.5"/><circle cx="16" cy="15" r="5" fill="#d6edaa"/></svg>',
            iconSize: [32, 40],
            iconAnchor: [16, 39],
          }),
        });
        marker.current = pin;
        if (p.chosen) pin.addTo(m);
        const choose = (lat: number, lng: number) => {
          if (!latest.current.disabled) latest.current.onChoose(lat, lng);
        };
        m.on("click", (e) => choose(e.latlng.lat, e.latlng.lng));
        pin.on("dragend", () => {
          const p = pin.getLatLng();
          choose(p.lat, p.lng);
        });
        const observer = new ResizeObserver(() =>
          m.invalidateSize({ pan: false }),
        );
        observer.observe(container.current);
        cleanup = () => {
          observer.disconnect();
          m.remove();
          map.current = null;
          marker.current = null;
        };
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
      cleanup();
    };
    // Locale changes update the accessible container; map initialization is independent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, retry]);
  useEffect(() => {
    const m = map.current,
      pin = marker.current;
    if (!m || !pin) return;
    pin.setLatLng([lat, lng]);
    if (chosen) {
      if (!m.hasLayer(pin)) pin.addTo(m);
      if (!m.getBounds().pad(-0.15).contains([lat, lng]))
        m.setView([lat, lng], 17, { animate: false });
      else if (m.getZoom() < 15) m.setView([lat, lng], 17, { animate: false });
    } else if (m.hasLayer(pin)) m.removeLayer(pin);
    if (disabled) pin.dragging?.disable();
    else pin.dragging?.enable();
  }, [lat, lng, chosen, disabled, state]);
  useEffect(() => {
    const m = map.current,
      pin = marker.current;
    if (!m || !pin) return;
    const title = en
      ? "Property entrance — drag to adjust"
      : "公寓入口，可拖动调整";
    pin.options.title = title;
    pin.getElement()?.setAttribute("title", title);
    m.zoomControl.options.zoomInTitle = en ? "Zoom in" : "放大";
    m.zoomControl.options.zoomOutTitle = en ? "Zoom out" : "缩小";
    m.zoomControl.remove().addTo(m);
  }, [en, state]);
  return (
    <div className="mw-location-map-wrap">
      <div
        ref={container}
        className="mw-location-map"
        role="region"
        aria-label={
          en
            ? "Choose the property entrance on the map"
            : "在地图上选择公寓入口"
        }
      />
      {state === "loading" && (
        <p role="status">{en ? "Loading map…" : "正在加载地图…"}</p>
      )}
      {(state === "failed" || tilesFailed) && (
        <div role="status" className="mw-note">
          {en
            ? "Map could not load. Please retry before confirming the entrance."
            : "地图未能加载，请重试后再确认入口。"}{" "}
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setTilesFailed(false);
              setRetry((v) => v + 1);
            }}
          >
            {en ? "Retry map" : "重试地图"}
          </button>
        </div>
      )}
      <div className="mw-map-instructions">
        <p>
          {en
            ? "Click the entrance or drag the pin. You can also move the map with arrow keys, then use its centre."
            : "点击公寓入口或拖动标记微调；也可用方向键移动地图，再选取中心位置。"}
        </p>
        <button
          type="button"
          disabled={disabled || state !== "ready" || tilesFailed}
          onClick={() => {
            const p = map.current?.getCenter();
            if (p) onChoose(p.lat, p.lng);
          }}
        >
          {en ? "Use map centre" : "选取地图中心"}
        </button>
      </div>
    </div>
  );
}
