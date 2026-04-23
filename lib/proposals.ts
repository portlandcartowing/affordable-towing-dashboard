import { supabaseAdmin as supabase } from "./supabaseAdmin";
import type { Proposal } from "./types";

/**
 * Look up a proposal by its public token. Used by the customer-facing
 * proposal page at /proposal/[token].
 */
export async function getProposalByToken(token: string): Promise<Proposal | null> {
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("token", token)
    .single();
  if (error || !data) return null;
  return data as Proposal;
}

/**
 * Create a proposal from a standby call. Returns the created proposal
 * with its token so the SMS link can be built.
 */
export async function createProposal(input: {
  call_id: string;
  lead_id: string;
  service_type: string | null;
  quoted_price: number | null;
  eta_min: number | null;
  eta_max: number | null;
  driver_area: string | null;
  route_summary: string | null;
  vehicle_desc: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  notes: string | null;
}): Promise<{ ok: boolean; proposal?: Proposal; error?: string }> {
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      call_id: input.call_id,
      lead_id: input.lead_id,
      service_type: input.service_type,
      quoted_price: input.quoted_price,
      eta_min: input.eta_min,
      eta_max: input.eta_max,
      driver_area: input.driver_area,
      route_summary: input.route_summary,
      vehicle_desc: input.vehicle_desc,
      pickup_address: input.pickup_address,
      dropoff_address: input.dropoff_address,
      notes: input.notes,
      status: "draft",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message || "Failed to create proposal" };
  }
  return { ok: true, proposal: data as Proposal };
}

/**
 * Mark a proposal as accepted. Called from the customer-facing page
 * when they tap the Accept button. Stamps accepted_at as legal proof.
 */
export async function acceptProposal(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: proposal, error: lookupError } = await supabase
    .from("proposals")
    .select("id, status, accepted_at")
    .eq("token", token)
    .single();

  if (lookupError || !proposal) {
    return { ok: false, error: "Proposal not found" };
  }
  if (proposal.accepted_at) {
    return { ok: true }; // already accepted, idempotent
  }
  if (proposal.status === "expired" || proposal.status === "cancelled") {
    return { ok: false, error: "This quote has expired" };
  }

  const { error } = await supabase
    .from("proposals")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", proposal.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Mark a proposal as viewed. Called when the customer opens the link.
 */
export async function markProposalViewed(token: string): Promise<void> {
  await supabase
    .from("proposals")
    .update({
      status: "viewed",
      viewed_at: new Date().toISOString(),
    })
    .eq("token", token)
    .is("viewed_at", null); // only stamp once
}
