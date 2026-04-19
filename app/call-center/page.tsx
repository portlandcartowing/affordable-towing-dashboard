import Topbar from "@/components/dashboard/Topbar";
import CallCenterClient from "./CallCenterClient";
import { supabase } from "@/lib/supabase";
import { mapCallToCallCenter } from "./mapCall";
import { MOCK_CALLS } from "./mockData";
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

  // Use real calls if available, fall back to sample data for demo
  const initialCalls = realCalls.length > 0 ? realCalls : MOCK_CALLS;

  return (
    <>
      <Topbar
        title="Call Center"
        subtitle={realCalls.length > 0 ? "Live inbound calls" : "Sample data — calls will appear when customers call"}
      />
      <CallCenterClient initialCalls={initialCalls} />
    </>
  );
}
