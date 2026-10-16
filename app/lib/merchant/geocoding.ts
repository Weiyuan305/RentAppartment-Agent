import { createHash } from "node:crypto";
import { z } from "zod";
import { cityIds, getCity, type CityId } from "../rental-data";
import type { RentalDatabase } from "../agent/database";
import { createStore, SessionError } from "../agent/store";

export const addressSearchSchema = z
  .object({
    cityId: z.enum(cityIds),
    address: z.string().trim().max(300),
    postcode: z.string().trim().max(20),
    locale: z.enum(["zh", "en"]),
  })
  .strict()
  .refine((v) => v.address.length >= 3 || v.postcode.length >= 3);
export type AddressSearch = z.infer<typeof addressSearchSchema>;
export type AddressResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  postcode: string;
  area: string;
  precision: "building" | "street" | "area";
};
const countries = { uk: "gb", au: "au", sg: "sg", my: "my", hk: "hk" };
export function nearCity(cityId: CityId, lat: number, lng: number) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 85 ||
    Math.abs(lng) > 180
  )
    return false;
  const c = getCity(cityId),
    radians = Math.PI / 180;
  const a =
    Math.sin(((lat - c.lat) * radians) / 2) ** 2 +
    Math.cos(c.lat * radians) *
      Math.cos(lat * radians) *
      Math.sin(((lng - c.lng) * radians) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a))) < 65;
}
// Upstream strings are displayed as React text, never as markup or URLs.
export function addressResults(raw: unknown, cityId: CityId): AddressResult[] {
  if (!Array.isArray(raw))
    throw new SessionError(
      "地址服务返回异常，请稍后重试 / Invalid address response",
      502,
    );
  const country = countries[getCity(cityId).countryId];
  const results: AddressResult[] = [];
  for (const row of raw.slice(0, 20)) {
    if (
      !row ||
      typeof row !== "object" ||
      !row.address ||
      row.address.country_code !== country
    )
      continue;
    if (
      ![row.lat, row.lon].every(
        (v) =>
          (typeof v === "string" && v.trim() !== "") || typeof v === "number",
      )
    )
      continue;
    const lat = Number(row.lat),
      lng = Number(row.lon);
    if (typeof row.display_name !== "string" || !nearCity(cityId, lat, lng))
      continue;
    const a = row.address;
    const value = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : "";
    const kind = row.addresstype;
    results.push({
      id: value(`${row.osm_type ?? "place"}/${row.osm_id ?? row.place_id}`, 80),
      label: row.display_name.slice(0, 500),
      lat,
      lng,
      postcode: value(a.postcode, 20),
      area: value(
        a.neighbourhood ?? a.suburb ?? a.city_district ?? a.quarter,
        100,
      ),
      precision:
        a.house_number ||
        ["building", "house", "apartments", "dormitory"].includes(kind)
          ? "building"
          : ["road", "street", "pedestrian"].includes(kind)
            ? "street"
            : "area",
    });
  }
  return results.slice(0, 5);
}

export function createAddressSearch(
  db: RentalDatabase,
  request: typeof fetch = fetch,
) {
  const store = createStore(async () => db);
  return async (input: unknown, owner: string) => {
    const q = addressSearchSchema.parse(input);
    await store.consumeQuota(`address:user:${owner}`, 20, 60000);
    // Administrators can change the server endpoint without rebuilding the client.
    const endpoint =
      process.env.ATLAS_GEOCODING_URL ||
      "https://nominatim.openstreetmap.org/search";
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new SessionError(
        "地址服务配置异常 / Invalid address configuration",
        503,
      );
    const key = `geocode:v1:${createHash("sha256")
      .update(
        JSON.stringify([
          endpoint,
          q.cityId,
          q.address.toLowerCase().replace(/\s+/g, " "),
          q.postcode.toUpperCase().replace(/\s+/g, ""),
          q.locale,
        ]),
      )
      .digest("hex")}`;
    const cached = await db.first<{ payload: string }>(
      "SELECT payload FROM routes WHERE key=? AND expires>?",
      [key, Date.now()],
    );
    if (cached)
      return JSON.parse(cached.payload) as { results: AddressResult[] };
    await db.run("DELETE FROM routes WHERE key GLOB 'geocode:v1:*' AND expires<=?", [Date.now()]);
    // One global lease covers every Cloudflare instance; release only after completion,
    // then leave a one-second gap. A crashed request expires after thirty seconds.
    const now = Date.now(),
      lease = now + 30000;
    const lock = await db.run(
      "INSERT INTO quotas (key,count,expires) VALUES ('address:upstream',1,?) ON CONFLICT(key) DO UPDATE SET expires=excluded.expires WHERE expires<=?",
      [lease, now],
    );
    if (!lock.changes)
      throw new SessionError(
        "地址查询繁忙，请稍后点击重试 / Address search busy; please retry shortly",
        429,
      );
    try {
      const c = getCity(q.cityId);
      url.search = new URLSearchParams({
        q: [q.address, q.postcode, c.english].filter(Boolean).join(", "),
        format: "jsonv2",
        addressdetails: "1",
        limit: "5",
        countrycodes: countries[c.countryId],
        "accept-language": q.locale === "zh" ? "zh,en" : "en",
        viewbox: `${c.lng - 0.7},${c.lat + 0.5},${c.lng + 0.7},${c.lat - 0.5}`,
        bounded: "1",
      }).toString();
      const response = await request(url, {
        headers: {
          "User-Agent":
            "CampusAtlas/1.0 (+https://campus-atlas-demo.pages.dev/privacy)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
        // Workers rejects redirect:"error" before any network request. Manual
        // preserves the no-redirect policy because every 3xx fails the ok check.
        redirect: "manual",
      });
      if (!response.ok)
        throw new SessionError(
          "地址服务暂时不可用，可稍后重试或在地图选点 / Address service unavailable; retry or choose a point on the map",
          503,
        );
      const payload = {
        results: addressResults(await response.json(), q.cityId),
      };
      await db.run(
        "INSERT INTO routes (key,payload,expires) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,expires=excluded.expires",
        [
          key,
          JSON.stringify(payload),
          Date.now() + (payload.results.length ? 7 * 86400000 : 300000),
        ],
      );
      return payload;
    } catch (e) {
      if (e instanceof SessionError) throw e;
      throw new SessionError(
        "未能查询地址，请重试或在地图选点 / Could not find the address; retry or choose a point on the map",
        503,
      );
    } finally {
      await db.run(
        "UPDATE quotas SET expires=? WHERE key='address:upstream' AND expires=?",
        [Date.now() + 1100, lease],
      );
    }
  };
}
