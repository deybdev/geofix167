
import { useRef } from "react";

export default function VerificationCodeField({
  value = "",
  onChange,
  length = 6,
  error,
  disabled = false,
}) {
  const inputRefs = useRef([]);

  const digits = Array.from(
    { length },
    (_, index) => value[index] || "",
  );

  const updateCode = (newValue, focusIndex) => {
    const code = newValue.replace(/\D/g, "").slice(0, length);

    onChange(code);

    if (focusIndex >= 0 && focusIndex < length) {
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleChange = (index, inputValue) => {
    const digit = inputValue.replace(/\D/g, "").slice(-1);

    const current = digits.join("").split("");
    current[index] = digit;

    const nextCode = current.join("");

    updateCode(nextCode, digit ? index + 1 : index);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();

    const pastedCode = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);

    updateCode(pastedCode, Math.min(pastedCode.length, length - 1));
  };

  return (
    <div className="flex flex-col gap-2 ">
      <div className="flex justify-center gap-3 sm:gap-4">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`Verification digit ${index + 1}`}
            aria-invalid={!!error}
            onChange={(event) =>
              handleChange(index, event.target.value)
            }
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            className={`h-15 w-13 rounded-lg border bg-white text-center text-lg font-semibold text-slate-800 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 ${
              error
                ? "border-destructive"
                : "border-slate-300 focus:border-primary"
            }`}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
