import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// Public tracking endpoint — serves the customer-facing /track/[token] page.
// Coarsens driver coordinates to 3 decimals (~100m / 350ft precision) so
// the driver's exact location isn't exposed to anyone with the link.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

function coarsen(n: number | null): number | null {
  if (n === null || n === undefined) return null;
  return Math.round(n * 1000) / 1000;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, customer, pickup_address, pickup_city, pickup_state, current_lat, current_lng, location_updated_at, completed_at, created_at")
    .eq("tracking_token", token)
    .single();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const firstName = (job.customer || "").split(/\s+/)[0] || "there";
  const active = job.status === "in_transit";
  const completed = job.status === "completed";

  const pickupParts = [job.pickup_address, job.pickup_city, job.pickup_state].filter(Boolean);
  const pickup = pickupParts.join(", ");

  return NextResponse.json({
    ok: true,
    firstName,
    status: job.status,
    active,
    completed,
    pickup,
    driver: {
      lat: coarsen(job.current_lat as number | null),
      lng: coarsen(job.current_lng as number | null),
      updated_at: job.location_updated_at ?? null,
    },
  });
}
