"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Footprints, TrainFront, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
export default function JourneyDisclosure({ title, status, seconds, meters, transit = false, onClear, children }: {
  title: string; status: string; seconds?: number; meters?: number; transit?: boolean; onClear: () => void; children: ReactNode;
}) {
  const { locale } = useLocale(), w = (zh: string, en: string) => locale === "zh" ? zh : en;
  const [expanded, setExpanded] = useState(true), id = useId();
  const detail = seconds ? `${Math.ceil(seconds / 60)} ${w("分钟", "min")}${meters ? ` · ${meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`}` : ""}`
    : status === "loading" ? w("正在查询路线…", "Finding route…") : status === "external" ? w("官方交通规划", "Official journey planner") : status === "error" ? w("路线暂不可用 · 展开重试", "Route unavailable · Expand to retry") : w("路线详情", "Journey details");
  const Icon = transit ? TrainFront : Footprints;
  return <section className={`map-journey-shell ${expanded ? "is-expanded" : "is-folded"}`} aria-label={w("路线摘要", "Journey summary")}>
    <div className="journey-summary"><button className="journey-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}><Icon size={18}/><span><strong>{title}</strong><small>{detail}</small></span><ChevronDown size={16}/><span className="sr-only">{expanded ? w("收起详情，保留地图路线", "Collapse details, keep route") : w("展开路线详情", "Expand journey details")}</span></button><button className="journey-clear" onClick={onClear} aria-label={w("清除路线", "Clear route")} title={w("清除路线", "Clear route")}><X size={17}/></button></div>
    <div id={id} className="journey-body" hidden={!expanded}>{children}</div>
  </section>;
}
