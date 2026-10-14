"use client";
import { useId, type ReactNode } from "react";
import { ChevronDown, Footprints, TrainFront, MapPin, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
export default function JourneyDisclosure({ title, status, seconds, meters, transit = false, place=false, onClear, children, expanded, onExpandedChange }: {
  expanded: boolean; onExpandedChange: (expanded: boolean) => void; place?: boolean;
  title: string; status: string; seconds?: number; meters?: number; transit?: boolean; onClear: () => void; children: ReactNode;
}) {
  const { locale } = useLocale(), w = (zh: string, en: string) => locale === "zh" ? zh : en;
  const id = useId();
  const detail = place ? w("查看地点与步行路线", "Place details & walking route") : seconds ? `${Math.ceil(seconds / 60)} ${w("分钟", "min")}${meters ? ` · ${meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`}` : ""}`
    : status === "loading" ? w("正在查询路线…", "Finding route…") : status === "external" ? w("官方交通规划", "Official journey planner") : status === "error" ? w("路线暂不可用 · 展开重试", "Route unavailable · Expand to retry") : w("路线详情", "Journey details");
  const Icon = place ? MapPin : transit ? TrainFront : Footprints;
  return <section className={`map-journey-shell ${expanded ? "is-expanded" : "is-folded"}`} aria-label={place?w("地点摘要","Place summary"):w("路线摘要", "Journey summary")}>
    <div className="journey-summary"><button className="journey-toggle" aria-expanded={expanded} aria-controls={id} onClick={() => onExpandedChange(!expanded)}><Icon size={18}/><span><strong>{title}</strong><small>{detail}</small></span><ChevronDown size={16}/><span className="sr-only">{expanded ? w("收起详情，保留地图结果", "Collapse details, keep map results") : w("展开详情", "Expand details")}</span></button><button className="journey-clear" onClick={onClear} aria-label={place?w("关闭地点信息","Close place details"):w("清除路线", "Clear route")}><X size={17}/></button></div>
    <div id={id} className="journey-body" hidden={!expanded}>{children}</div>
  </section>;
}
