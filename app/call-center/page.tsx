import Topbar from "@/components/dashboard/Topbar";
import CallCenterClient from "./CallCenterClient";
import { MOCK_CALLS } from "./mockData";

// Dispatcher panel. Currently runs entirely on mock data so the workflow
// can be exercised end-to-end without telephony wired up. When Twilio /
// real-time transcription is connected this page will become a server
// component that fetches the live queue from Supabase and subscribes to
// a realtime channel for transcript updates.
export const dynamic = "force-dynamic";

export default function CallCenterPage() {
  return (
    <>
      <Topbar
        title="Call Center"
        subtitle="Live inbound towing calls"
      />
      <CallCenterClient initialCalls={MOCK_CALLS} />
    </>
  );
}
