import { useState } from "react";
import { PhoneNumberField } from "../../shared/components/FormField";
import { Check } from "lucide-react";
import { Button } from "../../shared/components/ui/button";

const ForgotPassword = () => {
  const [form, setForm] = useState({
    phoneNumber: "",
  });
  const [errors, setErrors] = useState({});

  const updateField = (field) => (event) => {
    const value = event.target.value;

    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <form>
      <div className="mt-7 flex flex-col items-center gap-1.5">
        <h2 className="text-[22px] font-bold leading-7 text-primary">
          Forgot Password
        </h2>

        <p className="max-w-[320px] text-center text-[13px] leading-5 text-slate-500">
          Enter the mobile number you used to register your GeoFix 167 account.
        </p>
      </div>

      <div className="mt-9 flex flex-col gap-2">
        <PhoneNumberField
          value={form.phoneNumber}
          onChange={updateField("phoneNumber")}
          error={errors.phoneNumber}
          errorId="phone-error"
        />

        <p className="text-sm text-slate-500">
          Enter your mobile number to receive an SMS.
        </p>

        <div className="mt-2 flex flex-row items-start gap-2 bg-primary/10 px-3 py-2.5 rounded-lg">
          <Check size={18} strokeWidth={3} className="shrink-0 text-primary" />

          <p className="text-[13px] text-primary">
            If this number is registered, we’ll send a six-digit reset code via
            SMS. Never share your code with anyone.
          </p>
        </div>

        <div className="mt-5">
          <Button
            type="submit"
            className="h-12 w-full"
            disabled={!form.phoneNumber}
          >
            Send Code
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ForgotPassword;
