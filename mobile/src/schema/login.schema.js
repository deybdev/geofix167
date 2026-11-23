import { z } from "zod";

export const loginSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .regex(/^\d+$/, "Phone number must contain digits only.")
    .length(11, "Phone number must be 11 digits.")
    .regex(/^09/, "Phone number must start with 09."),

  password: z
    .string()
    .min(1, "Password is required."),
});