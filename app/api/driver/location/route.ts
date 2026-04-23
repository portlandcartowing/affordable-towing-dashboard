import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// Driver location ping. Called by the driver app while a job is in-transit.
// Body: { jobId, lat, lng, heading?, speed? }
// Auth: Supabase JWT in Authorization: Bearer ...
// Stores raw coords in jobs.current_lat/current_lng. Public endpoint
// coarsens them before serving to customers.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing auth" }, { status: 401 });
  }

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: userData, error: userErr } = await verifier.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const { jobId, lat, lng } = await req.json();
  if (!jobId || typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ ok: false, error: "Missing jobId/lat/lng" }, { status: 400 });
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      current_lat: lat,
      current_lng: lng,
      location_updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
