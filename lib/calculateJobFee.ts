// ---------------------------------------------------------------------------
// Job fee calculator — geocodes pickup/dropoff via Nominatim (free OSM,
// no API key), then computes a driving-distance estimate and a fee based
// on the driver's hookup_fee + rate_per_mile.
//
// Server-side only (Nominatim CORS won't allow browser calls without a
// proxy, plus driver rates are a trust boundary). Rate limit is 1 req/sec
// per Nominatim ToS — we do 2 geocodes per job so this is fine.
// ---------------------------------------------------------------------------

import { supabaseAdmin } from "./supabaseAdmin";

export interface FeeResult {
  ok: boolean;
  distanceMiles: number | null;
  hookupFee: number | null;
  ratePerMile: number | null;
  total: number | null;
  error?: string;
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  try {
    const resp = await fetch(url, {
      headers: {
        // Nominatim requires a real User-Agent identifying the app
        "User-Agent": "ACTDispatch/1.0 (portlandcartowing.com)",
      },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3959; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Compute and persist the fee for a job, using the assigned driver's
 * hookup_fee + rate_per_mile. Falls back to the default driver row if
 * the job has no assigned driver yet.
 *
 * Writes jobs.distance_miles and jobs.price (total). Does NOT surface
 * the fee to any customer view — that's deliberately hidden until the
 * tow is complete.
 */
export async function calculateAndPersistJobFee(jobId: string): Promise<FeeResult> {
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, driver_id, pickup_address, pickup_city, pickup_state, pickup_zip, dropoff_address, dropoff_city, dropoff_state, dropoff_zip")
    .eq("id", jobId)
    .single();

  if (!job) return { ok: false, distanceMiles: null, hookupFee: null, ratePerMile: null, total: null, error: "Job not found" };

  const pickupParts = [job.pickup_address, job.pickup_city, job.pickup_state, job.pickup_zip].filter(Boolean).join(", ");
  const dropoffParts = [job.dropoff_address, job.dropoff_city, job.dropoff_state, job.dropoff_zip].filter(Boolean).join(", ");

  if (!pickupParts || !dropoffParts) {
    return { ok: false, distanceMiles: null, hookupFee: null, ratePerMile: null, total: null, error: "Missing pickup or dropoff" };
  }

  // Pull driver rates — assigned driver first, then first-available, then default from schema (95 / 4)
  let hookupFee = 95;
  let ratePerMile = 4;
  const driverQ = job.driver_id
    ? supabaseAdmin.from("drivers").select("hookup_fee, rate_per_mile").eq("id", job.driver_id).maybeSingle()
    : supabaseAdmin.from("drivers").select("hookup_fee, rate_per_mile").eq("status", "available").limit(1).maybeSingle();
  const { data: driver } = await driverQ;
  if (driver) {
    hookupFee = Number(driver.hookup_fee) || hookupFee;
    ratePerMile = Number(driver.rate_per_mile) || ratePerMile;
  }

  const pickupCoords = await geocode(pickupParts);
  // Nominatim asks for ≥1 sec spacing between requests
  await new Promise((r) => setTimeout(r, 1100));
  const dropoffCoords = await geocode(dropoffParts);

  if (!pickupCoords || !dropoffCoords) {
    return { ok: false, distanceMiles: null, hookupFee, ratePerMile, total: null, error: "Geocode failed" };
  }

  const straight = haversineMiles(pickupCoords, dropoffCoords);
  // Rough driving-factor multiplier — not a real routing API, but consistent
  const drivingMiles = Math.round(straight * 1.4 * 10) / 10;
  const total = Math.round(hookupFee + drivingMiles * ratePerMile);

  await supabaseAdmin
    .from("jobs")
    .update({ distance_miles: drivingMiles, price: total })
    .eq("id", jobId);

  // Mirror the price onto the linked lead so Revenue KPI reflects it
  const { data: jobRow } = await supabaseAdmin.from("jobs").select("lead_id").eq("id", jobId).single();
  if (jobRow?.lead_id) {
    await supabaseAdmin.from("leads").update({ price: total }).eq("id", jobRow.lead_id);
  }

  return { ok: true, distanceMiles: drivingMiles, hookupFee, ratePerMile, total };
}
