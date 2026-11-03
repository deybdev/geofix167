import { useState } from "react";
import axios from "axios";

export default function TestPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [smsStatus, setSmsStatus] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);

  const testEmail = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailStatus("");
    try {
      const { data } = await axios.post("/api/communication/email", { to: email });
      setEmailStatus(`✅ ${data.message}`);
    } catch (err) {
      setEmailStatus(`❌ ${err.response?.data?.message ?? "Failed to send email."}`);
    } finally {
      setEmailLoading(false);
    }
  };

  const testSms = async (e) => {
    e.preventDefault();
    setSmsLoading(true);
    setSmsStatus("");
    try {
      const { data } = await axios.post("/api/communication/sms", { recipient: phone });
      setSmsStatus(`✅ ${data.message}`);
    } catch (err) {
      setSmsStatus(`❌ ${err.response?.data?.message ?? "Failed to send SMS."}`);
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <h1 className="text-2xl font-bold text-primary">API Test Panel</h1>

      {/* Email Test */}
      <div className="w-full max-w-sm rounded-xl border border-input bg-background p-6">
        <h2 className="mb-4 font-semibold text-foreground">Email (Brevo)</h2>
        <form onSubmit={testEmail} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Recipient email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={emailLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {emailLoading ? "Sending…" : "Send Test Email"}
          </button>
          {emailStatus && <p className="text-sm">{emailStatus}</p>}
        </form>
      </div>

      {/* SMS Test */}
      <div className="w-full max-w-sm rounded-xl border border-input bg-background p-6">
        <h2 className="mb-4 font-semibold text-foreground">SMS (UniSMS)</h2>
        <form onSubmit={testSms} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Recipient number (e.g. 09171234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={smsLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {smsLoading ? "Sending…" : "Send Test SMS"}
          </button>
          {smsStatus && <p className="text-sm">{smsStatus}</p>}
        </form>
      </div>
    </main>
  );
}
