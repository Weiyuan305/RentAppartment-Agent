"use client";
import { useLocale } from "@/components/locale-provider";
import { useEffect, useRef, useState } from "react";

export function Signpost({ minutes, place }: { minutes: number | null; place: string }) {
  const { locale } = useLocale();
  const previous = useRef(minutes);
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (previous.current === minutes) return;
    previous.current = minutes;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setFlip(true);
    const timer = window.setTimeout(() => setFlip(false), 180);
    return () => window.clearTimeout(timer);
  }, [minutes]);
  const placeIsCjk = /[\u4e00-\u9fff]/.test(place);
  return <span className="v2-sign" data-signpost>
    <span className={`v2-sign-latin${flip ? " is-flip" : ""}`}>{minutes ?? "—"}</span>
    {locale === "en" ? <><span className="v2-sign-latin">min</span><span className="v2-sign-latin">walk</span></> : <><span className="v2-sign-cjk">分钟</span><span className="v2-sign-cjk">步行</span></>}
    <span className="v2-sign-cjk" aria-hidden="true">·</span>
    <span className={placeIsCjk ? "v2-sign-cjk" : "v2-sign-latin"}>{place}</span>
  </span>;
}
