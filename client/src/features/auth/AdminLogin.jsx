import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../../shared/hooks/useAuth";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { toast } from "../../shared/components/ui/toast";
import { PhoneNumberField } from "../../shared/components/FormField";
import GeoFixBranding from "../../shared/components/Logo";
import loginImage from "../../assets/images/login-img.png";

export default function AdminLogin() {
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await signIn(mobileNumber, password);
      if (user.role !== "admin") {
        await signOut();
        const message = "Only authorized administrators can access this login.";
        setError(message);
        return;
      }
      toast.add({
        title: "Login successful",
        description: "Welcome to the admin portal.",
        type: "success",
      });
      navigate("/admin", { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.error ?? "Login failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden min-h-100 overflow-hidden bg-[#247447] lg:block">
        <img
          src={loginImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#247447]/20" />
        <div className="relative z-10 flex h-full flex-col items-center px-8 pt-14 text-center text-white">
          <GeoFixBranding inverse />
          <p className="mt-2 text-lg">Barangay 167, Caloocan City</p>
          <div className="my-5 h-0.75 w-9 rounded-full bg-white/70" />
          <p className="text-md leading-7">
            Geotagged reporting and emergency
            <br />
            response for our barangay.
          </p>
          <p className="absolute bottom-8 text-xs tracking-wide text-white/90">
            Authorized personnel only. Unauthorized access is prohibited.
          </p>
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-16 sm:px-12">
        <Link
          to="/"
          className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={17} /> Back
        </Link>
        <form onSubmit={handleSubmit} className="flex w-full max-w-95 flex-col gap-4">
          <div className="mb-1">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f4ed] text-primary">
              <ShieldCheck size={22} />
            </div>
            <h2 className="text-[25px] font-bold tracking-tight text-gray-950">Admin Sign In</h2>
            <p className="my-1 max-w-md text-[14px] leading-5 text-gray-500">
              Enter your administrator credentials to access the dashboard.
            </p>
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
          )}
          <PhoneNumberField
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            inputProps={{ required: true, autoComplete: "tel" }}
            gapClassName="gap-2"
          />
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-900">
            Password
            <span className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:bg-transparent hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </span>
          </label>
          <Button
            type="submit"
            size="default"
            disabled={loading}
            className="mt-1 h-10 w-full rounded-lg bg-[#30945e] px-4 font-semibold text-white transition-colors hover:bg-[#287f50]"
          >
            {loading ? "Signing in…" : "Sign In as Administrator"}
          </Button>
          <p className="px-2 text-center text-[13px]  text-gray-500">
            This portal is restricted to authorized administrators of Barangay 167.
          </p>
        </form>
      </section>
    </main>
  );
}
