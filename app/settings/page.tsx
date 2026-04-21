import Topbar from "@/components/dashboard/Topbar";
import { AVAILABLE_PROVIDERS } from "@/lib/loadBoard";
import { AVAILABLE_CALL_PROVIDERS } from "@/lib/callTracking";
import { getTrackingNumbers } from "@/lib/trackingNumbers";
import TrackingNumberRow from "./TrackingNumberRow";

export const revalidate = 30;

export default async function SettingsPage() {
  const trackingNumbers = await getTrackingNumbers();

  return (
    <>
      <Topbar title="Settings" subtitle="Integrations and account" />
      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-3xl">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-900">Company</h3>
          <p className="text-xs text-slate-500 mt-0.5">Basic business details.</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Business name</span>
              <span className="font-medium text-slate-900">Affordable Car Towing / Portland Car Towing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Service area</span>
              <span className="font-medium text-slate-900">Portland metro, OR</span>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-900">Tracking Numbers</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Each number maps to a source for call attribution. Click a source to rename it — new calls will use the updated name.
          </p>
          <ul className="mt-4 divide-y divide-slate-100">
            {trackingNumbers.length === 0 ? (
              <li className="py-3 text-sm text-slate-400">
                No tracking numbers configured. Add them in Supabase.
              </li>
            ) : (
              trackingNumbers.map((tn) => (
                <TrackingNumberRow key={tn.id} tn={tn} />
              ))
            )}
          </ul>
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-900">Integrations</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            External services this CRM can connect to.
          </p>
          <ul className="mt-4 divide-y divide-slate-100">
            <li className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Supabase</div>
                <div className="text-xs text-slate-500">Database & auth</div>
              </div>
              <span className="text-xs font-medium text-emerald-600">Connected</span>
            </li>
            <li className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Google Ads</div>
                <div className="text-xs text-slate-500">Daily spend sync</div>
              </div>
              <span className="text-xs font-medium text-slate-400">Not connected</span>
            </li>
            {AVAILABLE_CALL_PROVIDERS.map((p) => (
              <li key={p.value} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-500">Call tracking</div>
                </div>
                <span className="text-xs font-medium text-slate-400">Not connected</span>
              </li>
            ))}
            {AVAILABLE_PROVIDERS.map((p) => (
              <li key={p.value} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-500">Load board</div>
                </div>
                <span className="text-xs font-medium text-slate-400">Not connected</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
