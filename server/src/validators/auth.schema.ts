
import { z } from "zod";

export const loginSchema = z.object({
  mobile_number: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "Enter a valid Philippine mobile number."),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
