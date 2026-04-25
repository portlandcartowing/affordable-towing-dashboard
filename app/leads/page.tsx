import Topbar from "@/components/dashboard/Topbar";
import LeadsTable, { Lead } from "@/components/leads/LeadsTable";
import AddLeadModal from "@/components/leads/AddLeadModal";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { getLeadIdsWithJobs, getJobsByLeadId } from "@/lib/jobsQueries";

export const revalidate = 15;

export default async function LeadsPage() {
  const [{ data, error }, leadIdsWithJobs, jobsByLead] = await Promise.all([
    supabase.from("leads").select("*").order("created_at", { ascending: false }),
    getLeadIdsWithJobs(),
    getJobsByLeadId(),
  ]);

  const leads: Lead[] = data ?? [];

  // Fetch call dispositions + recording URLs for linked leads so the status
  // dropdown shows the right value AND the expanded view can play the
  // original call audio for the driver.
  const callIds = leads.map(l => l.call_id).filter(Boolean) as string[];
  let callDispositions: Record<string, string> = {};
  let callRecordings: Record<string, string> = {};
  if (callIds.length > 0) {
    const { data: calls } = await supabase
      .from("calls")
      .select("id, disposition, recording_url")
      .in("id", callIds);
    if (calls) {
      callDispositions = Object.fromEntries(
        calls.filter(c => c.disposition).map(c => [c.id, c.disposition])
      );
      callRecordings = Object.fromEntries(
        calls.filter(c => c.recording_url).map(c => [c.id, c.recording_url as string])
      );
    }
  }

  return (
    <>
      <Topbar title="Leads" />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              All Leads
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {leads.length} total {leads.length === 1 ? "lead" : "leads"}
            </p>
          </div>
          <AddLeadModal />
        </div>

        {error && (
          <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            Failed to load leads: {error.message}
          </div>
        )}

        <LeadsTable leads={leads} leadIdsWithJobs={[...leadIdsWithJobs]} callDispositions={callDispositions} callRecordings={callRecordings} jobsByLead={jobsByLead} />
      </main>
    </>
  );
}
