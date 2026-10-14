"use client";
import { useEffect, useState } from "react";
import { Copy, Check, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { displayCity } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import { compareListings, comparisonSearch } from "@/lib/student/planner";
import type { StudentPlan } from "@/lib/student/state";
import type { City } from "@/lib/rental-data";
import { parseCityAmenities, type CityAmenities } from "@/lib/amenities";
import { selectAmenities } from "@/lib/amenity-query";
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
  const rows = compareListings(plan.compareIds, plan);
  const money = (n: number | null) =>
    n === null
      ? w("待确认", "Unknown")
      : `${city.currency}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
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
      <DialogContent className="student-dialog student-compare-dialog sm:max-w-[1040px]">
        <DialogTitle>{w("公寓对比", "Compare apartments")}</DialogTitle>
        <DialogDescription>
          {rows[0]?.destination ?? displayCity(city, locale).university} ·{" "}
          {w(
            "最多三套 · 使用同一目的地与费用假设",
            "Up to three · Same destination and cost assumptions",
          )}
        </DialogDescription>
        {rows.length === 0 ? (
          <p>
            {w(
              "先在房源卡片上点击“加入对比”。",
              "Choose “Compare” on an apartment card first.",
            )}
          </p>
        ) : (
          <div className="student-table-wrap">
            <table className="student-compare-table">
              <thead>
                <tr>
                  <th>{w("比较项目", "Criteria")}</th>
                  {rows.map((r) => (
                    <th key={r.listing.id}>
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
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
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
                    w("演示入住日期", "Demo available from"),
                    (r: (typeof rows)[number]) =>
                      r.housing.availableFrom ?? w("未知", "Unknown"),
                  ],
                  [
                    w("演示租期", "Demo lease term"),
                    (r: (typeof rows)[number]) =>
                      r.housing.minLeaseMonths === null
                        ? w("未知", "Unknown")
                        : `${r.housing.minLeaseMonths}–${r.housing.maxLeaseMonths} ${w("个月", "months")}`,
                  ],
                  [
                    w("演示库存 / 更新", "Demo status / updated"),
                    (r: (typeof rows)[number]) =>
                      `${r.housing.status === "available" ? w("可租", "Available") : r.housing.status === "unavailable" ? w("不可租", "Unavailable") : w("未知", "Unknown")} · ${r.housing.updatedAt}`,
                  ],
                ].map(([label, value]) => (
                  <tr key={label as string}>
                    <th>{label as string}</th>
                    {rows.map((r) => (
                      <td key={r.listing.id}>
                        {(value as (r: (typeof rows)[number]) => string)(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="student-note">
          {w(
            "未知金额不按零。所有房源为不可预订的演示数据；设施为快照，入口与营业状态未核验。",
            "Unknown amounts are not zero. All apartments are non-bookable demos; facilities are snapshots with unverified entrances and opening status.",
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
      </DialogContent>
    </Dialog>
  );
}
