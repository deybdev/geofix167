
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
import { registerResident } from "../../services/authService";
import { PATHS } from "../../router/paths";
import { toast } from "../../shared/components/ui/toast";

export default function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    barangayIdentifier: "",
    dateOfBirth: "",
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

  const handleSubmit = async (event) => {
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

    try {
      const { data } = await registerResident({
        barangay_identifier: result.data.barangayIdentifier,
        first_name: result.data.firstName,
        middle_name: result.data.middleName,
        last_name: result.data.lastName,
        date_of_birth: result.data.dateOfBirth,
        mobile_number: result.data.phoneNumber,
        password: result.data.password,
      });

      if (data.status === "OTP_SENT") {
        toast.add({ title: "Registration submitted", description: "A verification code was sent to your mobile number.", type: "success" });
        navigate(PATHS.verify, {
          state: { mobileNumber: result.data.phoneNumber, purpose: "registration" },
        });
        return;
      }

      setSubmitted(true);
      setError(data.message ?? "Your registration is pending Front Desk review.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.error
          ?? "We could not submit your registration. Check your connection and try again.",
      );
    }
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
          Your registration is pending Front Desk review. Use Need Help if you need an update.
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

        <FormField
          label="Barangay ID Number"
          required
          error={errors.barangayIdentifier}
        >
          <Input
            type="text"
            placeholder="Enter the number below your ID barcode"
            value={form.barangayIdentifier}
            onChange={updateField("barangayIdentifier")}
            aria-invalid={!!errors.barangayIdentifier}
            className="h-11 rounded-lg border-slate-300 bg-white text-sm"
          />
        </FormField>

        <FormField label="Date of Birth" required error={errors.dateOfBirth}>
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={updateField("dateOfBirth")}
            aria-invalid={!!errors.dateOfBirth}
            className="h-11 rounded-lg border-slate-300 bg-white text-sm"
          />
        </FormField>

        <PhoneNumberField
          value={form.phoneNumber}
          onChange={updateField("phoneNumber")}
          error={errors.phoneNumber}
          required
        />

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

      <a
        href="mailto:frontdesk@barangay167.example?subject=GeoFix%20resident%20registration%20help"
        className="mt-3 block text-center text-xs font-semibold text-primary hover:underline"
      >
        Need Help?
      </a>
    </form>
  );
}
