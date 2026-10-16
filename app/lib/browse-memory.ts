import { z } from "zod";
import { rentalStateSchema } from "./agent/contract";
import { listings as demoListings, type Listing, type CityId } from "./rental-data";
import { mapSearchAreaSchema } from "./map-search-area";

export const cameraViewSchema = z.object({
  longitude: z.number().finite().min(-180).max(180), latitude: z.number().finite().min(-90).max(90),
  height: z.number().finite().min(0).max(100000000),
  heading: z.number().finite(), pitch: z.number().finite(), roll: z.number().finite(),
});
export type CameraView = z.infer<typeof cameraViewSchema>;
export type MapViewHandle = {capture: () => CameraView | null; focusHome?: () => void};
const snapshotSchema = z.object({
  version: z.literal(1), token: z.string().uuid(), url: z.string().max(3000),
  state: rentalStateSchema, onlySaved: z.boolean(), sort: z.enum(["recommended", "price"]),
  mobileTab: z.enum(["list", "map", "chat"]), expandedIds: z.array(z.string().max(50)).max(100),
  scroll: z.object({anchorId: z.string().max(50).nullable(), offset: z.number().finite().min(-10000).max(10000), top: z.number().finite().min(0).max(1000000)}),
  camera: cameraViewSchema.nullable(),
  area: mapSearchAreaSchema.nullable().optional(),
});
export type BrowseSnapshot = z.infer<typeof snapshotSchema>;
export const browseStorageKey = (city: CityId) => `campus-atlas-browse:${city}`;
export function readBrowseSnapshot(raw: string | null, token: unknown, city: CityId, listings:Listing[]=demoListings): BrowseSnapshot | null {
  if (typeof token !== "string" || !raw || raw.length > 100000) return null;
  try {
    const result = snapshotSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    const value = result.data;
    if (value.token !== token || value.state.cityId !== city) return null;
    if (!listings.some(l => l.id === value.state.listingId && l.cityId === city)) return null;
    // Return links must stay in this explorer, including on deployments with a custom domain.
    const url = new URL(value.url, "https://atlas.invalid");
    if (url.origin !== "https://atlas.invalid" || !["/", "/design-lab"].includes(url.pathname) || url.searchParams.get("city") !== city) return null;
    if (value.expandedIds.some(id => !listings.some(l => l.id === id && l.cityId === city))) return null;
    return {...value, url: url.pathname + url.search};
  } catch { return null; }
}
export function browseReturnUrl(snapshot: BrowseSnapshot) {
  const url = new URL(snapshot.url, "https://atlas.invalid");
  url.searchParams.set("restore", snapshot.token);
  return url.pathname + url.search;
}
