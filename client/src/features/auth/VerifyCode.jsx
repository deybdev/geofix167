import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import VerificationCodeField from "../../shared/components/VerificationCodeField";
import { Button } from "../../shared/components/ui/button";
import { verifyRegistrationOtp } from "../../services/authService";
import { toast } from "../../shared/components/ui/toast";
import { PATHS } from "../../router/paths";

const VerifyCode = () => {
  const [code, setCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const mobileNumber = location.state?.mobileNumber ?? "your mobile number";

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (code.length !== 6) return;
    if (mobileNumber === "your mobile number") {
      setError("Start registration again before verifying a code.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await verifyRegistrationOtp(mobileNumber, code);
      toast.add({ title: "Account verified", description: "You can now sign in to GeoFix 167.", type: "success" });
      navigate(PATHS.login, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error ?? "We could not verify your code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = () => {
    if (timeLeft > 0) return;

    // TODO: Call your resend verification code API

    setCode("");
    setTimeLeft(60);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mt-7 flex flex-col items-center gap-1.5">
        <h2 className="text-[22px] font-bold leading-7 text-primary">
          Enter Verification Code
        </h2>

        <p className="max-w-[320px] text-center text-[13px] leading-5 text-slate-500">
          Enter the six-digit code sent via SMS to
        </p>

        <span className="text-lg font-semibold leading-5 text-slate-800">
          {mobileNumber}
        </span>
      </div>

      <div className="mt-9 flex flex-col gap-5">
        <p className="text-sm font-medium text-slate-700">Verification Code</p>

        <VerificationCodeField value={code} onChange={setCode} />

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <p className="text-sm text-slate-500">
          Enter all six digits to enable verification.
        </p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button type="submit" className="h-12 w-full" disabled={code.length !== 6 || isSubmitting}>
          {isSubmitting ? "Verifying…" : "Verify Code"}
        </Button>

        <p className="text-sm text-slate-500">Didn't receive a code?</p>

        <button
          type="button"
          onClick={handleResendCode}
          disabled={timeLeft > 0}
          className={`text-sm font-semibold ${
            timeLeft > 0
              ? "cursor-not-allowed text-slate-500"
              : "text-primary hover:underline"
          }`}
        >
          {timeLeft > 0 ? `Resend Code in ${timeLeft}s` : "Resend Code"}
        </button>

        <button className="mt-7 text-primary text-sm font-semibold">
          Change Mobile Number
        </button>
      </div>
    </form>
  );
};

export default VerifyCode;
