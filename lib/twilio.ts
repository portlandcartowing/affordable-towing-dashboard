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

// Cached balance fetch — /health polls every 60s and the cron also reads this.
// Without caching, an open dashboard tab fires ~1,440 Twilio API calls/day.
const BALANCE_TTL_MS = 5 * 60_000;
let _balanceCache: { value: { balance: number; currency: string } | null; at: number } | null = null;

export async function getCachedTwilioBalance(): Promise<{ balance: number; currency: string } | null> {
  const now = Date.now();
  if (_balanceCache && now - _balanceCache.at < BALANCE_TTL_MS) {
    return _balanceCache.value;
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    if (!sid) {
      _balanceCache = { value: null, at: now };
      return null;
    }
    const bal = await getTwilioClient().api.v2010.accounts(sid).balance.fetch();
    const value = { balance: parseFloat(bal.balance), currency: bal.currency || "USD" };
    _balanceCache = { value, at: now };
    return value;
  } catch {
    _balanceCache = { value: null, at: now };
    return null;
  }
}
