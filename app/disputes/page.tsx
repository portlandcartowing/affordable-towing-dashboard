import Topbar from "@/components/dashboard/Topbar";
import SectionHeader from "@/components/dashboard/SectionHeader";
import DisputesPanel from "./DisputesPanel";
import { supabase } from "@/lib/supabase";

export const revalidate = 15;

async function getDisputes() {
  const { data } = await supabase
    .from("disputes")
    .select(`
      id,
      reason,
      status,
      admin_notes,
      created_at,
      resolved_at,
      job_id,
      driver_id,
      jobs (id, customer, phone, pickup_city, dropoff_city, price, status),
      drivers (id, name, email, phone)
    `)
    .order("created_at", { ascending: false })
    .limit(100);
  return data || [];
}

export default async function DisputesPage() {
  const disputes = await getDisputes();
  const pending = disputes.filter((d: any) => d.status === "pending").length;

  return (
    <>
      <Topbar title="Disputes" subtitle="Review driver job disputes" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Total" value={disputes.length.toString()} icon="⚡" />
          <StatCard label="Pending" value={pending.toString()} icon="⏳" color="text-amber-600" />
          <StatCard
            label="Approved"
            value={disputes.filter((d: any) => d.status === "approved").length.toString()}
            icon="✓"
            color="text-emerald-600"
          />
          <StatCard
            label="Rejected"
            value={disputes.filter((d: any) => d.status === "rejected").length.toString()}
            icon="✕"
            color="text-red-500"
          />
        </section>

        <section>
          <SectionHeader title="All Disputes" />
          <DisputesPanel initialDisputes={disputes} />
        </section>
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  color = "text-slate-900",
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-sm">
          {icon}
        </div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
