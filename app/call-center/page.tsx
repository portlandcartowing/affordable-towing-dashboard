import Topbar from "@/components/dashboard/Topbar";
import CallCenterClient from "./CallCenterClient";
import { supabase } from "@/lib/supabase";
import { mapCallToCallCenter } from "./mapCall";

import type { Call } from "@/lib/types";

// Always fetch fresh — dispatcher needs live data.
export const dynamic = "force-dynamic";

export default async function CallCenterPage() {
  // Fetch today's calls from Supabase
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: callRows } = await supabase
    .from("calls")
    .select("*")
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(50);

  // Map Supabase rows to call center format
  const realCalls = (callRows || []).map((row: Call) => mapCallToCallCenter(row));

  const initialCalls = realCalls;

  return (
    <>
      <Topbar
        title="Call Center"
        subtitle="Live inbound calls"
      />
      <CallCenterClient initialCalls={initialCalls} />
    </>
  );
}
