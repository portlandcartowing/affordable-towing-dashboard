import { getProposalByToken, markProposalViewed } from "@/lib/proposals";
import AcceptButton from "./AcceptButton";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await getProposalByToken(token);

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🚫</div>
          <h1 className="text-lg font-bold text-slate-900">Quote Not Found</h1>
          <p className="text-sm text-slate-500 mt-1">
            This link may have expired or been used already.
          </p>
        </div>
      </div>
    );
  }

  // Mark as viewed (fires once, idempotent)
  await markProposalViewed(token);

  const isExpired = proposal.status === "expired" || proposal.status === "cancelled";
  const isAccepted = proposal.status === "accepted" || !!proposal.accepted_at;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header band */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-6 py-8 text-center">
        <div className="text-sm font-medium uppercase tracking-wider opacity-80 mb-1">
          Portland Car Towing
        </div>
        <h1 className="text-2xl font-bold">Your Towing Quote</h1>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-5 -mt-4">
        {/* Quote card */}
        <div className="bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/70 overflow-hidden">
          {proposal.quoted_price != null && (
            <div className="bg-slate-900 text-white text-center py-5">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">
                Total Price
              </div>
              <div className="text-4xl font-bold tabular-nums">
                ${proposal.quoted_price}
              </div>
            </div>
          )}

          <div className="p-5 space-y-3">
            {proposal.service_type && (
              <Row label="Service" value={proposal.service_type} />
            )}
            {proposal.vehicle_desc && (
              <Row label="Vehicle" value={proposal.vehicle_desc} />
            )}
            {proposal.pickup_address && (
              <Row label="Pickup" value={proposal.pickup_address} icon="◉" />
            )}
            {proposal.dropoff_address && (
              <Row label="Dropoff" value={proposal.dropoff_address} icon="➤" />
            )}
            {proposal.route_summary && (
              <Row label="Route" value={proposal.route_summary} />
            )}
            {proposal.eta_min != null && proposal.eta_max != null && (
              <Row
                label="ETA"
                value={`${proposal.eta_min}–${proposal.eta_max} minutes`}
              />
            )}
            {proposal.driver_area && (
              <Row label="Driver area" value={proposal.driver_area} />
            )}
            {proposal.notes && (
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                {proposal.notes}
              </div>
            )}
          </div>
        </div>

        {/* Accept / status */}
        {isAccepted ? (
          <div className="bg-emerald-50 ring-1 ring-emerald-200 rounded-2xl p-5 text-center">
            <div className="text-2xl mb-2">✓</div>
            <div className="text-sm font-bold text-emerald-800">
              Quote Accepted
            </div>
            <div className="text-xs text-emerald-600 mt-1">
              {proposal.accepted_at
                ? `Confirmed ${new Date(proposal.accepted_at).toLocaleString()}`
                : "Confirmed"}
            </div>
            <div className="text-xs text-emerald-600 mt-2">
              Your driver is being dispatched. We&apos;ll call you shortly.
            </div>
          </div>
        ) : isExpired ? (
          <div className="bg-slate-100 ring-1 ring-slate-200 rounded-2xl p-5 text-center">
            <div className="text-sm font-bold text-slate-700">
              This quote has expired
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Call us for an updated quote.
            </div>
          </div>
        ) : (
          <AcceptButton token={token} />
        )}

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-400 pt-4">
          Portland Car Towing · Affordable Car Towing LLC
          <br />
          By accepting you agree to the quoted price for the service described
          above.
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-slate-400 w-[80px] shrink-0 text-xs font-semibold uppercase tracking-wider pt-0.5">
        {label}
      </span>
      <span className="text-slate-900 font-medium">
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </span>
    </div>
  );
}
