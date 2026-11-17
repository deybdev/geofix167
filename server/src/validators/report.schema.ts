import { z } from "zod";
import reportCatalog from "../shared/reportCatalog.json";

const sqliteFlagSchema = z
  .union([z.literal(0), z.literal(1), z.boolean()])
  .transform((val): 0 | 1 => (val === 1 || val === true ? 1 : 0));

export const createReportSchema = z
  .object({
    reporter_type: z.enum(["RESIDENT", "GUEST"]).optional(),
    reporter_user_id: z.string().trim().min(1).nullable().optional(),
    guest_session_id: z.string().trim().min(1).nullable().optional(),
    guest_alias: z.string().trim().min(1).max(100).nullable().optional(),
    callback_contact: z.string().trim().min(1).max(40).nullable().optional(),
    idempotency_key: z.string().trim().min(1).max(200).optional(),
    idempotency_fingerprint: z.string().trim().nullable().optional(),
    title: z.string().trim().min(1).max(120).optional(),
    classification: z.enum(["sudden", "maintenance"]).optional(),
    is_emergency: sqliteFlagSchema.optional().default(0),
    incident_category: z
      .string()
      .trim()
      .min(1, "Incident category is required.")
      .max(100),
    priority_level: z.string().trim().min(1).max(20).optional(),
    description: z.string().max(10000).nullable().optional(),
    sanitized_description: z.string().max(10000).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    accuracy_meters: z.number().min(0).max(100000).nullable().optional(),
    barangay_zone: z.string().trim().max(100).nullable().optional(),
    within_barangay_boundary: sqliteFlagSchema.nullable().optional(),
    reverse_geocoded_address: z.string().trim().max(500).nullable().optional(),
    location_source: z.string().trim().max(50).nullable().optional(),
    pin_manually_adjusted: sqliteFlagSchema.optional().default(0),
    landmark_description: z.string().trim().max(500).nullable().optional(),
    call_fallback_used: sqliteFlagSchema.optional().default(0),
    recorded_offline_during_outage: sqliteFlagSchema.optional().default(0),
  })
  .superRefine((data, ctx) => {
    const isGuest = (data.reporter_type ?? (data.reporter_user_id ? "RESIDENT" : "GUEST")) === "GUEST";
    const hasLatitude = typeof data.latitude === "number";
    const hasLongitude = typeof data.longitude === "number";

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({ code: "custom", path: [hasLatitude ? "longitude" : "latitude"], message: "Provide both latitude and longitude for a location pin." });
    }
    if (data.accuracy_meters != null && !(hasLatitude && hasLongitude)) {
      ctx.addIssue({ code: "custom", path: ["accuracy_meters"], message: "Location accuracy requires a coordinate pin." });
    }
    if (!isGuest) return;

    if (!data.title?.trim()) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "Incident title is required." });
    }
    if (!data.guest_alias?.trim()) {
      ctx.addIssue({ code: "custom", path: ["guest_alias"], message: "Reporter name is required." });
    }
    const highUrgency = data.classification === "sudden"
      || (data.classification === "maintenance" && reportCatalog.guestUrgency.maintenanceHighCategories.includes(data.incident_category));
    if (!highUrgency && !data.description?.trim()) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Incident description is required." });
    }
    if (!data.classification) {
      ctx.addIssue({ code: "custom", path: ["classification"], message: "Incident classification is required." });
    }
    const allCategories = Object.values(reportCatalog.categories).flat();
    if (!data.incident_category || !allCategories.includes(data.incident_category)) {
      ctx.addIssue({ code: "custom", path: ["incident_category"], message: "Choose a valid incident category." });
    } else if (data.classification && !reportCatalog.categories[data.classification].includes(data.incident_category)) {
      ctx.addIssue({ code: "custom", path: ["incident_category"], message: "Choose a category that matches the incident classification." });
    }
    if (!hasLatitude && !hasLongitude && !data.reverse_geocoded_address?.trim() && !data.landmark_description?.trim()) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "Pin the incident location or provide a location note." });
    }
  })
  .transform((data) => {
    const resolvedReporterType: "RESIDENT" | "GUEST" =
      data.reporter_type ?? (data.reporter_user_id ? "RESIDENT" : "GUEST");

    const resolvedPriority =
      data.priority_level ?? (data.is_emergency === 1 ? "CRITICAL" : "MEDIUM");

    const rawDescription =
      data.description !== undefined
        ? data.description
        : (data.sanitized_description ?? null);

    const emergency = data.classification
      ? (reportCatalog.classifications.find((item) => item.value === data.classification)?.isEmergency ? 1 : 0)
      : data.is_emergency;

    return {
      ...data,
      reporter_type: resolvedReporterType,
      is_emergency: emergency as 0 | 1,
      priority_level: resolvedPriority,
      description: rawDescription,
    };
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const listReportsQuerySchema = z.object({
  status_id: z
    .string()
    .trim()
    .regex(/^\d+$/, "status_id must be a positive integer.")
    .transform((val) => Number(val))
    .optional(),
  is_emergency: z
    .enum(["0", "1", "true", "false"])
    .transform((val): 0 | 1 => (val === "1" || val === "true" ? 1 : 0))
    .optional(),
  incident_category: z.string().trim().min(1).optional(),
});

export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;


export const updateReportStatusSchema = z.object({
  status_id: z.number().int().positive(),
  note: z.string().trim().max(4000).optional(),
}).strict();
export const updateReportDetailsSchema = z.object({
  category: z.string().trim().min(1).max(200).optional(),
  priority_code: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  location_description: z.string().trim().max(4000).optional(),
  description_sanitized: z.string().trim().max(10000).optional(),
}).strict().refine(value => Object.values(value).some(v => v !== undefined), {
  message: "Provide at least one report detail to update.",
});
export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>;
export type UpdateReportDetailsInput = z.infer<typeof updateReportDetailsSchema>;
