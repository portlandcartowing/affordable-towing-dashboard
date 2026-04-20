import Topbar from "@/components/dashboard/Topbar";
import SectionHeader from "@/components/dashboard/SectionHeader";
import DriversManager from "./DriversManager";
import { supabase } from "@/lib/supabase";

export const revalidate = 15;

async function getDrivers() {
  const { data } = await supabase
    .from("drivers")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

export default async function DriversPage() {
  const drivers = await getDrivers();

  return (
    <>
      <Topbar title="Drivers" subtitle="Manage driver accounts and rates" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Total Drivers" value={drivers.length.toString()} icon="👤" />
          <StatCard
            label="Available"
            value={drivers.filter((d: any) => d.status === "available").length.toString()}
            icon="✓"
            color="text-emerald-600"
          />
          <StatCard
            label="Busy"
            value={drivers.filter((d: any) => d.status === "busy").length.toString()}
            icon="⟳"
            color="text-amber-600"
          />
          <StatCard
            label="Offline"
            value={drivers.filter((d: any) => d.status === "offline").length.toString()}
            icon="—"
            color="text-slate-400"
          />
        </section>

        <section>
          <SectionHeader title="All Drivers" />
          <DriversManager initialDrivers={drivers} />
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
