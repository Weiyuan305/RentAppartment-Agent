"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useLocale } from "../locale-provider";
import { cities, getCity } from "@/lib/rental-data";
import type { Property } from "@/lib/merchant/model";
import type { AddressResult } from "@/lib/merchant/geocoding";
import { EntranceMap } from "./entrance-map";

export function PropertyLocation({
  draft,
  patch,
  disabled,
}: {
  draft: Property;
  patch: (p: Partial<Property>) => void;
  disabled: boolean;
}) {
  const { locale } = useLocale(),
    en = locale === "en",
    city = getCity(draft.cityId);
  const [results, setResults] = useState<AddressResult[] | null>(null),
    [searching, setSearching] = useState(false),
    [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const queryKey = JSON.stringify([
    draft.cityId,
    draft.address,
    draft.postcode,
    locale,
  ]);
  const currentKey = useRef(queryKey);
  useEffect(() => {
    currentKey.current = queryKey;
    return () => request.current?.abort();
  }, [queryKey]);
  const [resultKey, setResultKey] = useState("");
  const currentResults = resultKey === queryKey ? results : null,
    currentError = resultKey === queryKey ? error : "";
  const chosen =
    !!draft.locationSource ||
    draft.entranceConfirmed ||
    draft.lat !== city.lat ||
    draft.lng !== city.lng;
  function changeAddress(p: Partial<Property>) {
    request.current?.abort();
    setSearching(false);
    patch({
      lat: city.lat,
      lng: city.lng,
      ...p,
      entranceConfirmed: false,
      locationSource: null,
    });
  }
  async function search() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    setError("");
    setResults(null);
    setResultKey(queryKey);
    try {
      const r = await fetch("/api/merchant/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityId: draft.cityId,
          address: draft.address,
          postcode: draft.postcode ?? "",
          locale,
        }),
        signal: controller.signal,
      });
      const data = (await r.json()) as {
        error?: string;
        results: AddressResult[];
      };
      if (!r.ok)
        throw new Error(
          data.error || (en ? "Address search failed" : "地址查询失败"),
        );
      if (!controller.signal.aborted && currentKey.current === queryKey)
        setResults(data.results);
    } catch (e) {
      if (!controller.signal.aborted && currentKey.current === queryKey)
        setError((e as Error).message);
    } finally {
      if (request.current === controller) setSearching(false);
    }
  }
  return (
    <div className="mw-wide mw-property-location">
      <div className="mw-location-city">
        <div>
          <MapPin size={18} />
          <strong>{en ? city.english : city.name}</strong>
          <span>{en ? "Property city" : "房源所在城市"}</span>
        </div>
        <details>
          <summary>{en ? "Change city" : "切换城市"}</summary>
          <label className="mw-field">
            <span>{en ? "City for this property" : "此套房源的城市"}</span>
            <select
              disabled={disabled}
              value={draft.cityId}
              onChange={(e) => {
                const c = getCity(e.target.value);
                changeAddress({
                  cityId: c.id,
                  address: "",
                  postcode: "",
                  area: "",
                  lat: c.lat,
                  lng: c.lng,
                });
              }}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {en ? c.english : c.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mw-note">
            {en
              ? "Only changes this property. Recheck its address and prices; amounts are not converted between currencies."
              : "仅修改此套房源。切换后请重新核对地址和价格，金额不会自动换算汇率。"}
          </p>
        </details>
      </div>
      <div className="mw-grid">
        <label className="mw-field mw-wide">
          <span>{en ? "Full address (public)" : "完整地址（公开显示）"}</span>
          <input
            disabled={disabled}
            maxLength={300}
            autoComplete="street-address"
            value={draft.address}
            placeholder={
              en ? "Building number and street" : "填写门牌号和街道名称"
            }
            onChange={(e) => changeAddress({ address: e.target.value })}
          />
        </label>
        {city.countryId !== "hk" && (
          <label className="mw-field">
            <span>{en ? "Postcode (optional)" : "邮编（可选）"}</span>
            <input
              disabled={disabled}
              maxLength={20}
              autoComplete="postal-code"
              value={draft.postcode ?? ""}
              onChange={(e) => changeAddress({ postcode: e.target.value })}
            />
          </label>
        )}
        <label className="mw-field">
          <span>{en ? "Neighbourhood" : "区域"}</span>
          <input
            disabled={disabled}
            maxLength={100}
            value={draft.area}
            onChange={(e) => patch({ area: e.target.value })}
          />
        </label>
      </div>
      <div className="mw-address-search">
        <button
          type="button"
          className="mw-primary"
          disabled={
            disabled ||
            searching ||
            (draft.address.trim().length < 3 &&
              (draft.postcode ?? "").trim().length < 3)
          }
          onClick={() => void search()}
        >
          <Search size={17} />
          {searching
            ? en
              ? "Finding address…"
              : "正在查找地址…"
            : en
              ? "Find on map"
              : "查找地址并定位"}
        </button>
        <span>
          {en
            ? "Search an address or postcode, then confirm the entrance below."
            : "输入地址或邮编查询，再在下方地图确认入口。"}
        </span>
      </div>
      <div aria-live="polite">
        {currentError && <p className="mw-error">{currentError}</p>}
        {currentResults?.length === 0 && (
          <p className="mw-note">
            {en
              ? "No match found. Try a street name or postcode, or choose the entrance directly on the map. A full address is still required to publish."
              : "没有找到匹配地址。可尝试街道名或邮编，也可直接在地图上选择入口；发布仍需填写完整地址。"}
          </p>
        )}
      </div>
      {!!currentResults?.length && (
        <div className="mw-address-results">
          <p>
            {en
              ? "Choose a result, then check the entrance"
              : "选择匹配结果，再核对公寓入口"}
          </p>
          {currentResults.map((r, i) => (
            <button
              type="button"
              disabled={disabled}
              key={`${r.id}-${i}`}
              onClick={() => {
                patch({
                  lat: r.lat,
                  lng: r.lng,
                  postcode: draft.postcode || r.postcode,
                  area: draft.area || r.area,
                  entranceConfirmed: false,
                  locationSource: "search",
                });
                setResults(null);
              }}
            >
              <MapPin size={18} />
              <span>
                <strong>{r.label}</strong>
                <small>
                  {r.precision === "building"
                    ? en
                      ? "Building match · confirm entrance"
                      : "建筑匹配 · 请确认入口"
                    : r.precision === "street"
                      ? en
                        ? "Street match · refine entrance on map"
                        : "街道匹配 · 请在地图上微调入口"
                      : en
                        ? "Area match · refine entrance on map"
                        : "区域匹配 · 请在地图上微调入口"}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="mw-note mw-location-status">
        {draft.entranceConfirmed
          ? en
            ? "Entrance confirmed"
            : "入口已确认"
          : chosen
            ? en
              ? "Position selected — confirm the entrance below"
              : "已选择位置，请核对下方公寓入口"
            : en
              ? "Search above or click the map to place the entrance"
              : "可查询地址或直接点击地图，选择公寓入口"}
      </p>
      <EntranceMap
        key={draft.cityId}
        cityId={draft.cityId}
        lat={draft.lat}
        lng={draft.lng}
        chosen={chosen}
        disabled={disabled}
        onChoose={(lat, lng) =>
          patch({ lat, lng, locationSource: "map", entranceConfirmed: false })
        }
      />
      <details className="mw-location-coordinates">
        <summary>
          {en ? "Exact coordinates (optional)" : "精确坐标（可选）"}
        </summary>
        <div className="mw-grid">
          {(["lng", "lat"] as const).map((axis) => (
            <label className="mw-field" key={axis}>
              <span>
                {axis === "lng"
                  ? en
                    ? "Longitude"
                    : "经度"
                  : en
                    ? "Latitude"
                    : "纬度"}
              </span>
              <input
                type="number"
                step="any"
                disabled={disabled}
                min={axis === "lng" ? -180 : -85}
                max={axis === "lng" ? 180 : 85}
                value={draft[axis]}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n))
                    patch({
                      [axis]: n,
                      locationSource: "manual",
                      entranceConfirmed: false,
                    });
                }}
              />
            </label>
          ))}
        </div>
      </details>
      <label className="mw-check mw-entrance-confirm">
        <input
          type="checkbox"
          disabled={disabled || !chosen}
          checked={draft.entranceConfirmed}
          onChange={(e) => patch({ entranceConfirmed: e.target.checked })}
        />
        {en
          ? "I have checked that the pin marks the property entrance"
          : "我已核对标记位于公寓入口"}
      </label>
      <p className="mw-note mw-location-attribution">
        {en ? "Address results: " : "地址数据："}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OpenStreetMap
        </a>{" "}
        · Nominatim
      </p>
    </div>
  );
}
