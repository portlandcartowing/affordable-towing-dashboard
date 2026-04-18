import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
    }
    _client = twilio(sid, token);
  }
  return _client;
}

export const twilioNumber = process.env.TWILIO_PHONE_NUMBER || "";
export const forwardNumber = process.env.FORWARD_PHONE_NUMBER || "";
