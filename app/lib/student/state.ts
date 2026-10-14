import { z } from "zod";

export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
const amount = z.number().finite().min(0).max(10000000).nullable();
export const studentPlanSchema = z.object({
  destinationId: z.string().max(100).nullable(),
  campusId: z.string().max(100).nullable(),
  showBuildings: z.boolean(),
  buildingCategory: z.enum([
    "all",
    "teaching",
    "library",
    "services",
    "dining",
  ]),
  catchmentMinutes: z
    .union([z.literal(10), z.literal(20), z.literal(30)])
    .nullable(),
  routeBuilding: z.boolean(),
  transitRequested: z.boolean().default(false),
  compareIds: z.array(z.string().max(50)).max(3),
  destinations: z
    .array(
      z.object({
        buildingId: z.string().max(100),
        visitsPerWeek: z.number().int().min(1).max(14),
      }),
    )
    .max(5),
  expenses: z.object({
    utilities: amount,
    internet: amount,
    transport: amount,
    other: amount,
    deposit: amount,
    oneOff: amount,
  }),
  housing: z.object({
    moveIn: calendarDate.nullable(),
    leaseMonths: z.number().int().min(1).max(60).nullable(),
    availableOnly: z.boolean(),
  }),
});
export type StudentPlan = z.infer<typeof studentPlanSchema>;
export function emptyStudentPlan(): StudentPlan {
  return {
    destinationId: null,
    campusId: null,
    showBuildings: false,
    buildingCategory: "all",
    catchmentMinutes: null,
    routeBuilding: false,
    transitRequested: false,
    compareIds: [],
    destinations: [],
    expenses: {
      utilities: null,
      internet: null,
      transport: null,
      other: null,
      deposit: null,
      oneOff: null,
    },
    housing: { moveIn: null, leaseMonths: null, availableOnly: false },
  };
}
export function normalizedStudentPlan(plan?: StudentPlan): StudentPlan {
  return plan ?? emptyStudentPlan();
}
