import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import { PasswordField } from "../../shared/components/FormField";
import { PATHS } from "../../router/paths";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: "" }));
      setSubmitted(false);
    };
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (form.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mt-14 flex flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary text-primary">
          <Check size={25} strokeWidth={2.5} />
        </div>

        <h2 className="mt-5 text-[17px] font-bold leading-6 text-slate-800">
          Password Updated
        </h2>
        <p className="mt-2 max-w-[270px] text-[11px] leading-4 text-slate-500">
          Your password has been updated. You can now log in using your mobile
          number and new password.
        </p>

        <Button
          type="button"
          onClick={() => navigate(PATHS.login)}
          className="mt-5 h-10 w-full rounded-lg bg-primary text-[11px] font-semibold text-white hover:bg-primary/90"
        >
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mt-7 flex flex-col items-center gap-1">
        <h2 className="text-[22px] font-bold leading-7 text-primary">
          Reset Password
        </h2>
        <p className="text-center text-[13px] leading-5 text-slate-500">
          Choose a new password for your account.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        <PasswordField
          label="New Password"
          placeholder="Enter a new password"
          value={form.password}
          onChange={updateField("password")}
          error={errors.password}
          errorId="password-error"
          autoComplete="new-password"
          gapClassName="gap-1"
        />
        <p className="-mt-2 text-[10px] text-slate-500">
          Use a password you do not use elsewhere.
        </p>

        <PasswordField
          label="Confirm Password"
          placeholder="Re-enter your new password"
          value={form.confirmPassword}
          onChange={updateField("confirmPassword")}
          error={errors.confirmPassword}
          errorId="confirm-password-error"
          autoComplete="new-password"
          gapClassName="gap-1"
        />
        <p className="-mt-2 text-[10px] text-slate-500">
          Both passwords must match to continue.
        </p>

        <Button
          type="submit"
          disabled={!form.password || !form.confirmPassword}
          className="mt-1 h-11 w-full rounded-lg bg-primary text-xs font-semibold text-white hover:bg-primary/10 disabled:bg-slate-300 disabled:opacity-100"
        >
          Reset Password
        </Button>
      </div>
    </form>
  );
}
