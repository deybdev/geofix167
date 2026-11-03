
import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Smartphone,
  UserRound,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

// Required indicator
export function RequiredMark() {
  return <span className="text-red-500">*</span>;
}

// Validation error
export function FieldError({ id, message }) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="text-xs font-normal leading-4 text-destructive"
    >
      {message}
    </p>
  );
}

// Reusable field wrapper
export function FormField({
  label,
  required = false,
  error,
  errorId,
  className = "",
  gapClassName = "gap-1.5",
  children,
}) {
  return (
    <label
      className={`flex flex-col ${gapClassName} text-sm font-semibold leading-5 text-slate-700 ${className}`}
    >
      <span>
        {label} {required && <RequiredMark />}
      </span>

      {children}

      <FieldError id={errorId} message={error} />
    </label>
  );
}

// Name input
export function NameField({
  label,
  placeholder,
  value,
  onChange,
  error,
  required = false,
  className = "",
}) {
  return (
    <FormField
      label={label}
      required={required}
      error={error}
      className={className}
    >
      <span className="relative">
        <UserRound
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          aria-invalid={!!error}
          className={`h-11 rounded-lg bg-white pl-9 text-sm font-normal placeholder:font-normal placeholder:text-slate-400 ${
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-slate-300"
          }`}
        />
      </span>
    </FormField>
  );
}

// Password input

export function PasswordField({
  label = "Password",
  placeholder = "Enter your password",
  value,
  onChange,
  inputProps = {},
  error,
  errorId,
  autoComplete,
  showLockIcon = true,
  required = false,
  inputClassName = "",
  gapClassName = "gap-1.5",
}) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      label={label}
      required={required}
      error={error}
      errorId={errorId}
      gapClassName={gapClassName}
    >
      <span className="relative">
        {showLockIcon && (
          <LockKeyhole
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        )}

        <Input
          {...inputProps}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`h-11 rounded-lg bg-white text-sm font-normal placeholder:font-normal placeholder:text-slate-400 ${
            showLockIcon ? "px-9" : "px-3"
          } pr-11 ${inputClassName}`}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:bg-transparent hover:text-slate-600"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </Button>
      </span>
    </FormField>
  );
}

// Phone helpers: normalize +63/63 prefix to 09 and pad spaces as 4-3-4 (e.g. 0912 345 6789)
function formatPhoneDisplay(value) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("63")) {
    digits = `0${digits.slice(2)}`;
  }

  digits = digits.slice(0, 11);

  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)];
  return parts.filter(Boolean).join(" ");
}

function toPhoneDigits(value) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("63")) {
    digits = `0${digits.slice(2)}`;
  }

  return digits.slice(0, 11);
}

// Phone number input
export function PhoneNumberField({
  value,
  onChange,
  inputProps = {},
  error,
  errorId,
  placeholder = "09XX XXX XXXX",
  showIcon = true,
  required = false,
  inputClassName = "",
  gapClassName = "gap-1.5",
}) {
  const handleChange = (event) => {
    if (!onChange) return;

    onChange({
      ...event,
      target: { ...event.target, value: toPhoneDigits(event.target.value) },
    });
  };

  return (
    <FormField
      label="Mobile Number"
      required={required}
      error={error}
      errorId={errorId}
      gapClassName={gapClassName}
    >
      <span className="relative">
        {showIcon && (
          <Smartphone
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        )}

        <Input
          {...inputProps}
          type="tel"
          inputMode="tel"
          placeholder={placeholder}
          value={formatPhoneDisplay(value)}
          onChange={handleChange}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? "phone-error" : undefined}
          className={`h-11 rounded-lg bg-white text-sm font-normal placeholder:font-normal placeholder:text-slate-400 ${
            showIcon ? "pl-9" : ""
          } ${
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-slate-300"
          } ${inputClassName}`}
        />
      </span>
    </FormField>
  );
}
