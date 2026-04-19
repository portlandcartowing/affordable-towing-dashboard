import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Push subscription endpoint. The driver app sends its push subscription
// here after registering the service worker. We store it in Supabase so
// the voice webhook can send push notifications to wake the phone.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { subscription, driver_id } = await req.json();

  if (!subscription || !driver_id) {
    return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
  }

  // Store the push subscription on the driver row
  await supabase
    .from("drivers")
    .update({ push_subscription: subscription })
    .eq("id", driver_id);

  return NextResponse.json({ ok: true });
}
