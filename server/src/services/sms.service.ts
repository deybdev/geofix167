type SmsPayload = {
  recipient: string;
  message: string;
  sender_id?: string;
};

export const sendSms = async (apiUrl: string, apiKey: string, payload: SmsPayload) => {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(apiKey + ":")}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      recipient: payload.recipient,
      content: payload.message,
      sender_id: payload.sender_id ?? "Unisoft",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("UniSMS error:", res.status, text);
    let msg = "Failed to send SMS.";
    try { msg = (JSON.parse(text) as { message?: string }).message ?? msg; } catch {}
    throw new Error(msg);
  }

  return res.json();
};
