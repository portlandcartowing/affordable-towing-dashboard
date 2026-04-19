"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, Session } from "@supabase/supabase-js";
import { parseTranscript } from "@/lib/transcriptParser";
import {
  dispatchBooked,
  dispatchStandby,
  dispatchLost,
} from "@/app/call-center/actions";
import type { LostReason } from "@/lib/types";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Supabase (browser-side)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sbClient = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type CallRecord = {
  id: string;
  caller_phone: string | null;
  source: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  transcript_chunks: { speaker: string; text: string; at: string }[] | null;
  disposition: string | null;
  notes: string | null;
  quoted_price: number | null;
};

type ExtractedInfo = {
  service: string | null;
  pickup: string | null;
  dropoff: string | null;
  vehicle: string | null;
  urgency: string | null;
};

type ScreenState = "idle" | "active" | "result";

// ---------------------------------------------------------------------------
// Pricing defaults
// ---------------------------------------------------------------------------
const DEFAULT_HOOKUP_FEE = 95;
const DEFAULT_RATE_PER_MILE = 4;
const NON_RUNNER_FEE = 30;

// ---------------------------------------------------------------------------
// Upsert driver row after sign-in
// ---------------------------------------------------------------------------
async function upsertDriver(session: Session) {
  const user = session.user;
  await sbClient.from("drivers").upsert(
    {
      id: user.id,
      name: user.user_metadata?.full_name || user.email,
      status: "available",
    },
    { onConflict: "id" },
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DriverClient() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    sbClient.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.replace("/driver/login"); return; }
      setSession(s);
      upsertDriver(s);
    });
    const { data: { subscription } } = sbClient.auth.onAuthStateChange((_event, s) => {
      if (!s) { router.replace("/driver/login"); return; }
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const [screen, setScreen] = useState<ScreenState>("idle");
  const [call, setCall] = useState<CallRecord | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInfo>({
    service: null, pickup: null, dropoff: null, vehicle: null, urgency: null,
  });
  const [miles, setMiles] = useState(0);
  const [nonRunner, setNonRunner] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [resultTimer, setResultTimer] = useState(10);
  const [resultDone, setResultDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [hookupFee, setHookupFee] = useState(DEFAULT_HOOKUP_FEE);
  const [ratePerMile, setRatePerMile] = useState(DEFAULT_RATE_PER_MILE);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const estimate = hookupFee + miles * ratePerMile + (nonRunner ? NON_RUNNER_FEE : 0);

  // ---- Fetch driver profile (pricing) ----
  useEffect(() => {
    if (!session) return;
    sbClient
      .from("drivers")
      .select("hookup_fee, rate_per_mile")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.hookup_fee != null) setHookupFee(data.hookup_fee);
          if (data.rate_per_mile != null) setRatePerMile(data.rate_per_mile);
        }
      });
  }, [session]);

  // ---- Register service worker + push subscription ----
  useEffect(() => {
    if (!session) return;

    async function setupPush() {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }

      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;

          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (vapidKey && Notification.permission === "granted") {
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidKey,
              });
            }

            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription: sub.toJSON(),
                driver_id: session!.user.id,
              }),
            });
          }
        } catch (err) {
          console.error("Push setup error:", err);
        }
      }
    }

    setupPush();
  }, [session]);

  // ---- On app open: check for any active call from the last 5 minutes ----
  useEffect(() => {
    if (!session) return;

    async function checkActiveCall() {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data } = await sbClient
        .from("calls")
        .select("*")
        .is("disposition", null)
        .gte("started_at", fiveMinAgo)
        .order("started_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const activeCall = data[0] as CallRecord;
        setCall(activeCall);
        setScreen("active");
        if (activeCall.transcript) {
          const parsed = parseTranscript(activeCall.transcript);
          setExtracted({
            service: parsed.service_type,
            pickup: parsed.pickup_city,
            dropoff: parsed.dropoff_city,
            vehicle: parsed.vehicle,
            urgency: parsed.urgency,
          });
        }
      }
    }

    checkActiveCall();
  }, [session]);

  // ---- Supabase Realtime: watch for new calls + transcript updates ----
  useEffect(() => {
    const channel = sbClient
      .channel("driver-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        (payload) => {
          const newCall = payload.new as CallRecord;
          if (newCall.disposition === "spam") return;

          // New call came in — switch to active screen
          setCall(newCall);
          setScreen("active");
          setElapsed(0);
          setExtracted({ service: null, pickup: null, dropoff: null, vehicle: null, urgency: null });
          setMiles(0);
          setNonRunner(false);
          setCustomerName("");
          setNotes("");
          setResultDone(false);

          // Parse transcript if available
          if (newCall.transcript) {
            const parsed = parseTranscript(newCall.transcript);
            setExtracted({
              service: parsed.service_type,
              pickup: parsed.pickup_city,
              dropoff: parsed.dropoff_city,
              vehicle: parsed.vehicle,
              urgency: parsed.urgency,
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const updated = payload.new as CallRecord;
          setCall((prev) => {
            if (!prev || prev.id !== updated.id) return prev;
            return updated;
          });
          if (updated.transcript) {
            const parsed = parseTranscript(updated.transcript);
            setExtracted((prev) => ({
              service: parsed.service_type || prev.service,
              pickup: parsed.pickup_city || prev.pickup,
              dropoff: parsed.dropoff_city || prev.dropoff,
              vehicle: parsed.vehicle || prev.vehicle,
              urgency: parsed.urgency || prev.urgency,
            }));
          }
        },
      )
      .subscribe();

    return () => { sbClient.removeChannel(channel); };
  }, []);

  // ---- Call duration timer ----
  useEffect(() => {
    if (screen === "active") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen]);

  // ---- Result countdown ----
  useEffect(() => {
    if (screen !== "result") return;
    setResultTimer(10);
    const t = setInterval(() => {
      setResultTimer((prev) => {
        if (prev <= 1) { clearInterval(t); setResultDone(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ---- Sign out ----
  const handleSignOut = async () => {
    await sbClient.auth.signOut();
    router.replace("/driver/login");
  };

  // ---- Disposition handlers ----
  const handleBooked = useCallback(async () => {
    if (!call) return;
    setScreen("result");
    await dispatchBooked(call.id, {
      customer: customerName || null,
      phone: call.caller_phone,
      service: extracted.service,
      pickup_city: extracted.pickup,
      dropoff_city: extracted.dropoff,
      vehicle_year: null,
      vehicle_make: null,
      vehicle_model: null,
      price: estimate,
      notes,
    });
    showToast("Job booked!");
  }, [call, customerName, extracted, estimate, notes]);

  const handleStandby = useCallback(async () => {
    if (!call || !call.caller_phone) return;
    setScreen("result");
    await dispatchStandby(call.id, {
      customer: customerName || null,
      phone: call.caller_phone,
      service: extracted.service,
      pickup_address: extracted.pickup,
      dropoff_address: extracted.dropoff,
      vehicle_desc: extracted.vehicle,
      quoted_price: estimate,
      eta_min: 20,
      eta_max: 35,
      driver_area: "Portland area",
      notes,
    });
    showToast("Proposal sent!");
  }, [call, customerName, extracted, estimate, notes]);

  const handleLost = useCallback(async () => {
    if (!call) return;
    setScreen("result");
    await dispatchLost(call.id, "Shopping around" as LostReason, estimate);
    showToast("Call lost");
  }, [call, estimate]);

  const handleReset = () => {
    setScreen("idle");
    setCall(null);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // =====================================================================
  // AUTH LOADING
  // =====================================================================
  if (session === undefined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  // =====================================================================
  // IDLE SCREEN — waiting for calls
  // =====================================================================
  if (screen === "idle") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-slate-900">
        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-6">
          <span className="text-3xl">🎧</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">ACT Dispatch</h1>
        <p className="text-slate-400 text-sm mb-2">
          {session?.user?.user_metadata?.full_name || "Driver"}
        </p>
        <p className="text-slate-500 text-xs mb-8">
          Open this app during a call to see live info
        </p>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm text-emerald-400 font-medium">Online — listening</span>
        </div>

        {/* Quick stats */}
        <div className="mt-12 w-full max-w-xs space-y-2">
          <div className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Hookup fee</span>
            <span className="text-sm font-bold tabular-nums">${hookupFee}</span>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Per mile</span>
            <span className="text-sm font-bold tabular-nums">${ratePerMile}/mi</span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-8 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  // =====================================================================
  // RESULT SCREEN — 10 second post-call
  // =====================================================================
  if (screen === "result") {
    const disp = call?.disposition;
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-slate-900">
        <div className="text-6xl mb-6">
          {disp === "booked" ? "✅" : disp === "standby" ? "📤" : "❌"}
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {disp === "booked" ? "Job Booked!" : disp === "standby" ? "Proposal Sent" : "Call Lost"}
        </h1>
        {disp === "booked" && (
          <p className="text-emerald-400 text-lg font-bold mb-4">${estimate}</p>
        )}
        {disp === "standby" && (
          <p className="text-amber-400 text-sm mb-4 text-center max-w-xs">
            Customer will receive a text with your quote and accept button.
          </p>
        )}
        {!resultDone ? (
          <div className="mt-8">
            <div className="text-slate-500 text-sm mb-2">Screen resets in</div>
            <div className="text-4xl font-bold tabular-nums">{resultTimer}s</div>
          </div>
        ) : (
          <button
            onClick={handleReset}
            className="mt-8 px-8 py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold active:scale-95"
          >
            Ready for Next Call
          </button>
        )}
      </div>
    );
  }

  // =====================================================================
  // ACTIVE CALL SCREEN — live CRM data overlay
  // =====================================================================
  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900 overflow-y-auto overscroll-none">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Live Call</span>
          </div>
          <div className="text-xl font-bold tabular-nums mt-0.5">{call?.caller_phone || "Unknown"}</div>
          <div className="text-xs opacity-70">{call?.source || "unknown"} source</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{formatTime(elapsed)}</div>
        </div>
      </div>

      {/* Transcript */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Live Transcript</span>
          <span className="text-[10px] text-blue-400 font-medium">
            {call?.transcript_chunks?.length || 0} lines
          </span>
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1.5 text-sm">
          {(!call?.transcript_chunks || call.transcript_chunks.length === 0) ? (
            <div className="text-slate-500 text-xs italic">
              {call?.transcript
                ? call.transcript.slice(0, 200)
                : "Transcript will appear as you talk…"}
            </div>
          ) : (
            call.transcript_chunks.map((chunk, i) => (
              <div key={i} className="flex gap-2">
                <span className={`text-[10px] font-bold uppercase w-[60px] shrink-0 ${
                  chunk.speaker === "caller" ? "text-slate-400" : "text-blue-400"
                }`}>
                  {chunk.speaker === "caller" ? "Caller" : "You"}
                </span>
                <span className="text-slate-200">{chunk.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Auto-detected info */}
      <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700 shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">Auto-Detected</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <InfoChip label="Service" value={extracted.service} />
          <InfoChip label="Pickup" value={extracted.pickup} />
          <InfoChip label="Dropoff" value={extracted.dropoff} />
          <InfoChip label="Vehicle" value={extracted.vehicle} />
        </div>
      </div>

      {/* Customer name */}
      <div className="px-4 py-3 border-b border-slate-700 shrink-0">
        <input
          type="text"
          placeholder="Customer name…"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quote calculator */}
      <div className="px-4 py-4 border-b border-slate-700 shrink-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">Quote</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase mb-1 block">Miles</label>
            <input
              type="number"
              inputMode="decimal"
              value={miles || ""}
              onChange={(e) => setMiles(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase mb-1 block">Non-runner</label>
            <button
              onClick={() => setNonRunner(!nonRunner)}
              className={`w-full px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                nonRunner
                  ? "bg-amber-500 text-white border border-amber-400"
                  : "bg-slate-800 text-slate-400 border border-slate-600"
              }`}
            >
              {nonRunner ? "YES +$30" : "NO"}
            </button>
          </div>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">
              ${hookupFee} + {miles}mi × ${ratePerMile}{nonRunner ? ` + $${NON_RUNNER_FEE}` : ""}
            </div>
            <div className="text-3xl font-bold text-emerald-400 tabular-nums mt-1">${estimate}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase">ETA</div>
            <div className="text-2xl font-bold tabular-nums">
              {miles > 0 ? `${Math.round(miles * 2.5)}m` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 py-3 border-b border-slate-700 shrink-0">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes…"
          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* 3 ACTION BUTTONS */}
      <div className="p-4 mt-auto shrink-0">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleBooked}
            className="py-5 rounded-2xl bg-emerald-600 active:bg-emerald-500 text-white text-center font-bold text-lg active:scale-95 transition-transform"
          >
            <div className="text-2xl mb-1">✓</div>Booked
          </button>
          <button
            onClick={handleStandby}
            className="py-5 rounded-2xl bg-amber-500 active:bg-amber-400 text-white text-center font-bold text-lg active:scale-95 transition-transform"
          >
            <div className="text-2xl mb-1">⏳</div>Standby
          </button>
          <button
            onClick={handleLost}
            className="py-5 rounded-2xl bg-rose-600 active:bg-rose-500 text-white text-center font-bold text-lg active:scale-95 transition-transform"
          >
            <div className="text-2xl mb-1">✕</div>Lost
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-semibold shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={`px-2.5 py-1.5 rounded-lg ${value ? "bg-blue-900/40 border border-blue-700/50" : "bg-slate-800 border border-slate-700"}`}>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-medium truncate ${value ? "text-blue-300" : "text-slate-600"}`}>{value || "—"}</div>
    </div>
  );
}
