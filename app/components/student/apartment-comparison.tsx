"use client";
import { useListings } from "@/components/listing-catalog-provider";
import { StudentDialogContent } from "./student-dialog";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Copy, Check, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { displayCity } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import { keepComparisonRow, comparisonDelta } from "@/lib/student/comparison-insights";
import { compareListings, comparisonSearch } from "@/lib/student/planner";
import type { StudentPlan } from "@/lib/student/state";
import type { City } from "@/lib/rental-data";
import { parseCityAmenities, type CityAmenities } from "@/lib/amenities";
import { selectAmenities } from "@/lib/amenity-query";
const subscribeMobile=(notify:()=>void)=>{const query=window.matchMedia("(max-width:600px)");query.addEventListener("change",notify);return()=>query.removeEventListener("change",notify);};
export default function ApartmentComparison({
  open,
  onOpenChange,
  city,
  plan,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: City;
  plan: StudentPlan;
  onChange: (plan: StudentPlan) => void;
}) {
  const { locale, t } = useLocale(),
    w = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const mobile=useSyncExternalStore(subscribeMobile,()=>window.matchMedia("(max-width:600px)").matches,()=>false);
  const [differencesOnly,setDifferencesOnly]=useState(false);
  const [shared, setShared] = useState(false),
    [link, setLink] = useState(""),
    [amenities, setAmenities] = useState<{
      city: string;
      data: CityAmenities;
    } | null>(null);
  useEffect(() => {
    if (!open) return;
    const c = new AbortController();
    fetch(`/amenities/${city.id}.json`, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Unavailable");
        return r.json();
      })
      .then((data) => {
        if (!c.signal.aborted)
          setAmenities({ city: city.id, data: parseCityAmenities(data, city) });
      })
      .catch(() => {});
    return () => c.abort();
  }, [open, city]);
  const rows = compareListings(plan.compareIds, plan, useListings());
  const [pair,setPair]=useState<[string,string]>(["",""]);
  const first=rows.some(r=>r.listing.id===pair[0])?pair[0]:rows[0]?.listing.id;
  const second=rows.some(r=>r.listing.id===pair[1]&&r.listing.id!==first)?pair[1]:rows.find(r=>r.listing.id!==first)?.listing.id;
  const hiddenOnMobile=(id:string)=>id!==first&&id!==second;
  const columns=[...rows].sort((a,b)=>(a.listing.id===first?0:a.listing.id===second?1:2)-(b.listing.id===first?0:b.listing.id===second?1:2));
  const money = (n: number | null) =>
    n === null
      ? w("待确认", "Unknown")
      : `${city.currency}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const criteria: [string,(r:(typeof rows)[number])=>string][] = [
                  [
                    w("资料来源", "Listing source"),
                    (r: (typeof rows)[number]) => r.listing.merchant?w("商家发布 · 未实地核验", "Host supplied · Not inspected"):w("虚构演示房源", "Fictional demo"),
                  ],
                  [
                    w("房型 / 面积", "Room / size"),
                    (r: (typeof rows)[number]) =>
                      `${t(r.listing.roomType)} · ${r.listing.size}m²`,
                  ],
                  [
                    w("租金 / 月", "Rent / month"),
                    (r: (typeof rows)[number]) => money(r.cost.items.rent),
                  ],
                  [
                    w("水电网", "Utility / internet bills"),
                    (r: (typeof rows)[number]) =>
                      r.listing.bills
                        ? w("已包含", "Included")
                        : w("另计，按填写预算", "Separate; your estimate"),
                  ],
                  [
                    w("预计月支出", "Estimated monthly total"),
                    (r: (typeof rows)[number]) =>
                      r.cost.monthlyTotal === null
                        ? `${money(r.cost.knownSubtotal)} + ${w("待确认", "unknown")}`
                        : money(r.cost.monthlyTotal),
                  ],
                  [
                    w("押金 / 一次性费用", "Deposit / one-off fees"),
                    (r: (typeof rows)[number]) =>
                      `${money(r.cost.deposit)} / ${money(r.cost.oneOff)}`,
                  ],
                  [
                    w("到所选楼栋步行", "Walk to selected building"),
                    (r: (typeof rows)[number]) =>
                      r.commute
                        ? `${r.commute.minutes} ${w("分钟", "min")} · ${r.commute.distanceMeters}m`
                        : w("请选择楼栋", "Choose a building"),
                  ],
                  [
                    w("每周往返通勤", "Weekly round-trip commute"),
                    (r: (typeof rows)[number]) =>
                      r.weekly.weeklyMinutes === null
                        ? w("添加常去地点", "Add weekly destinations")
                        : `${r.weekly.weeklyMinutes} ${w("分钟", "min")}`,
                  ],
                  [
                    w("超市 / 交通站点", "Supermarkets / transit stops"),
                    (r: (typeof rows)[number]) => {
                      if (amenities?.city !== city.id)
                        return w("资料未加载", "Data not loaded");
                      const origin: [number, number] = [
                        r.listing.lng,
                        r.listing.lat,
                      ];
                      const count = (category: "supermarket" | "rail") =>
                        selectAmenities(amenities.data, origin, {
                          categories:
                            category === "rail" ? ["rail", "bus"] : [category],
                          radiusMeters: 500,
                          cuisine: "",
                          placeIds: null,
                        }).length;
                      return `${count("supermarket")} / ${count("rail")} · ${w("直线500m快照", "500m straight-line snapshot")}`;
                    },
                  ],
                  [
                    w("可入住日期", "Available from"),
                    (r: (typeof rows)[number]) =>
                      r.housing.availableFrom ?? w("未知", "Unknown"),
                  ],
                  [
                    w("租期", "Lease term"),
                    (r: (typeof rows)[number]) =>
                      r.housing.minLeaseMonths === null
                        ? w("未知", "Unknown")
                        : `${r.housing.minLeaseMonths}–${r.housing.maxLeaseMonths} ${w("个月", "months")}`,
                  ],
                  [
                    w("可租状态 / 更新", "Availability / updated"),
                    (r: (typeof rows)[number]) =>
                      `${r.housing.status === "available" ? w("可租", "Available") : r.housing.status === "unavailable" ? w("不可租", "Unavailable") : w("未知", "Unknown")} · ${r.housing.updatedAt}`,
                  ],
                ];
  const comparedColumns=mobile?columns.filter(r=>!hiddenOnMobile(r.listing.id)):columns;
  const unknownRow=(index:number)=>comparedColumns.some(r=>
    index===3?r.cost.monthlyTotal===null:index===4?r.cost.deposit===null||r.cost.oneOff===null:
    index===5?!r.commute:index===6?r.weekly.weeklyMinutes===null:index===7?amenities?.city!==city.id:
    index===8?!r.housing.availableFrom:index===9?r.housing.minLeaseMonths===null:index===10?r.housing.status==="unknown":false);
  const visibleCriteria=criteria.map(([label,value],index)=>({label,index,values:columns.map(value),
    visible:keepComparisonRow(comparedColumns.map(value),unknownRow(index),differencesOnly)})).filter(row=>row.visible);
  const baseline=comparedColumns[0];
  const signed=(n:number)=>`${n>0?"+":""}${n.toLocaleString("en-US",{maximumFractionDigits:2})}`;
  async function share() {
    const url = `${window.location.origin}/?${comparisonSearch(city.id, plan)}`;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
    } catch {
      setShared(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <StudentDialogContent closeLabel={w("关闭对比", "Close comparison")} className="student-dialog student-compare-dialog sm:max-w-[1040px]">
        <div className="student-dialog-header"><DialogTitle>{w("公寓对比", "Compare apartments")}</DialogTitle>
        <DialogDescription>
          {rows[0]?.destination ?? displayCity(city, locale).university} ·{" "}
          {w(
            "最多三套 · 使用同一目的地与费用假设",
            "Up to three · Same destination and cost assumptions",
          )}
        </DialogDescription></div>
        <div className="student-dialog-scroll">{rows.length === 0 ? (
          <p>
            {w(
              "先在房源卡片上点击“加入对比”。",
              "Choose “Compare” on an apartment card first.",
            )}
          </p>
        ) : (
          <><div className="compare-toolbar"><label><input type="checkbox" checked={differencesOnly} disabled={rows.length<2} onChange={e=>setDifferencesOnly(e.target.checked)}/>{w("只看差异","Differences only")}</label><small>{w(`隐藏 ${criteria.length-visibleCriteria.length} 项相同信息；未知项保留`,`Hiding ${criteria.length-visibleCriteria.length} matching rows; unknowns stay visible`)}</small></div>
          {baseline&&comparedColumns.length>1&&<div className="compare-insights" aria-label={w("对比差异摘要","Comparison differences summary")}><p>{w("相对","Compared with")} <strong>{baseline.listing.name}</strong></p>{comparedColumns.slice(1).map(row=>{const delta=comparisonDelta(baseline,row);return <div key={row.listing.id}><strong>{row.listing.name}</strong><span>{delta.monthly===null?w(`月租 ${signed(delta.rent)} ${city.currency}；总支出未完整，暂不比较`,`Monthly rent ${signed(delta.rent)} ${city.currency}; total costs incomplete`):w(`月总支出 ${signed(delta.monthly)} ${city.currency}`,`Monthly total ${signed(delta.monthly)} ${city.currency}`)}</span><span>{delta.oneWayMinutes===null?w("选择楼栋后比较通勤","Choose a building to compare walks"):w(`单程步行 ${signed(delta.oneWayMinutes)} 分钟`,`One-way walk ${signed(delta.oneWayMinutes)} min`)}</span></div>;})}</div>}
          <div className="compare-pair-picker" aria-label={w("选择手机对比的两套公寓","Choose two homes to compare on mobile")}>
            <p>{w("一次并排看两套，比较项目始终保留。","Compare two side by side with criteria always visible.")}</p>
            {[first,second].map((value,index)=><label key={index}>{index===0?w("公寓 A","Home A"):w("公寓 B","Home B")}<select value={value??""} disabled={index===1&&rows.length<2} onChange={event=>setPair(index===0?[event.target.value,second??""]:[first??"",event.target.value])}>{rows.filter(row=>index===0||row.listing.id!==first).map(row=><option key={row.listing.id} value={row.listing.id}>{row.listing.name}</option>)}</select></label>)}
          </div><div className="student-table-wrap" tabIndex={0} aria-label={w("公寓比较详情","Apartment comparison details")}>
            <table className="student-compare-table">
              <thead>
                <tr>
                  <th scope="col">{w("比较项目", "Criteria")}</th>
                  {columns.map((r) => (
                    <th scope="col" key={r.listing.id} data-mobile-hidden={hiddenOnMobile(r.listing.id)}>
                      <div className="compare-column-heading">
                      <strong>{r.listing.name}</strong>
                      <button
                        aria-label={`${w("移出对比", "Remove from comparison")} ${r.listing.name}`}
                        onClick={() =>
                          onChange({
                            ...plan,
                            compareIds: plan.compareIds.filter(
                              (id) => id !== r.listing.id,
                            ),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCriteria.map(({label,values,index}) => (
                  <tr key={label} data-comparison-row={index}>
                    <th scope="row">{label}</th>
                    {columns.map((r,i) => (
                      <td key={r.listing.id} data-mobile-hidden={hiddenOnMobile(r.listing.id)}>{values[i]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div></>
        )}
        <p className="student-note">
          {w(
            "未知金额不按零。演示房源不可预订；商家房源须咨询确认。设施为快照，入口与营业状态未核验。",
            "Unknown amounts are not zero. Demo homes cannot be booked; confirm partner listings with the host. Facilities are snapshots; entrances and opening status are unverified.",
          )}
        </p>
        <div className="student-actions">
          <button
            className="secondary-button"
            disabled={rows.length < 2}
            onClick={() => void share()}
          >
            {shared ? <Check size={16} /> : <Copy size={16} />}{" "}
            {shared
              ? w("链接已复制", "Link copied")
              : w("分享房源与目的地", "Share homes and destination")}
          </button>
        </div>
        {link && (
          <label className="student-share-link">
            {w(
              "分享链接不包含个人支出假设或常去地点。",
              "The link excludes personal expense assumptions and weekly destinations.",
            )}
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              aria-label={w(
                "房源对比分享链接",
                "Apartment comparison share link",
              )}
            />
          </label>
        )}
        </div>
      </StudentDialogContent>
    </Dialog>
  );
}
