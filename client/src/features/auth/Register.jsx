import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { FormField, NameField, PasswordField, PhoneNumberField } from "../../shared/components/FormField";
import { registerSchema } from "../../schemas/register.schema";
import PolicyConsent, { POLICY_VERSION } from "./PolicyConsent";
import AuthLoading from "./AuthLoading";
import BarangayIdScanner from "./BarangayIdScanner";
import { getApiErrorMessage } from "../../shared/utils/apiError";
import { toast } from "../../shared/components/ui/toast";
import LoadingOverlay from "../../shared/components/loading/LoadingOverlay";

const api = axios.create({ baseURL: "/api/auth", withCredentials: true });
const initialForm = { firstName: "", middleName: "", lastName: "", barangayIdentifier: "", dateOfBirth: "", phoneNumber: "", email: "", password: "", confirmPassword: "", acceptedTerms: false };

export default function Register() {
  const [form, setForm] = useState(initialForm);
  const [identity, setIdentity] = useState(null);
  const [request, setRequest] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("Processing…");
  const [cooldown, setCooldown] = useState(0);
  const [file, setFile] = useState(null);

  useEffect(() => {
    api.get("/registration/identity").then(({ data }) => {
      if (data.identity) {
        setIdentity(data.identity);
        setForm(current => ({ ...current, email: data.identity.email, firstName: data.identity.first_name || current.firstName, lastName: data.identity.last_name || current.lastName }));
        api.get("/registration/status").then(({ data: status }) => setRequest(status.request)).catch(err => setError(getApiErrorMessage(err, "We couldn’t load your registration status. Refresh the page and try again.")));
      }
    }).catch(err => setError(getApiErrorMessage(err, "We couldn’t load your registration. Refresh the page and try again.")));
  }, []);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const update = field => event => {
    const value = field === "acceptedTerms" ? event.target.checked : event.target.value;
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    setError("");
  };
  const perform = async (action, loadingMessage = "Processing…") => {
    setBusyMessage(loadingMessage); setBusy(true); setError("");
    try { await action(); } catch (err) {
      setError(getApiErrorMessage(err));
      const retry = Number(err.response?.data?.retry_after || err.response?.headers?.["retry-after"] || 0);
      if (retry) setCooldown(retry);
    } finally { setBusy(false); }
  };
  const validate = () => {
    const result = registerSchema.safeParse({ ...form, google: Boolean(identity?.google) });
    if (!result.success) {
      setErrors(Object.fromEntries(Object.entries(result.error.flatten().fieldErrors).map(([field, messages]) => [field, messages?.[0]])));
      return false;
    }
    return true;
  };
  const submit = async event => {
    event.preventDefault();
    if (!validate()) return;
    if (!identity) {
       await perform(async () => {
        const { data } = await api.post("/registration/email/start", { email: form.email });
        setOtpSent(true); setCooldown(Number(data.retry_after || 60));
        toast.add({ title: "Verification code sent", description: data.message, type: "success" });
      }, "Sending your verification code…");
      return;
    }
    await submitRegistration();
  };
  const submitRegistration = async () => perform(async () => {
    const { data } = await api.post("/register", {
      first_name: form.firstName, middle_name: form.middleName, last_name: form.lastName,
      email: form.email,
      barangay_identifier: form.barangayIdentifier, date_of_birth: form.dateOfBirth,
      mobile_number: form.phoneNumber, ...(identity.google ? {} : { password: form.password }),
      accepted_terms: form.acceptedTerms, terms_version: POLICY_VERSION, privacy_version: POLICY_VERSION,
    });
    toast.add({ title: "Registration submitted", description: data.message, type: "success" });
    setRequest(null);
    const status = await api.get("/registration/status");
    setRequest(status.data.request);
  }, "Submitting your registration…");
  const verifyEmail = event => {
    event.preventDefault();
    perform(async () => {
      const { data } = await api.post("/registration/email/verify", { code });
      setIdentity(data.identity); setOtpSent(false); setCooldown(0);
      toast.add({ title: "Email verified", description: "Complete the remaining details to submit your registration.", type: "success" });
    }, "Verifying your email…");
  };
  const upload = event => {
    event.preventDefault();
    perform(async () => {
      if (!file || file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "application/pdf"].includes(file.type)) throw { response: { data: { error: "Select a JPEG, PNG, or PDF up to 5 MB." } } };
      const { data } = await api.post("/registration/document", file, { headers: { "Content-Type": file.type } });
      toast.add({ title: "Document submitted", description: data.message, type: "success" });
      const status = await api.get("/registration/status"); setRequest(status.data.request);
    }, "Uploading your document…");
  };

  const loadingLabel = identity ? "Submitting registration…" : "Sending verification code…";

  return <div className="mt-5 space-y-4">
    <LoadingOverlay open={busy} message={busyMessage} />
    <div><h2 className="text-xl font-bold text-primary">{identity?.google ? "Complete your profile" : "Create your account"}</h2>
    <p className="mt-1 text-sm text-slate-500">{identity?.google ? "We only need a few more details to finish setting up your account." : "Use Google for a faster setup, or register with your email."}</p></div>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {!identity && <><a href="/api/auth/google/start" className="block rounded-lg bg-primary p-3 text-center text-sm font-semibold text-white transition hover:bg-primary/90">Continue with Google</a><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>or register with email</span><span className="h-px flex-1 bg-slate-200" /></div></>}

    <form onSubmit={submit} noValidate className="space-y-3.5">
      <NameField label="First Name" value={form.firstName} onChange={update("firstName")} error={errors.firstName} required />
      <NameField label="Middle Name" value={form.middleName} onChange={update("middleName")} error={errors.middleName} />
      <NameField label="Last Name" value={form.lastName} onChange={update("lastName")} error={errors.lastName} required />
      <FormField label="Email Address" error={errors.email} required><Input type="email" autoComplete="email" value={form.email} onChange={update("email")} readOnly={Boolean(identity)} aria-readonly={Boolean(identity)} className={identity ? "bg-slate-50 text-slate-500" : ""} /></FormField>
      <FormField label="Barangay ID Number" error={errors.barangayIdentifier} required><span className="flex gap-2"><Input value={form.barangayIdentifier} onChange={update("barangayIdentifier")} autoComplete="off" className="min-w-0 flex-1" /><BarangayIdScanner onScan={value => { setForm(current => ({ ...current, barangayIdentifier: value })); setErrors(current => ({ ...current, barangayIdentifier: undefined })); }} /></span></FormField>
      <FormField label="Date of Birth" error={errors.dateOfBirth} required><Input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={update("dateOfBirth")} /></FormField>
      <PhoneNumberField value={form.phoneNumber} onChange={update("phoneNumber")} error={errors.phoneNumber} required />
      {!identity?.google && <><PasswordField label="Password" value={form.password} onChange={update("password")} error={errors.password} required /><PasswordField label="Confirm Password" value={form.confirmPassword} onChange={update("confirmPassword")} error={errors.confirmPassword} required /></>}
      <PolicyConsent checked={form.acceptedTerms} onChange={value => setForm(current => ({ ...current, acceptedTerms: value }))} />
      {errors.acceptedTerms && <p className="text-sm text-destructive">{errors.acceptedTerms}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy || cooldown > 0 || !form.acceptedTerms}>{busy ? <AuthLoading label={loadingLabel} /> : identity ? "Submit registration" : otpSent ? "Send OTP again" : "Continue and verify email"}</Button>
    </form>

    {otpSent && !identity && <form onSubmit={verifyEmail} className="space-y-3 rounded-lg border p-4">
      <p className="text-sm">Enter the six-digit OTP sent to <strong>{form.email}</strong>.</p>
      <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value)} placeholder="000000" required />
      <Button type="submit" disabled={busy || code.length !== 6}>Verify Gmail OTP</Button>
      {cooldown > 0 && <p className="text-xs text-slate-500">You can request another code in {cooldown}s.</p>}
    </form>}

    {request && <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
      {request.status === "PENDING" && <><h3 className="font-semibold text-slate-900">Verification in progress</h3><p className="text-sm text-slate-600">We’re reviewing your registration. We’ll send an update to your verified email when it’s ready.</p></>}
      {request.status === "APPROVED" && <><h3 className="font-semibold text-slate-900">Your account is ready</h3><p className="text-sm text-slate-600">Your registration was completed successfully. You can now <Link className="font-semibold text-primary underline" to="/login">log in</Link>.</p></>}
      {request.status === "NEEDS_CORRECTION" && <><h3 className="font-semibold text-slate-900">Additional verification needed</h3><p className="text-sm text-slate-600">We couldn’t complete identity verification. Please provide a clear Barangay ID or approved identification document.</p><form onSubmit={upload} className="space-y-3"><FormField label="Verification document" required><Input type="file" accept="image/jpeg,image/png,application/pdf" onChange={event => setFile(event.target.files?.[0] || null)} required /></FormField><p className="text-xs leading-5 text-slate-500">JPEG, PNG, or PDF up to 5 MB. Your document is available only to authorized reviewers and is used for identity verification.</p><Button type="submit" disabled={busy}>{busy ? <AuthLoading label="Uploading securely…" /> : "Submit securely"}</Button></form></>}
    </section>}
    <p className="text-center text-sm">Already have an account? <Link className="font-semibold text-primary" to="/login">Log in</Link></p>
  </div>;
}
