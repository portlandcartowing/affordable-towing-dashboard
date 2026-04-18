import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;

export const twilioClient = twilio(accountSid, authToken);
export const twilioNumber = process.env.TWILIO_PHONE_NUMBER!;
export const forwardNumber = process.env.FORWARD_PHONE_NUMBER!;
