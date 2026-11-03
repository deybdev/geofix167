
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";

import {
  FormField,
  NameField,
  PasswordField,
  PhoneNumberField,
  FieldError,
} from "../../shared/components/FormField";

import { registerSchema } from "../../schemas/register.schema";

export default function Register() {
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    houseStreet: "",
    barangayCity: "Brgy 167, Caloocan City",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });

  const updateField = (field) => (event) => {
    const value =
      field === "acceptedTerms" ? event.target.checked : event.target.value;

    setForm((current) => ({ ...current, [field]: value }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === "password" ? { confirmPassword: undefined } : {}),
    }));

    setError("");
    setSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setError("");
    setSubmitted(false);
    setErrors({});

    const result = registerSchema.safeParse(form);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;

      setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors).map(([field, messages]) => [
            field,
            messages?.[0],
          ]),
        ),
      );

      return;
    }

    // Registration API integration will go here.
    // Do not send confirmPassword to the backend.
    setSubmitted(true);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="mt-7 text-xl font-bold leading-7 text-slate-800">
        Create Account
      </h2>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm leading-5 text-destructive"
        >
          {error}
        </p>
      )}

      {submitted && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-primary/10 px-3 py-2.5 text-sm leading-5 text-primary"
        >
          Registration is not available yet. Please contact an administrator.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <NameField
            label="Last Name"
            placeholder="Last name"
            value={form.lastName}
            onChange={updateField("lastName")}
            error={errors.lastName}
            required
          />

          <NameField
            label="First Name"
            placeholder="First name"
            value={form.firstName}
            onChange={updateField("firstName")}
            error={errors.firstName}
            required
          />

          <NameField
            label="Middle Name"
            placeholder="Middle name"
            value={form.middleName}
            onChange={updateField("middleName")}
            error={errors.middleName}
            required={false}
            className="col-span-2"
          />
        </div>

        <PhoneNumberField
          value={form.phoneNumber}
          onChange={updateField("phoneNumber")}
          error={errors.phoneNumber}
          required
        />

        <div className="flex flex-col gap-3">
          <FormField
            label="House Number / Street"
            required
            error={errors.houseStreet}
          >
            <Input
              type="text"
              placeholder="Enter house number and street"
              value={form.houseStreet}
              onChange={updateField("houseStreet")}
              aria-invalid={!!errors.houseStreet}
              className={`h-11 rounded-lg bg-white text-sm font-normal placeholder:font-normal placeholder:text-slate-400 ${
                errors.houseStreet
                  ? "border-destructive focus-visible:ring-destructive"
                  : "border-slate-300"
              }`}
            />
          </FormField>

          <FormField label="Barangay / City" required>
            <Input
              type="text"
              value={form.barangayCity}
              disabled
              className="h-11 rounded-lg border-slate-300 bg-slate-200 text-sm font-normal text-slate-500 disabled:cursor-not-allowed disabled:opacity-100"
            />
          </FormField>
        </div>

        <PasswordField
          label="Password"
          placeholder="Create a password"
          value={form.password}
          onChange={updateField("password")}
          error={errors.password}
          required
        />

        <PasswordField
          label="Confirm Password"
          placeholder="Re-enter your password"
          value={form.confirmPassword}
          onChange={updateField("confirmPassword")}
          error={errors.confirmPassword}
          required
        />
      </div>

      <p className="mt-3 text-[11px] leading-4 text-slate-500">
        Choose a password you do not use elsewhere.
      </p>

      <div className="mt-2">
        <label className="flex items-start gap-2 text-[11px] leading-5 text-slate-500">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={updateField("acceptedTerms")}
            aria-invalid={!!errors.acceptedTerms}
            className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-primary"
          />

          <span>
            I agree to the{" "}
            <Link to="/terms-of-service" className="text-primary underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy-policy" className="text-primary underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <FieldError message={errors.acceptedTerms} />
      </div>

      <Button
        type="submit"
        className="mt-3 h-11 w-full rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary/90"
      >
        Create Account
      </Button>

      <p className="mt-4 text-center text-xs leading-5 text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Login
        </Link>
      </p>
    </form>
  );
}
