import BookedToggle from "./BookedToggle";
import CreateJobButton from "./CreateJobButton";
import EmptyState from "@/components/dashboard/EmptyState";
import type { Lead } from "@/lib/types";

export type { Lead };

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(price: number | null) {
  if (price == null) return "—";
  return `$${price.toFixed(2)}`;
}

export default function LeadsTable({
  leads,
  leadIdsWithJobs,
}: {
  leads: Lead[];
  leadIdsWithJobs: Set<string>;
}) {
  if (leads.length === 0) {
    return (
      <EmptyState
        icon="◉"
        title="No leads yet"
        description="Tap Add Lead to create one, or wait for an inbound call to convert."
      />
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <ul className="md:hidden space-y-3">
        {leads.map((lead) => {
          const hasJob = leadIdsWithJobs.has(lead.id);
          return (
            <li
              key={lead.id}
              className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {lead.customer || "Unknown"}
                  </div>
                  <a
                    href={lead.phone ? `tel:${lead.phone}` : undefined}
                    className="text-sm text-blue-600 truncate block"
                  >
                    {lead.phone || "—"}
                  </a>
                </div>
                <BookedToggle id={lead.id} booked={!!lead.booked} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Service</div>
                  <div className="text-slate-800 truncate">{lead.service || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-400">City</div>
                  <div className="text-slate-800 truncate">{lead.city || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-400">Source</div>
                  <div className="text-slate-800 truncate">{lead.source || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-400">Price</div>
                  <div className="text-slate-800">{formatPrice(lead.price)}</div>
                </div>
              </div>
              {lead.notes && (
                <div className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-2">
                  {lead.notes}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase text-slate-400">
                  {formatTime(lead.created_at)}
                </div>
                <CreateJobButton
                  leadId={lead.id}
                  hasJob={hasJob}
                  booked={!!lead.booked}
                  size="md"
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop / tablet table */}
      <div className="hidden md:block bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="text-left px-4 py-3">Booked</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Notes</th>
                <th className="text-right px-4 py-3">Job</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const hasJob = leadIdsWithJobs.has(lead.id);
                return (
                <tr key={lead.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatTime(lead.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{lead.customer || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {lead.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lead.service || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{lead.city || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700">
                      {lead.source || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BookedToggle id={lead.id} booked={!!lead.booked} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {formatPrice(lead.price)}
                  </td>
                  <td
                    className="px-4 py-3 text-slate-500 max-w-xs truncate"
                    title={lead.notes || ""}
                  >
                    {lead.notes || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CreateJobButton
                      leadId={lead.id}
                      hasJob={hasJob}
                      booked={!!lead.booked}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
