import { useState } from "react";
import { Button } from "../../shared/components/ui/button";
import { PhoneNumberField } from "../../shared/components/FormField";
import { Check } from "lucide-react";

const ChangeMobile = () => {
  const [form, setForm] = useState({
    phoneNumber: "",
  });

  const [errors, setErrors] = useState({});

  const updateField = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));

    setErrors((prev) => ({
      ...prev,
      [field]: "",
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const phoneNumber = form.phoneNumber.trim();
    const isValid =
      /^09\d{9}$/.test(phoneNumber) || /^\+639\d{9}$/.test(phoneNumber);

    if (!isValid) {
      setErrors({
        phoneNumber: "Enter a valid mobile number.",
      });
      return;
    }

    setErrors({});

    // TODO: Send verification code through your API
    console.log("Mobile number:", phoneNumber);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mt-7 flex flex-col items-center gap-1.5">
        <h2 className="text-[22px] font-bold leading-7 text-primary">
          Change Mobile Number
        </h2>

        <p className="max-w-[320px] text-center text-[13px] leading-5 text-slate-500">
          Update your number before requesting another verification code.
        </p>

        <p className="text-[13px] text-slate-500 w-full self-start mt-9">
          Current Number: 09123456789
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
            The next OTP will be sent to the number saved here. Any previous
            code will no longer be used.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Button type="submit" className="h-12 w-full" disabled={!form.phoneNumber}>
          Send Code
        </Button>
      </div>
    </form>
  );
};

export default ChangeMobile;
