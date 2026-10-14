"use client";
import { X, Undo2 } from "lucide-react";
import { useLocale } from "./locale-provider";
import type { FilterKey, FilterSnapshot } from "@/lib/rental-filter-actions";
import { displayCity } from "@/lib/i18n";
import type { City } from "@/lib/rental-data";

export function RentalFilterChips({value, city, destination, undo, onRemove, onUndo}: {
  value: FilterSnapshot; city: City; destination?: string; undo: boolean; onRemove: (key: FilterKey | "all") => void; onUndo: () => void;
}) {
  const {t, locale} = useLocale(), w = (zh: string, en: string) => locale === "zh" ? zh : en;
  const {filters: f, housing: h, onlySaved} = value;
  const cityView = displayCity(city, locale);
  const chips: {key: FilterKey; label: string; pending?: boolean}[] = [];
  if (f.roomType !== "all") chips.push({key: "roomType", label: t(f.roomType)});
  if (f.budget !== null) chips.push({key: "budget", label: `${t("预算 ≤")} ${city.currency}${f.budget} / ${cityView.period}`});
  if (f.bills) chips.push({key: "bills", label: t("含水电网")});
  if (f.walkMinutes) chips.push({key: "walkMinutes", label: `${destination ?? w("大学步行", "Campus walk")} ≤ ${f.walkMinutes} ${t("分钟 · 路网估计")}`});
  if (f.safety) chips.push({key: "safety", label: t("区域安全 · 待核验"), pending: true});
  if (f.shopping) chips.push({key: "shopping", label: t("购物便利 · 待核验"), pending: true});
  if (h.moveIn) chips.push({key: "moveIn", label: `${w("入住", "Move in")} ${h.moveIn}`});
  if (h.leaseMonths) chips.push({key: "leaseMonths", label: `${h.leaseMonths} ${w("个月租期", "month lease")}`});
  if (h.availableOnly) chips.push({key: "availableOnly", label: w("演示可租", "Demo available")});
  if (onlySaved) chips.push({key: "onlySaved", label: w("仅看收藏", "Saved only")});
  if (!chips.length && !undo) return null;
  function remove(key: FilterKey | "all") {
    onRemove(key);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".filter-undo")?.focus());
  }
  return <div className="active-filters rental-filter-chips" aria-label={w("已选找房条件", "Active rental filters")}>
    {chips.length > 0 && <span className="filter-caption">{t("你的偏好")}</span>}
    {chips.map(chip => <button key={chip.key} className={`filter-chip ${chip.pending ? "pending" : ""}`} onClick={() => remove(chip.key)} aria-label={`${w("移除条件", "Remove filter")}: ${chip.label}`}><span>{chip.label}</span><X size={13} aria-hidden="true"/></button>)}
    {chips.length > 0 && <button className="filter-clear" onClick={() => remove("all")}>{t("清除偏好")}</button>}
    {undo && <button className="filter-undo" onClick={onUndo}><Undo2 size={14}/>{w("撤销移除", "Undo removal")}</button>}
    <span className="sr-only" role="status">{undo ? w("条件已移除，可以撤销。", "Filter removed. Undo is available.") : ""}</span>
  </div>;
}
