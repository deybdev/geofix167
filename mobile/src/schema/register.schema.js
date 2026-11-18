
import { z } from "zod";

const nameRegex = /^[\p{L}][\p{L}\p{M}\s.'’-]*$/u;

export const registerSchema = z
  .object({
    lastName: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters.")
      .max(50, "Last name must not exceed 50 characters.")
      .regex(nameRegex, "Enter a valid last name."),

    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters.")
      .max(50, "First name must not exceed 50 characters.")
      .regex(nameRegex, "Enter a valid first name."),

    middleName: z
      .string()
      .trim()
      .max(50, "Middle name must not exceed 50 characters.")
      .refine(
        (value) => value === "" || nameRegex.test(value),
        "Enter a valid middle name."
      ),

    barangayIdentifier: z
      .string()
      .trim()
      .min(4, "Enter the Barangay ID number below the barcode.")
      .max(80, "Barangay ID number is too long."),

    dateOfBirth: z.string().min(1, "Date of birth is required."),

    email: z.string().trim().email("Enter a valid Gmail/email address."),

    phoneNumber: z
      .string()
      .trim()
      .min(1, "Mobile number is required.")
      .regex(
        /^(09\d{9}|\+639\d{9})$/,
        "Enter a valid Philippine mobile number."
      ),

    google: z.boolean().default(false),
    password: z.string(),
    confirmPassword: z.string(),

    acceptedTerms: z.literal(true, {
      error: "Please agree to the Terms of Service and Privacy Policy.",
    }),
  })
  .superRefine((data, ctx) => {
    if (data.google) return;
    if (data.password.length < 8 || new TextEncoder().encode(data.password).length > 72 || !/[A-Z]/.test(data.password) || !/[a-z]/.test(data.password) || !/[0-9]/.test(data.password) || !/[^A-Za-z0-9\s]/.test(data.password)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Use 8–72 bytes with uppercase, lowercase, number, and special character." });
    }
    if (data.password !== data.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  });
