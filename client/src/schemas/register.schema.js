
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

    houseStreet: z
      .string()
      .trim()
      .min(5, "House number and street are required.")
      .max(150, "Address must not exceed 150 characters."),

    barangayCity: z.literal("Brgy 167, Caloocan City"),

    phoneNumber: z
      .string()
      .trim()
      .min(1, "Mobile number is required.")
      .regex(
        /^(09\d{9}|\+639\d{9})$/,
        "Enter a valid Philippine mobile number."
      ),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password must not exceed 128 characters.")
      .refine(
        (value) => value.trim().length > 0,
        "Password cannot contain only spaces."
      )
      .regex(/[A-Z]/, "Include at least one uppercase letter.")
      .regex(/[a-z]/, "Include at least one lowercase letter.")
      .regex(/[0-9]/, "Include at least one number.")
      .regex(
        /[^A-Za-z0-9\s]/,
        "Include at least one special character."
      ),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),

    acceptedTerms: z.literal(true, {
      error: "Please agree to the Terms of Service and Privacy Policy.",
    }),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    }
  );
