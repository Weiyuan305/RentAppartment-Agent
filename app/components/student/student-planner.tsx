"use client";
import { useId, useState } from "react";
import {
  Building2,
  Footprints,
  Plus,
  Trash2,
  TrainFront,
  ArrowUpRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { displayCity } from "@/lib/i18n";
import { useLocale } from "@/components/locale-provider";
import {
  buildingsInCity,
  buildingById,
  campuses,
  searchBuildings,
} from "@/lib/student/catalog";
import {
  monthlyCost,
  housingDetails,
  weeklyCommute,
} from "@/lib/student/planner";
import { transitSources, transitDirectionsUrl } from "@/lib/student/transit";
import type { StudentPlan } from "@/lib/student/state";
import type { City, Listing } from "@/lib/rental-data";
import type { Filters } from "@/lib/assistant";
const expenseKeys = [
  "utilities",
  "internet",
  "transport",
  "other",
  "deposit",
  "oneOff",
] as const;
export default function StudentPlanner({
  open,
  onOpenChange,
  city,
  listing,
  listings,
  plan,
  onChange,
  filters,
  onFilters,
  onWalk,
  onTransit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  city: City;
  listing?: Listing;
  listings: Listing[];
  plan: StudentPlan;
  onChange: (plan: StudentPlan) => void;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  onWalk: () => void;
  onTransit: () => void;
}) {
  const { locale } = useLocale(),
    w = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const tabsId = useId();
  const [tab, setTab] = useState("campus"),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState("");
  const destination = buildingById(plan.destinationId),
    buildings = searchBuildings(city.id, query, plan.campusId).filter(
      (b) =>
        plan.buildingCategory === "all" || b.category === plan.buildingCategory,
    );
  const cost = listing ? monthlyCost(listing, plan) : null,
    source = transitSources[city.id];
  function money(value: number | null | undefined) {
    return value == null
      ? w("待填写", "Not provided")
      : `${city.currency}${value.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 })}`;
  }
  function amount(key: (typeof expenseKeys)[number], value: string) {
    const n = value === "" ? null : Number(value);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 10000000)) {
      setNotice(
        w(
          "请输入 0 至 10,000,000 之间的金额。",
          "Enter an amount between 0 and 10,000,000.",
        ),
      );
      return;
    }
    setNotice("");
    onChange({ ...plan, expenses: { ...plan.expenses, [key]: n } });
  }
  const expenseNames = {
    utilities: w("每月水电", "Monthly utilities"),
    internet: w("每月网络", "Monthly internet"),
    transport: w("每月交通", "Monthly transport"),
    other: w("其他月支出", "Other monthly costs"),
    deposit: w("可退押金（单列）", "Refundable deposit (separate)"),
    oneOff: w("一次性费用", "One-off fees"),
  };
  const categories = [
    ["all", w("全部建筑", "All buildings")],
    ["teaching", w("教学楼", "Teaching")],
    ["library", w("图书馆", "Libraries")],
    ["services", w("学生服务", "Student services")],
    ["dining", w("食堂", "Dining")],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="student-dialog sm:max-w-[860px]">
        <DialogTitle>
          {w("我的留学生活规划", "Plan your student life")}
        </DialogTitle>
        <DialogDescription>
          {displayCity(city, locale).university} ·{" "}
          {w(
            "以实际到达的楼栋为通勤目的地",
            "Choose the building you actually travel to",
          )}
        </DialogDescription>
        <div
          className="student-tabs"
          role="tablist"
          aria-label={w("规划内容", "Planner sections")}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            const current = tabs.indexOf(event.target as HTMLButtonElement);
            if (current < 0) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            tabs[next].focus();
            tabs[next].click();
            tabs[next].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
          }}
        >
          {[
            ["campus", w("校园与通勤", "Campus")],
            ["housing", w("入住与租期", "Move-in")],
            ["costs", w("生活支出", "Costs")],
            ["weekly", w("常去地点", "Weekly places")],
            ["transit", w("公共交通", "Transit")],
          ].map(([id, name]) => (
            <button
              key={id}
              role="tab"
              id={`${tabsId}-${id}`}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab === id ? 0 : -1}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="student-panel" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} tabIndex={0}>
          {tab === "campus" && (
            <>
              <div className="student-fields">
                <label>
                  {w("大学 / 校区", "University / campus")}
                  <select
                    aria-label={w("选择校区", "Select campus")}
                    value={plan.campusId ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...plan,
                        campusId: e.target.value || null,
                        destinationId: null,
                        routeBuilding: false,
                        transitRequested: false,
                        catchmentMinutes: null,
                      })
                    }
                  >
                    <option value="">
                      {w("全部已收录校区", "All indexed campuses")}
                    </option>
                    {campuses
                      .filter((c) => c.cityId === city.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.university} · {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {w("查找楼名或简称", "Building name or abbreviation")}
                  <input
                    aria-label={w("搜索校园建筑", "Search campus buildings")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={w(
                      "例如 Wilkins、图书馆、BIZ1",
                      "e.g. Wilkins, library, BIZ1",
                    )}
                  />
                </label>
              </div>
              <div className="student-fields">
                <label>
                  {w("建筑分类", "Building category")}
                  <select
                    value={plan.buildingCategory}
                    onChange={(e) =>
                      onChange({
                        ...plan,
                        buildingCategory: e.target
                          .value as StudentPlan["buildingCategory"],
                      })
                    }
                  >
                    {categories.map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="student-check">
                  <input
                    type="checkbox"
                    checked={plan.showBuildings}
                    onChange={(e) =>
                      onChange({ ...plan, showBuildings: e.target.checked })
                    }
                  />
                  {w("在地图上显示校园建筑", "Show campus buildings on map")}
                </label>
              </div>
              <div
                className="student-buildings"
                aria-label={w("校园建筑结果", "Campus building results")}
              >
                {buildings.map((b) => (
                  <button
                    key={b.id}
                    aria-pressed={b.id === plan.destinationId}
                    onClick={() =>
                      onChange({
                        ...plan,
                        destinationId: b.id,
                        campusId: b.campusId,
                        showBuildings: true,
                        routeBuilding: false,
                        transitRequested: false,
                      })
                    }
                  >
                    <Building2 size={17} />
                    <span>
                      <strong>{b.name}</strong>
                      <small>
                        {b.locationType === "mapped-entrance"
                          ? w(
                              "OSM 标注入口 · 开放状态未核验",
                              "OSM mapped entrance · access unverified",
                            )
                          : w(
                              "楼栋附近 · 入口未核验",
                              "Building location · entrance unverified",
                            )}
                      </small>
                    </span>
                    {b.id === plan.destinationId && (
                      <span className="student-selected">✓</span>
                    )}
                  </button>
                ))}
                {!buildings.length && (
                  <p>
                    {w(
                      "没有匹配的已收录楼栋，请试试英文名称或简称。",
                      "No indexed building matches. Try its English name or abbreviation.",
                    )}
                  </p>
                )}
              </div>
              <div className="student-fields">
                <label>
                  {w("步行可达区域", "Walking catchment")}
                  <select
                    aria-label={w("步行可达区域", "Walking catchment")}
                    disabled={!destination}
                    value={plan.catchmentMinutes ?? 0}
                    onChange={(e) =>
                      onChange({
                        ...plan,
                        catchmentMinutes:
                          Number(e.target.value) === 0
                            ? null
                            : (Number(e.target.value) as 10 | 20 | 30),
                      })
                    }
                  >
                    <option value="0">{w("不显示", "Hidden")}</option>
                    {[10, 20, 30].map((n) => (
                      <option key={n} value={n}>
                        {n} {w("分钟 · 真实路网", "min · real network")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {w("公寓到目的地步行上限", "Maximum walk from apartment")}
                  <select
                    aria-label={w("通勤时间上限", "Maximum walking time")}
                    value={filters.walkMinutes ?? 0}
                    onChange={(e) =>
                      onFilters({
                        ...filters,
                        walkMinutes: Number(e.target.value) || null,
                      })
                    }
                  >
                    <option value="0">{w("不限", "Any")}</option>
                    {[10, 15, 20, 30, 45, 60].map((n) => (
                      <option key={n} value={n}>
                        {n} {w("分钟", "min")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="student-actions">
                <button
                  className="primary-button"
                  disabled={!destination || !listing}
                  onClick={() => {
                    onWalk();
                    onOpenChange(false);
                  }}
                >
                  <Footprints size={16} />
                  {w("显示到选定楼栋的路线", "Walk to selected building")}
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    onChange({
                      ...plan,
                      destinationId: null,
                      campusId: null,
                      routeBuilding: false,
                      transitRequested: false,
                      catchmentMinutes: null,
                    })
                  }
                >
                  {w(
                    "恢复大学默认目的地",
                    "Use default university destination",
                  )}
                </button>
              </div>
              <p className="student-note">
                {w(
                  "常用楼栋目录，非全部建筑。范围来自反向步行等时圈，公寓筛选逐套核对路线时间。",
                  "A directory of common destinations, not every building. Catchments use a reverse pedestrian network; filters check each apartment route.",
                )}{" "}
                © OpenStreetMap ·{" "}
                <a
                  href={
                    destination?.source.url ??
                    campuses.find((c) => c.cityId === city.id)?.officialUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {w("查看地点来源", "View location source")} ↗
                </a>
              </p>
            </>
          )}
          {tab === "housing" && (
            <>
              <p className="student-note">
                {w(
                  "以下为演示入住条件，可用于体验筛选，不代表真实可租库存。",
                  "These demo availability terms let you try filters. They are not live rental inventory.",
                )}
              </p>
              <div className="student-fields">
                <label>
                  {w("希望入住日期", "Preferred move-in date")}
                  <input
                    type="date"
                    aria-label={w("入住日期", "Move-in date")}
                    value={plan.housing.moveIn ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...plan,
                        housing: {
                          ...plan.housing,
                          moveIn: e.target.value || null,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  {w("希望租期（月）", "Desired lease (months)")}
                  <select
                    aria-label={w("租期月数", "Lease months")}
                    value={plan.housing.leaseMonths ?? 0}
                    onChange={(e) =>
                      onChange({
                        ...plan,
                        housing: {
                          ...plan.housing,
                          leaseMonths: Number(e.target.value) || null,
                        },
                      })
                    }
                  >
                    <option value="0">{w("不限", "Any")}</option>
                    {[1, 3, 6, 9, 12, 18, 24].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="student-check">
                <input
                  type="checkbox"
                  checked={plan.housing.availableOnly}
                  onChange={(e) =>
                    onChange({
                      ...plan,
                      housing: {
                        ...plan.housing,
                        availableOnly: e.target.checked,
                      },
                    })
                  }
                />
                {w(
                  "只看演示状态为可租的房源",
                  "Show demo available properties only",
                )}
              </label>
              <div className="student-summary-list">
                {listings.map((l) => {
                  const h = housingDetails(l);
                  return (
                    <div key={l.id}>
                      <strong>{l.name}</strong>
                      <span>
                        {h.availableFrom ?? w("日期未知", "Date unknown")} ·{" "}
                        {h.minLeaseMonths ?? "?"}–{h.maxLeaseMonths ?? "?"}{" "}
                        {w("个月", "months")}
                      </span>
                      <small>
                        {h.status === "available"
                          ? w("演示可租", "Demo available")
                          : h.status === "unavailable"
                            ? w("演示不可租", "Demo unavailable")
                            : w("状态未知", "Unknown status")}{" "}
                        · {w("更新", "Updated")} {h.updatedAt}
                      </small>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {tab === "costs" && (
            <>
              <p className="student-note">
                {w(
                  "填写你的预算假设，所有金额使用当前城市币种。留空表示未知；含账单公寓的水电网不重复计算。",
                  "Enter your budget assumptions in the current city currency. Blank means unknown. Included utility/internet bills are not charged twice.",
                )}
              </p>
              <div className="student-fields">
                {expenseKeys.map((k) => (
                  <label key={k}>
                    {expenseNames[k]} ({city.currency})
                    <input
                      type="number"
                      min="0"
                      max="10000000"
                      step="0.01"
                      aria-label={expenseNames[k]}
                      value={plan.expenses[k] ?? ""}
                      onChange={(e) => amount(k, e.target.value)}
                      placeholder={w("未知，待填写", "Unknown")}
                    />
                  </label>
                ))}
              </div>
              {notice && <p role="alert">{notice}</p>}
              {cost && (
                <div className="student-cost-result">
                  <span>
                    {listing?.name} · {w("每月租金", "Monthly rent")}{" "}
                    {money(cost.items.rent)}
                  </span>
                  <strong>
                    {w("预计月支出", "Estimated monthly total")}{" "}
                    {cost.monthlyTotal === null
                      ? `${money(cost.knownSubtotal)} + ${w("待确认项", "unknown items")}`
                      : money(cost.monthlyTotal)}
                  </strong>
                  <span>
                    {w("押金", "Deposit")} {money(cost.deposit)} ·{" "}
                    {w("一次性费用", "One-off fees")} {money(cost.oneOff)}
                  </span>
                  <span>
                    {w(
                      "首月所需资金（含押金）",
                      "Initial outlay (including deposit)",
                    )}{" "}
                    {money(cost.initialOutlay)}
                  </span>
                </div>
              )}
              <p className="student-note">
                {w(
                  "周租按 52 周 / 12 月折算；押金单列，不计入每月支出。此处为用户估算，非房东报价。",
                  "Weekly rent is converted using 52 weeks / 12 months. Deposit is separate from monthly costs. These are your assumptions, not landlord quotes.",
                )}
              </p>
            </>
          )}
          {tab === "weekly" && (
            <>
              <p className="student-note">
                {w(
                  "添加常去楼栋和每周到访次数。每次按公寓到该地点往返计算，不是串联多站行程。",
                  "Add regular destinations and visits per week. Each visit is a round trip from home, not a chained multi-stop itinerary.",
                )}
              </p>
              {plan.destinations.map((d, i) => (
                <div className="student-weekly-row" key={d.buildingId}>
                  <select
                    aria-label={`${w("常用地点", "Weekly destination")} ${i + 1}`}
                    value={d.buildingId}
                    onChange={(e) => {
                      if (
                        plan.destinations.some(
                          (x, j) => j !== i && x.buildingId === e.target.value,
                        )
                      )
                        return;
                      onChange({
                        ...plan,
                        destinations: plan.destinations.map((x, j) =>
                          j === i ? { ...x, buildingId: e.target.value } : x,
                        ),
                      });
                    }}
                  >
                    {buildingsInCity(city.id).map((b) => (
                      <option
                        key={b.id}
                        value={b.id}
                        disabled={plan.destinations.some(
                          (x, j) => j !== i && x.buildingId === b.id,
                        )}
                      >
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <label>
                    {w("每周", "Weekly")}
                    <select
                      aria-label={`${w("每周到访次数", "Visits per week")} ${i + 1}`}
                      value={d.visitsPerWeek}
                      onChange={(e) =>
                        onChange({
                          ...plan,
                          destinations: plan.destinations.map((x, j) =>
                            j === i
                              ? { ...x, visitsPerWeek: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    >
                      {Array.from({ length: 14 }, (_, n) => n + 1).map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    aria-label={w("移除常用地点", "Remove weekly destination")}
                    onClick={() =>
                      onChange({
                        ...plan,
                        destinations: plan.destinations.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                className="secondary-button"
                disabled={plan.destinations.length >= 5}
                onClick={() => {
                  const b = buildingsInCity(city.id).find(
                    (b) =>
                      !plan.destinations.some((d) => d.buildingId === b.id),
                  );
                  if (b)
                    onChange({
                      ...plan,
                      destinations: [
                        ...plan.destinations,
                        { buildingId: b.id, visitsPerWeek: 3 },
                      ],
                    });
                }}
              >
                <Plus size={16} />
                {w("添加常去地点", "Add weekly destination")}
              </button>
              <div className="student-summary-list">
                {plan.destinations.length > 0 &&
                  listings.map((l) => {
                    const summary = weeklyCommute(l.id, plan);
                    return (
                      <div key={l.id}>
                        <strong>{l.name}</strong>
                        <span>
                          {w("每周往返步行", "Weekly round-trip walking")}{" "}
                          {summary.weeklyMinutes ?? w("未知", "Unknown")}{" "}
                          {w("分钟", "min")}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
          {tab === "transit" && (
            <>
              <div className="student-transit-title">
                <TrainFront size={24} />
                <div>
                  <strong>{source.operator}</strong>
                  <p>{source.notes[locale]}</p>
                </div>
              </div>
              {source.lines.length > 0 && (
                <div className="student-line-tags">
                  {source.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              )}
              <p>
                {w("目的地", "Destination")}:{" "}
                {destination?.name ??
                  w(
                    "请先在校园页选择楼栋",
                    "Select a building in the Campus tab",
                  )}
              </p>
              <div className="student-actions">
                {destination && listing && (
                  <a
                    className="primary-button"
                    href={transitDirectionsUrl(listing, destination)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {w("在外部地图规划此行程", "Plan this journey externally")}{" "}
                    <ArrowUpRight size={16} />
                  </a>
                )}
                <a
                  className="secondary-button"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {w("官方公共交通规划", "Official transit planner")} ↗
                </a>
                {city.id === "london" && (
                  <button
                    className="secondary-button"
                    disabled={!destination || !listing}
                    onClick={() => {
                      onTransit();
                      onOpenChange(false);
                    }}
                  >
                    <TrainFront size={16} />
                    {w("在地图查看交通选项", "View transit options on map")}
                  </button>
                )}
                <a href={source.campusUrl} target="_blank" rel="noreferrer">
                  {w("学校地图 / 校车说明", "Campus map / shuttle details")} ↗
                </a>
              </div>
              <p className="student-note">
                {w(
                  "外部规划入口会在新页面打开。静态线路不表示当前有班次，未接入的城市不会显示估造的到站时间。",
                  "External planners open in a new tab. Static routes do not imply a service is running now. Arrival times are shown only when supported by provider data.",
                )}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
