import { z } from "zod";
import { cityIds, getCity, type Listing } from "../rental-data";

const text = (max: number) => z.string().trim().max(max);
export const mediaId = z.string().uuid();
export const applicationSchema = z
  .object({
    name: text(100).min(2),
    kind: z.enum(["landlord", "company"]),
    contact: text(200).min(5),
    cities: z.array(z.enum(cityIds)).min(1).max(11),
    evidence: text(2000).min(10),
  })
  .strict();
export const roomSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{8}$/),
    name: text(80),
    roomType: z.enum(["独立 Studio", "独卫单间", "合租单间"]),
    size: z.number().min(1).max(1000),
    price: z.number().min(1).max(1000000),
    period: z.enum(["week", "month"]),
    deposit: z.number().min(0).max(1000000),
    fees: z.number().min(0).max(1000000),
    bills: z.boolean(),
    billDetails: text(1000),
    availableFrom: text(10),
    availableUntil: text(10),
    minMonths: z.number().int().min(1).max(60),
    maxMonths: z.number().int().min(1).max(60),
    quantity: z.number().int().min(0).max(10000),
    photos: z.array(mediaId).max(12),
  })
  .strict();
export const propertySchema = z
  .object({
    name: text(120),
    cityId: z.enum(cityIds),
    address: text(300),
    area: text(100),
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-85).max(85),
    entranceConfirmed: z.boolean(),
    description: text(4000),
    descriptionEn: text(4000),
    facilities: z
      .array(
        z.enum([
          "furnished",
          "laundry",
          "lift",
          "accessible",
          "private-kitchen",
          "secure-entry",
        ]),
      )
      .max(6),
    studentOnly: z.boolean(),
    guarantor: text(1000),
    paymentTerms: text(1000),
    cancellation: text(2000),
    photos: z.array(mediaId).max(12),
    floorPlans: z.array(mediaId).max(12).default([]),
    rooms: z.array(roomSchema).min(1).max(8),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.rooms.map((r) => r.id)).size !== v.rooms.length)
      c.addIssue({ code: "custom", message: "Duplicate room IDs" });
  });
export type Property = z.infer<typeof propertySchema>;
export type Application = z.infer<typeof applicationSchema>;
export type ReviewStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "offline";
export type Merchant = {
  id: string;
  owner: string;
  status: ReviewStatus;
  profile: Application;
  reason: string;
  version: number;
  updated: number;
};
export type PropertyRecord = {
  id: string;
  merchant: string;
  draft: Property;
  published: Property | null;
  status: ReviewStatus;
  reason: string;
  version: number;
  updated: number;
  publishedAt: number | null;
};
export type Conversation = {
  id: string;
  student: string;
  merchant: string;
  listing: string;
  name: string;
  kind: "enquiry" | "viewing";
  status: "open" | "accepted" | "declined" | "closed";
  appointment: string;
  timezone: string;
  mode: "online" | "in-person";
  messages: { by: "student" | "merchant"; text: string; at: number }[];
  version: number;
  updated: number;
};
export function publicationIssues(p: Property) {
  const errors: string[] = [];
  if (
    p.name.length < 2 ||
    p.address.length < 5 ||
    p.area.length < 2 ||
    p.description.length < 20
  )
    errors.push(
      "请填写名称、完整地址、区域及至少 20 字的介绍 / Complete name, address, area and description (20+ characters).",
    );
  if (!p.entranceConfirmed)
    errors.push("请确认地图位置是公寓入口 / Confirm the property entrance.");
  const c = getCity(p.cityId);
  if (Math.abs(c.lng - p.lng) > 1.5 || Math.abs(c.lat - p.lat) > 1)
    errors.push(
      "位置不在所选城市附近 / Location is outside the selected city.",
    );
  if (!p.photos.length)
    errors.push("至少上传一张公寓照片 / Upload a property photo.");
  if (!p.guarantor || !p.paymentTerms || !p.cancellation)
    errors.push(
      "请补充担保、付款和取消条款 / Complete guarantor, payment and cancellation terms.",
    );
  for (const r of p.rooms) {
    const date = (s: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      Number.isFinite(Date.parse(s + "T00:00:00Z")) &&
      new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
    if (
      !r.name ||
      !date(r.availableFrom) ||
      !date(r.availableUntil) ||
      r.availableUntil < r.availableFrom ||
      r.minMonths > r.maxMonths ||
      !r.billDetails
    )
      errors.push(
        "请补全房型名称、有效入住日期、租期和账单说明 / Complete room names, valid dates, lease and bill details.",
      );
  }
  return [...new Set(errors)];
}
export function publicListings(
  record: PropertyRecord,
  merchantName: string,
): Listing[] {
  const p = record.published;
  if (!p) return [];
  const city = getCity(p.cityId),
    period = city.period === "周" ? "week" : "month";
  return p.rooms.map((r) => ({
    id: `${record.id}_${r.id}`,
    cityId: p.cityId,
    name: `${p.name} · ${r.name}`,
    area: p.area,
    price:
      Math.round(
        r.price *
          (r.period === period ? 1 : r.period === "month" ? 12 / 52 : 52 / 12) *
          100,
      ) / 100,
    roomType: r.roomType,
    size: r.size,
    bills: r.bills,
    lng: p.lng,
    lat: p.lat,
    photos: (r.photos.length ? r.photos : p.photos).map(
      (id) => `/api/merchant/media/${id}`,
    ),
    merchant: {
      propertyId: record.id,
      name: merchantName,
      address: p.address,
      floorPlans: (p.floorPlans ?? []).map((id) => `/api/merchant/media/${id}`),
      description: p.description,
      descriptionEn: p.descriptionEn,
      facilities: p.facilities,
      studentOnly: p.studentOnly,
      guarantor: p.guarantor,
      paymentTerms: p.paymentTerms,
      cancellation: p.cancellation,
      deposit: r.deposit,
      fees: r.fees,
      billDetails: r.billDetails,
      price: r.price,
      period: r.period,
      availableFrom: r.availableFrom,
      availableUntil: r.availableUntil,
      minMonths: r.minMonths,
      maxMonths: r.maxMonths,
      quantity: r.quantity,
      updatedAt: new Date(record.publishedAt!).toISOString(),
    },
  }));
}
export function newProperty(): Property {
  const c = getCity("london");
  return {
    name: "",
    cityId: c.id,
    address: "",
    area: "",
    lng: c.lng,
    lat: c.lat,
    entranceConfirmed: false,
    description: "",
    descriptionEn: "",
    facilities: [],
    studentOnly: true,
    guarantor: "",
    paymentTerms: "",
    cancellation: "",
    photos: [],
    floorPlans: [],
    rooms: [
      {
        id: crypto.randomUUID().slice(0, 8),
        name: "",
        roomType: "独立 Studio",
        size: 20,
        price: 300,
        period: "week",
        deposit: 0,
        fees: 0,
        bills: true,
        billDetails: "",
        availableFrom: "",
        availableUntil: "",
        minMonths: 3,
        maxMonths: 12,
        quantity: 1,
        photos: [],
      },
    ],
  };
}
