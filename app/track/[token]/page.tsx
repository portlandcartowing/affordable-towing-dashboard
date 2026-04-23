"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type TrackData = {
  ok: boolean;
  firstName: string;
  status: string;
  active: boolean;
  completed: boolean;
  pickup: string;
  driver: { lat: number | null; lng: number | null; updated_at: string | null };
};

export default function TrackPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [data, setData] = useState<TrackData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`/api/track/${token}`, { cache: "no-store" });
      if (!resp.ok) {
        setErr(resp.status === 404 ? "Tracking link not found." : "Could not load tracking.");
        return;
      }
      const json = (await resp.json()) as TrackData;
      setData(json);
      setErr(null);
    } catch {
      setErr("Network error — retrying…");
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  // Humanized "last updated" string
  const updatedAgo = useMemo(() => {
    const ts = data?.driver.updated_at;
    if (!ts) return null;
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const min = Math.floor(seconds / 60);
    if (min < 60) return `${min} min ago`;
    return `${Math.floor(min / 60)}h ago`;
  }, [data]);

  const mapSrc =
    data?.driver.lat != null && data?.driver.lng != null
      ? `https://maps.google.com/maps?q=${data.driver.lat},${data.driver.lng}&z=14&output=embed`
      : null;

  if (err) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <div className="text-lg font-semibold text-slate-900">{err}</div>
          <div className="text-sm text-slate-500 mt-2">
            Double-check the link or contact ACT Dispatch.
          </div>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-sm text-slate-400">Loading…</div>
        </div>
      </Shell>
    );
  }

  if (data.completed) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <div className="text-xl font-bold text-slate-900">All done!</div>
          <div className="text-sm text-slate-600 mt-2">
            Your service is complete. Thanks for choosing ACT Dispatch.
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Status header */}
        <div className="px-6 pt-6 pb-4">
          <div className="text-xs uppercase tracking-wider font-semibold text-emerald-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {data.active ? "Driver en route" : "Preparing"}
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            Hi {data.firstName}!
          </div>
          <div className="text-sm text-slate-600 mt-1">
            Your ACT Dispatch driver is on the way to{" "}
            <span className="font-semibold text-slate-800">{data.pickup || "you"}</span>.
          </div>
        </div>

        {/* Map */}
        {mapSrc ? (
          <div className="aspect-[4/3] w-full border-t border-slate-100">
            <iframe
              key={mapSrc}
              src={mapSrc}
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Driver location"
            />
          </div>
        ) : (
          <div className="aspect-[4/3] w-full bg-slate-50 border-t border-slate-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">🚚</div>
              <div className="text-sm text-slate-600">
                {data.active ? "Driver location updating soon…" : "Driver hasn't started yet."}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              Last update
            </div>
            <div className="text-sm text-slate-900 font-medium">
              {updatedAgo || "—"}
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Updates every 15s · location shown is approximate
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 mt-4">
        Powered by ACT Dispatch · Affordable Car Towing
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-lg mx-auto shadow-lg">
            AT
          </div>
          <div className="text-sm font-semibold text-slate-700 mt-2">
            ACT Dispatch · Tracking
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
