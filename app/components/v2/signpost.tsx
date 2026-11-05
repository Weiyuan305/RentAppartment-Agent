"use client";
import { useLocale } from "@/components/locale-provider";
import { useEffect, useRef, useState } from "react";

export function Signpost({ minutes, place, display = false }: { minutes: number | null; place: string; display?: boolean }) {
  const { locale } = useLocale();
  const previous = useRef(minutes);
  const [motion, setMotion] = useState<"flip" | "fade" | null>(null);
  useEffect(() => {
    if (previous.current === minutes) return;
    previous.current = minutes;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMotion(reduced ? "fade" : "flip");
    const timer = window.setTimeout(() => setMotion(null), reduced ? 120 : 180);
    return () => window.clearTimeout(timer);
  }, [minutes]);
  const placeIsCjk = /[\u4e00-\u9fff]/.test(place);
  return <span className={`v2-sign${display ? " is-display" : ""}`} data-signpost>
    <span className={`v2-sign-num${motion ? ` is-${motion}` : ""}`}>{minutes ?? "—"}</span>
    {locale === "en" ? <><span className="v2-sign-latin">min</span><span className="v2-sign-latin">walk</span></> : <><span className="v2-sign-cjk">分钟</span><span className="v2-sign-cjk">步行</span></>}
    <span className="v2-sign-cjk" aria-hidden="true">·</span>
    <span className={placeIsCjk ? "v2-sign-cjk" : "v2-sign-latin"}>{place}</span>
  </span>;
}
