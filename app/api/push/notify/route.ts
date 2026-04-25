import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import webpush from "web-push";

// ---------------------------------------------------------------------------
// Send push notifications to all available drivers when a call/message comes
// in. Fans out to two destinations per driver:
//   1. Web Push (VAPID) — dashboard PWA running in a browser
//   2. Expo Push — native React Native driver app (Android/iOS)
//
// Called by the voice webhook on inbound call and by SMS flows.
// ---------------------------------------------------------------------------

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    "mailto:support@portlandcartowing.com",
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  );
}

type NotifyBody = {
  caller_phone?: string | null;
  source?: string | null;
  call_id?: string | null;
  job_id?: string | null;
  price?: number | null;
  pickup?: string | null;
  type?: "incoming_call" | "message" | "job_booked";
  body?: string | null;
};

export async function POST(req: NextRequest) {
  const payload: NotifyBody = await req.json();
  const type = payload.type || "incoming_call";

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, push_subscription, expo_push_token")
    .eq("status", "available");

  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let title: string;
  let body: string;
  if (type === "incoming_call") {
    title = "📞 Incoming Call — ACT Dispatch";
    body = `${payload.caller_phone || "Unknown"} · ${payload.source || "unknown"} source`;
  } else if (type === "job_booked") {
    const priceStr = payload.price ? ` · $${payload.price}` : "";
    title = "✅ Job Booked";
    body = `${payload.caller_phone || "New customer"}${priceStr}${payload.pickup ? ` · ${payload.pickup}` : ""}`;
  } else {
    title = "New Message";
    body = payload.body || `${payload.caller_phone || "New text"}`;
  }

  // --- Web Push fan-out (PWA dispatcher view) ---
  const webPayload = JSON.stringify({ title, body, url: "/driver" });
  let webSent = 0;
  for (const driver of drivers) {
    if (!driver.push_subscription) continue;
    try {
      await webpush.sendNotification(
        driver.push_subscription as webpush.PushSubscription,
        webPayload,
      );
      webSent++;
    } catch {
      await supabase
        .from("drivers")
        .update({ push_subscription: null })
        .eq("id", driver.id);
    }
  }

  // --- Expo Push fan-out (native driver app) ---
  const channelId =
    type === "incoming_call" ? "incoming_call"
    : type === "job_booked"   ? "job_booked"
    : "messages";
  const expoMessages = drivers
    .filter((d) => !!d.expo_push_token)
    .map((d) => ({
      to: d.expo_push_token as string,
      title,
      body,
      sound: "default",
      priority: type === "incoming_call" || type === "job_booked" ? "high" : "normal",
      channelId,
      data: {
        type,
        callId: payload.call_id,
        jobId: payload.job_id,
        callerPhone: payload.caller_phone,
      },
    }));

  let expoSent = 0;
  let expoTickets: unknown = null;
  let expoError: string | null = null;
  if (expoMessages.length > 0) {
    try {
      const resp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expoMessages),
      });
      const json = await resp.json();
      expoTickets = json.data ?? json.errors ?? json;
      // Count tickets that came back "ok"
      if (Array.isArray(json.data)) {
        expoSent = json.data.filter((t: { status?: string }) => t.status === "ok").length;
        const firstError = json.data.find(
          (t: { status?: string; message?: string; details?: { error?: string } }) =>
            t.status === "error",
        ) as { message?: string; details?: { error?: string } } | undefined;
        if (firstError) {
          expoError = `${firstError.details?.error || ""}: ${firstError.message || ""}`.trim();
        }
      } else if (json.errors) {
        expoError = JSON.stringify(json.errors).slice(0, 300);
      }
    } catch (err) {
      expoError = `fetch failed: ${String(err).slice(0, 200)}`;
    }
  }

  // Pull receipts ~3s after sending — this is where the REAL delivery
  // errors show up (DeviceNotRegistered, MismatchSenderId, etc.)
  let expoReceipts: unknown = null;
  let expoReceiptError: string | null = null;
  if (Array.isArray(expoTickets)) {
    const ticketIds = (expoTickets as Array<{ id?: string; status?: string }>)
      .filter((t) => t.status === "ok" && t.id)
      .map((t) => t.id as string);
    if (ticketIds.length > 0) {
      // Wait briefly for the push to be processed by Expo→FCM
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const receiptResp = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ ids: ticketIds }),
        });
        const receiptJson = await receiptResp.json();
        expoReceipts = receiptJson.data ?? receiptJson;
        if (receiptJson.data) {
          const firstError = Object.values(receiptJson.data).find(
            (r: { status?: string; details?: { error?: string }; message?: string } | unknown) => {
              const rec = r as { status?: string };
              return rec.status === "error";
            },
          ) as { message?: string; details?: { error?: string } } | undefined;
          if (firstError) {
            expoReceiptError = `${firstError.details?.error || ""}: ${firstError.message || ""}`.trim();
          }
        }
      } catch (err) {
        expoReceiptError = `receipt fetch failed: ${String(err).slice(0, 200)}`;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    sent: { web: webSent, expo: expoSent },
    expoError,
    expoTickets,
    expoReceiptError,
    expoReceipts,
  });
}
