import { cityIds } from "../rental-data";
import { z } from "zod";
import type { UIMessage, InferUITools } from "ai";
import type { createRentalTools } from "./tools";
import { amenityCategories } from "../amenities";
import { emptyFilters } from "../assistant";
import {studentPlanSchema} from "../student/state";

export const cityIdSchema = z.enum(cityIds);
export const filtersSchema = z.object({
  roomType: z.enum(["all", "独立 Studio", "独卫单间", "合租单间"]),
  budget: z.number().positive().max(10000000).nullable(), bills: z.boolean(),
  walkMinutes: z.number().int().min(1).max(120).nullable(), safety: z.boolean(), shopping: z.boolean(),
});
export const mapSelectionSchema = z.object({
  categories: z.array(z.enum(amenityCategories)).max(21), radiusMeters: z.number().int().min(0).max(3000),
  cuisine: z.string().max(80), placeIds: z.array(z.string().regex(/^(node|way|relation)\/\d+$/)).max(100).nullable(),
  selectedPlaceId: z.string().nullable(), routePlaceId: z.string().nullable(), campusRoute: z.boolean(),
});
export const rentalStateSchema = z.object({cityId: cityIdSchema, listingId: z.string().max(50), filters: filtersSchema, map: mapSelectionSchema,student:studentPlanSchema.optional()});
export type MapSelection = z.infer<typeof mapSelectionSchema>;
export type RentalState = z.infer<typeof rentalStateSchema>;
export function emptyMapSelection(): MapSelection {
  return {categories: [], radiusMeters: 0, cuisine: "", placeIds: null, selectedPlaceId: null, routePlaceId: null, campusRoute: false};
}
export function initialRentalState(cityId: RentalState["cityId"]): RentalState {
  return {cityId, listingId: `${cityId}-1`, filters: {...emptyFilters}, map: emptyMapSelection()};
}
export type ReplyStatus = "timeout" | "error" | "stopped";
export type MessageContext = {cityId: RentalState["cityId"]; listingId: string};
export type RentalMessage = UIMessage<{replyStatus?: ReplyStatus; context?: MessageContext}, {"rental-state": {requestId: string; version: number; phase: "start" | "update"; state: RentalState}}, InferUITools<ReturnType<typeof createRentalTools>["tools"]>>;
export type RentalSession = {id: string; version: number; state: RentalState; messages: RentalMessage[]};
export type AgentStatus = {configured: boolean; missing: string[]; storage: string};
export const agentRequestSchema = z.object({
  sessionId: z.string().uuid(), version: z.number().int().nonnegative(), requestId: z.string().uuid(), state: rentalStateSchema,
  message: z.object({id: z.string().min(1).max(100), role: z.literal("user"), parts: z.array(z.object({type: z.literal("text"), text: z.string().min(1).max(2000)})).min(1).max(1)}),
  retry: z.boolean().optional(),
  locale: z.enum(["zh", "en"]).default("zh"),
});
