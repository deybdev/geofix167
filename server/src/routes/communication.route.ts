import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { sendEmail } from "../services/email.service";
import { sendSms } from "../services/sms.service";

const communicationRoutes = new Hono<AppEnv>();

communicationRoutes.post("/email", async (c) => {
  const { to } = await c.req.json<{ to: string }>();
  await sendEmail( c.env.BREVO_API_URL, c.env.BREVO_API_KEY, {
    to,
    subject: "GeoFix 167 — Email Test",
    textContent: "Brevo API is working!",
  });
  return c.json({ message: "Email sent successfully." });
});

communicationRoutes.post("/sms", async (c) => {
  const { recipient } = await c.req.json<{ recipient: string }>();
  await sendSms(c.env.UNISMS_API_URL, c.env.UNISMS_API_KEY, {
    recipient,
    message: "UniSMS API is working!",
  });
  return c.json({ message: "SMS sent successfully." });
});

export default communicationRoutes;
