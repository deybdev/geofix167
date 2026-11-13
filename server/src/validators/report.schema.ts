import { z } from "zod";

const sqliteFlagSchema = z
  .union([z.literal(0), z.literal(1), z.boolean()])
  .transform((val): 0 | 1 => (val === 1 || val === true ? 1 : 0));

export const createReportSchema = z
  .object({
    reporter_type: z.enum(["RESIDENT", "GUEST"]).optional(),
    reporter_user_id: z.string().trim().min(1).nullable().optional(),
    guest_session_id: z.string().trim().min(1).nullable().optional(),
    guest_alias: z.string().trim().min(1).nullable().optional(),
    callback_contact: z.string().trim().min(1).nullable().optional(),
    idempotency_key: z.string().trim().min(1).max(200).optional(),
    idempotency_fingerprint: z.string().trim().nullable().optional(),
    is_emergency: sqliteFlagSchema.optional().default(0),
    incident_category: z
      .string()
      .trim()
      .min(1, "Incident category is required."),
    priority_level: z.string().trim().min(1).optional(),
    description: z.string().nullable().optional(),
    sanitized_description: z.string().nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    barangay_zone: z.string().trim().nullable().optional(),
    within_barangay_boundary: sqliteFlagSchema.nullable().optional(),
    reverse_geocoded_address: z.string().trim().nullable().optional(),
    location_source: z.string().trim().nullable().optional(),
    pin_manually_adjusted: sqliteFlagSchema.optional().default(0),
    landmark_description: z.string().trim().nullable().optional(),
    call_fallback_used: sqliteFlagSchema.optional().default(0),
    recorded_offline_during_outage: sqliteFlagSchema.optional().default(0),
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

    return {
      ...data,
      reporter_type: resolvedReporterType,
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
