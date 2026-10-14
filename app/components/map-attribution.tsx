"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Info, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

/** Cesium owns the native host; the disclosure mirrors its sanitized, active credits. */
export default function MapAttribution({ nativeRef, visible }: {
  nativeRef: RefObject<HTMLDivElement | null>;
  visible: boolean;
}) {
  const { locale } = useLocale();
  const english = locale === "en";
  const label = english ? "Data sources" : "数据来源";
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const sources = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const host = nativeRef.current;
    const destination = sources.current;
    if (!host || !destination) return;
    const syncCredits = () => {
      // Credit.element is sanitized by Cesium. Clone rather than move its nodes:
      // CreditDisplay reconciles the native children as visible tiles change.
      const credits = Array.from(host.querySelectorAll(".cesium-credit-wrapper"), credit => {
        const copy = credit.cloneNode(true) as HTMLElement;
        copy.querySelectorAll("a").forEach(link => { link.rel = "noopener noreferrer"; });
        return copy;
      });
      destination.replaceChildren(...credits);
    };
    syncCredits();
    const observer = new MutationObserver(syncCredits);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [nativeRef]);

  useEffect(() => {
    const element = root.current;
    const map = element?.closest<HTMLElement>(".city-panel");
    if (!element || !map || !visible) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      map.style.setProperty("--map-credit-height", `${Math.ceil(bounds.height + map.getBoundingClientRect().bottom - bounds.bottom)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => { observer.disconnect(); map.style.removeProperty("--map-credit-height"); };
  }, [visible]);

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target) && disclosure.current) {
        disclosure.current.open = false;
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && disclosure.current) {
        event.preventDefault();
        event.stopPropagation();
        disclosure.current.open = false;
        summary.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [expanded]);

  return <div ref={root} className="map-attribution" hidden={!visible}>
    <div ref={nativeRef} className="map-credit-host"/>
    <details ref={disclosure} className="map-credit-disclosure" onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary ref={summary} aria-expanded={expanded} aria-controls={panelId}><Info size={13} aria-hidden="true"/>{label}</summary>
      <section id={panelId} className="map-credit-panel" aria-label={label}>
        <header><strong>{label}</strong><button type="button" aria-label={english ? "Close data sources" : "关闭数据来源"} onClick={() => {
          if (disclosure.current) disclosure.current.open = false;
          summary.current?.focus();
        }}><X size={16}/></button></header>
        <div className="map-credit-scroll">
          <p>{english ? "Map imagery and 3D data" : "地图影像与三维数据"}</p>
          <div ref={sources} className="map-credit-sources"/>
          <p>{english ? "Campus, nearby places and walking network" : "校园、周边设施与步行路网"}</p>
          <div className="map-credit-network">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href="https://valhalla.github.io/valhalla/" target="_blank" rel="noopener noreferrer">Valhalla</a></div>
        </div>
      </section>
    </details>
  </div>;
}
