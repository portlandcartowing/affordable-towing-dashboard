import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import webpush from "web-push";

// ---------------------------------------------------------------------------
// Send push notification to all available drivers. Called by the voice
// webhook when a new call comes in.
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

export async function POST(req: NextRequest) {
  const { caller_phone, source } = await req.json();

  // Get all available drivers with push subscriptions
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, push_subscription")
    .eq("status", "available")
    .not("push_subscription", "is", null);

  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const payload = JSON.stringify({
    title: "Incoming Call — ACT Dispatch",
    body: `${caller_phone || "Unknown"} · ${source || "unknown"} source`,
    url: "/driver",
  });

  let sent = 0;
  for (const driver of drivers) {
    try {
      await webpush.sendNotification(
        driver.push_subscription as webpush.PushSubscription,
        payload,
      );
      sent++;
    } catch (err) {
      // Subscription expired — remove it
      await supabase
        .from("drivers")
        .update({ push_subscription: null })
        .eq("id", driver.id);
    }
  }

  return NextResponse.json({ ok: true, sent });
}
