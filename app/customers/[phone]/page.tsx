import Link from "next/link";
import Topbar from "@/components/dashboard/Topbar";
import MessagesPanel from "@/app/call-center/components/MessagesPanel";
import EditableCustomerName from "@/components/calls/EditableCustomerName";
import DispositionChanger from "@/components/calls/DispositionChanger";
import AudioPlayer from "@/components/calls/AudioPlayer";
import CallHistoryItem from "@/components/customers/CallHistoryItem";
import EditablePrice from "@/components/jobs/EditablePrice";
import EditableAddress from "@/components/jobs/EditableAddress";
import SendReviewButton from "@/components/customers/SendReviewButton";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { Call, Lead, Job } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone: phoneEncoded } = await params;
  const phone = decodeURIComponent(phoneEncoded);

  const [callsRes, leadsRes, jobsRes] = await Promise.all([
    supabase
      .from("calls")
      .select("*")
      .eq("caller_phone", phone)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("leads")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("*")
      .eq("phone", phone)
      .order("created_at", { ascending: false }),
  ]);

  const calls = (callsRes.data ?? []) as Call[];
  const leads = (leadsRes.data ?? []) as Lead[];
  const jobs = (jobsRes.data ?? []) as Job[];

  // Derive a canonical name from the most-recent lead with a name set.
  const canonicalName = leads.find((l) => l.customer)?.customer ?? null;

  const firstSeen = [
    ...calls.map((c) => c.started_at ?? c.created_at),
    ...leads.map((l) => l.created_at),
  ]
    .filter(Boolean)
    .sort()[0] ?? null;

  const bookedJobs = jobs.filter((j) => j.status === "booked" || j.status === "completed");
  const totalRevenue = bookedJobs.reduce((sum, j) => sum + (j.price ?? 0), 0);

  return (
    <>
      <Topbar title="Customer" subtitle={phone} />
      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-5xl">
        <div>
          <Link href="/leads" className="text-xs text-blue-600 hover:underline">
            ← Back to Leads
          </Link>
        </div>

        {/* Header card */}
        <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase text-slate-400 font-medium">Customer</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                <EditableCustomerName phone={phone} initialName={canonicalName} placeholder="Unknown" />
              </div>
              <div className="text-sm text-slate-500 mt-1 tabular-nums">{phone}</div>
            </div>
            <div className="flex gap-6 text-right shrink-0">
              <Stat label="Calls" value={calls.length.toString()} />
              <Stat label="Jobs" value={jobs.length.toString()} />
              <Stat label="Revenue" value={money(totalRevenue)} />
            </div>
          </div>
          {firstSeen && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
              Customer since {formatTime(firstSeen)}
            </div>
          )}
        </section>

        {/* Text Messages */}
        <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Text Messages</h3>
            <SendReviewButton phone={phone} />
          </div>
          <div className="h-[420px]">
            <MessagesPanel callerPhone={phone} callId={calls[0]?.id ?? ""} />
          </div>
        </section>

        {/* Call history */}
        <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Call History</h3>
          </div>
          {calls.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No calls from this number.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {calls.map((call) => (
                <li key={call.id} className="px-5 py-3 space-y-2 text-sm">
                  <CallHistoryItem
                    transcript={call.transcript}
                    aiSummary={call.ai_summary}
                  >
                    {({ expanded, onToggle }) => (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {formatTime(call.started_at ?? call.created_at)}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {call.ai_summary || call.transcript?.slice(0, 80) || "No summary"}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs shrink-0">
                          <span className="text-slate-500">{call.source || "—"}</span>
                          <DispositionChanger callId={call.id} initialValue={call.disposition} size="sm" />
                          <button
                            type="button"
                            onClick={onToggle}
                            aria-expanded={expanded}
                            className="text-blue-600 hover:underline"
                          >
                            {expanded ? "Hide ▾" : "View ▸"}
                          </button>
                        </div>
                      </div>
                    )}
                  </CallHistoryItem>
                  {call.recording_url && (
                    <AudioPlayer src={call.recording_url} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Jobs */}
        <section className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Jobs</h3>
          </div>
          {jobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">No jobs for this customer.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <li key={job.id} className="px-5 py-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {[job.vehicle_year, job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ") || "Vehicle TBD"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatTime(job.created_at)} · <span className="capitalize">{job.status.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase text-slate-400">Total</div>
                      <EditablePrice jobId={job.id} initialPrice={job.price} size="md" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase text-slate-400">Pickup</div>
                      <EditableAddress
                        jobId={job.id}
                        which="pickup"
                        initial={{
                          address: job.pickup_address,
                          city: job.pickup_city,
                          state: job.pickup_state,
                          zip: job.pickup_zip,
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400">Dropoff</div>
                      <EditableAddress
                        jobId={job.id}
                        which="dropoff"
                        initial={{
                          address: job.dropoff_address,
                          city: job.dropoff_city,
                          state: job.dropoff_state,
                          zip: job.dropoff_zip,
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-slate-400 font-medium">{label}</div>
      <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
