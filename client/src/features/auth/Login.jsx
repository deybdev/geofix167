import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";

import { useAuth } from "../../shared/hooks/useAuth";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { toast } from "../../shared/components/ui/toast";

import { FormField, PhoneNumberField } from "../../shared/components/FormField";
import { loginSchema } from "../../schemas/login.schema";
import { PATHS } from "../../router/paths";

const ROLE_PATHS = {
  tanod: "/responder",
  responder: PATHS.responder,
  resident: "/resident",
  bdrrmo: "/unauthorized",
  police: "/unauthorized",
  fire: "/unauthorized",
};

export default function Login() {
  const { signIn, commitSignIn, signOut } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: {
      phoneNumber: "",
      password: "",
    },
  });

  const handleLogin = async (values) => {
    setServerError("");

    try {
      const user = await signIn(values.phoneNumber, values.password);

      // The admin portal lives on its own login; reject admin accounts here
      if (user.role === "admin") {
        await signOut();
        const message = "Invalid mobile number or password.";
        setServerError(message);
        return;
      }

      commitSignIn(user);

      toast.add({
        title: "Login successful",
        description: "Welcome back!",
        type: "success",
      });

      // Straight into the app — location is pinned inside the report flows
      navigate(ROLE_PATHS[user.role] ?? PATHS.home, { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error ?? "Login failed. Please try again.";
      setServerError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleLogin)} noValidate>
      <div className="mt-7 flex flex-col items-center gap-1.5">
        <h2 className="text-[22px] font-bold leading-7 text-primary">
          Welcome Back
        </h2>

        <p className="max-w-[320px] text-center text-[13px] leading-5 text-slate-500">
          Log in to report incidents, track submitted reports, and access
          community updates.
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-5">
        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm leading-5 text-destructive"
          >
            {serverError}
          </p>
        )}
        <Controller
          control={control}
          name="phoneNumber"
          render={({ field }) => (
            <PhoneNumberField
              value={field.value}
              onChange={field.onChange}
              inputProps={{ onBlur: field.onBlur }}
              error={errors.phoneNumber?.message}
              errorId="phone-error"
              gapClassName="gap-2"
            />
          )}
        />

        <FormField
          label="Password"
          error={errors.password?.message}
          errorId="password-error"
          gapClassName="gap-2"
        >
          <span className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
              className="font-normal placeholder:font-normal placeholder:text-slate-400"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:bg-transparent hover:text-slate-600 active:-translate-y-1/2!"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </Button>
          </span>
        </FormField>
      </div>

      <Link
        to="/forgot-password"
        className="mt-3 self-end text-xs font-semibold text-primary hover:underline"
      >
        Forgot Password?
      </Link>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 h-12 w-full rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:ring-primary/20 sm:h-11"
      >
        {isSubmitting ? "Logging in…" : "Log In"}
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={() => navigate("/guest")}
        className="mt-2 h-12 w-full rounded-lg border-slate-200 text-sm font-semibold text-primary transition-colors hover:bg-slate-50 focus-visible:ring-primary/20 sm:h-11"
      >
        Continue as Guest
      </Button>

      <p className="mt-2 text-center text-[13px] leading-5 text-slate-500">
        Don&apos;t have an account?{" "}
        <Link
          to="/register"
          className="font-semibold text-primary hover:underline"
        >
          Create Account
        </Link>
      </p>
    </form>
  );
}
