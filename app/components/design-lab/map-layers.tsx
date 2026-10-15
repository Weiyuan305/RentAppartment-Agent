"use client";
import { useId, type ReactNode } from "react";
import { Layers3, GraduationCap, Footprints } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { StudentPlan } from "@/lib/student/state";
import { buildingById } from "@/lib/student/catalog";
export default function MapLayers({ plan, amenityCount, onStudentChange, onPlanner, onClearAmenities, children, open, onOpenChange }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  plan: StudentPlan; amenityCount: number; onStudentChange: (plan: StudentPlan) => void; onPlanner: () => void; onClearAmenities: () => void; children: ReactNode;
}) {
  const { locale } = useLocale(), w = (zh:string, en:string) => locale === "zh" ? zh : en;
  const id = useId(), count = amenityCount + Number(plan.showBuildings) + Number(Boolean(plan.catchmentMinutes));
  return <details open={open} className="concept-amenity-disclosure workspace-layers" onKeyDown={event => { if(event.key === "Escape") { onOpenChange(false); event.currentTarget.querySelector("summary")?.focus(); event.stopPropagation(); } }}>
    <summary aria-label={w("地图图层", "Map layers")} title={w("地图图层", "Map layers")} aria-controls={id} aria-expanded={open} onClick={event=>{event.preventDefault();onOpenChange(!open);}}><Layers3 size={16}/>{w("图层", "Layers")}{count > 0 && <span className="layer-count" aria-label={w(`${count} 个已启用图层`, `${count} active layers`)}>{count}</span>}</summary>
    <div className="workspace-layer-body" id={id}>
      <div className="layer-heading"><strong>{w("显示你关心的地点", "Make the map yours")}</strong><button onClick={() => {onClearAmenities();onStudentChange({...plan,showBuildings:false,catchmentMinutes:null});}}>{w("清空图层", "Clear layers")}</button></div>
      <section className="layer-group" aria-label={w("生活设施", "Everyday places")}><h3>{w("生活设施", "Everyday places")}</h3>{children}</section>
      <section className="layer-group"><h3><GraduationCap size={15}/>{w("校园建筑", "Campus buildings")}</h3><label className="layer-check"><input type="checkbox" checked={plan.showBuildings} onChange={e => onStudentChange({...plan,showBuildings:e.target.checked})}/>{w("显示校园楼栋", "Show campus buildings")}</label><select aria-label={w("校园楼栋类型", "Campus building type")} value={plan.buildingCategory} onChange={e => onStudentChange({...plan,showBuildings:true,buildingCategory:e.target.value as StudentPlan["buildingCategory"]})}>{[["all",w("全部楼栋", "All buildings")],["teaching",w("教学楼", "Teaching")],["library",w("图书馆", "Libraries")],["services",w("学生服务", "Student services")],["dining",w("校园餐饮", "Campus dining")]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button className="layer-destination" onClick={onPlanner}>{buildingById(plan.destinationId)?.name ?? w("选择通勤楼栋", "Choose a campus destination")} ↗</button></section>
      <section className="layer-group"><h3><Footprints size={15}/>{w("步行生活圈", "Walking catchment")}</h3><div className="layer-catchment">{([null,10,20,30] as const).map(minutes => <button key={minutes ?? "off"} disabled={minutes !== null && !plan.destinationId} aria-pressed={plan.catchmentMinutes === minutes} onClick={() => onStudentChange({...plan,catchmentMinutes:minutes})}>{minutes ? `${minutes} ${w("分钟", "min")}` : w("关闭", "Off")}</button>)}</div><p>{plan.destinationId ? w("以所选楼栋为中心 · 基于真实步行路网", "Around your campus destination · Walking network") : w("先选择通勤楼栋，再显示步行范围。", "Choose a campus destination to show its walking catchment.")}</p></section>
      <p className="layer-footnote">{w("缩小时自动减少重叠标记；所选地点始终保留。", "Overlapping markers thin out as you zoom out. Your selected place stays visible.")}</p>
    </div>
  </details>;
}
