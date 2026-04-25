import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// Universal search endpoint — scans calls, leads, jobs, drivers in parallel
// for any substring match. Used by the GlobalSearch component in Topbar.
//
// GET /api/search?q=<term>   — keep it cheap on browser side via querystring.
// ---------------------------------------------------------------------------

const PER_GROUP_LIMIT = 6;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }

  // ilike requires escaping % and _ in user input
  const term = q.replace(/[%_]/g, (c) => `\\${c}`);
  const like = `%${term}%`;

  const [callsRes, leadsRes, jobsRes, driversRes] = await Promise.all([
    supabase
      .from("calls")
      .select("id, caller_phone, transcript, ai_summary, notes, created_at, source")
      .or(
        `caller_phone.ilike.${like},transcript.ilike.${like},ai_summary.ilike.${like},notes.ilike.${like}`,
      )
      .order("created_at", { ascending: false })
      .limit(PER_GROUP_LIMIT),
    supabase
      .from("leads")
      .select("id, customer, phone, notes, city, service, created_at")
      .or(
        `customer.ilike.${like},phone.ilike.${like},notes.ilike.${like},city.ilike.${like},service.ilike.${like}`,
      )
      .order("created_at", { ascending: false })
      .limit(PER_GROUP_LIMIT),
    supabase
      .from("jobs")
      .select(
        "id, customer, phone, vehicle_year, vehicle_make, vehicle_model, pickup_address, pickup_city, dropoff_address, dropoff_city, status, created_at",
      )
      .or(
        `customer.ilike.${like},phone.ilike.${like},vehicle_make.ilike.${like},vehicle_model.ilike.${like},pickup_address.ilike.${like},pickup_city.ilike.${like},dropoff_address.ilike.${like},dropoff_city.ilike.${like}`,
      )
      .order("created_at", { ascending: false })
      .limit(PER_GROUP_LIMIT),
    supabase
      .from("drivers")
      .select("id, name, email, status")
      .or(`name.ilike.${like},email.ilike.${like}`)
      .limit(PER_GROUP_LIMIT),
  ]);

  type Result = {
    type: "call" | "lead" | "job" | "driver";
    id: string;
    title: string;
    subtitle: string | null;
    preview: string | null;
    href: string;
  };

  const results: Result[] = [];

  for (const c of callsRes.data ?? []) {
    const phone = c.caller_phone || "Unknown";
    const preview = c.ai_summary || (c.transcript ? c.transcript.slice(0, 120) : c.notes || "");
    results.push({
      type: "call",
      id: c.id,
      title: phone,
      subtitle: c.source || "call",
      preview: preview || null,
      href: c.caller_phone ? `/customers/${encodeURIComponent(c.caller_phone)}` : "/calls",
    });
  }

  for (const l of leadsRes.data ?? []) {
    results.push({
      type: "lead",
      id: l.id,
      title: l.customer || l.phone || "Lead",
      subtitle: [l.service, l.city].filter(Boolean).join(" · ") || null,
      preview: l.notes || null,
      href: l.phone ? `/customers/${encodeURIComponent(l.phone)}` : "/leads",
    });
  }

  for (const j of jobsRes.data ?? []) {
    const vehicle = [j.vehicle_year, j.vehicle_make, j.vehicle_model].filter(Boolean).join(" ");
    const route = [j.pickup_city, j.dropoff_city].filter(Boolean).join(" → ");
    results.push({
      type: "job",
      id: j.id,
      title: j.customer || vehicle || "Job",
      subtitle: vehicle || route || j.status || null,
      preview: route || null,
      href: j.phone ? `/customers/${encodeURIComponent(j.phone)}` : "/jobs",
    });
  }

  for (const d of driversRes.data ?? []) {
    results.push({
      type: "driver",
      id: d.id,
      title: d.name || d.email || "Driver",
      subtitle: d.email || null,
      preview: d.status || null,
      href: "/drivers",
    });
  }

  return NextResponse.json({ ok: true, results });
}
