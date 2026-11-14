type EmailPayload = {
  to: string;
  subject: string;
  textContent?: string;
  htmlContent?: string;
};

export const sendEmail = async (apiUrl: string, apiKey: string, payload: EmailPayload) => {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "GeoFix 167", email: "rainopinion0@gmail.com" },
      to: [{ email: payload.to }],
      subject: payload.subject,
      textContent: payload.textContent,
      htmlContent: payload.htmlContent,
    }),
  });

  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? "Failed to send email.");
  }

  return res.json();
};
