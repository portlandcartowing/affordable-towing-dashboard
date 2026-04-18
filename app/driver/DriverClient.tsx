"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { parseTranscript } from "@/lib/transcriptParser";
import {
  dispatchBooked,
  dispatchStandby,
  dispatchLost,
} from "@/app/call-center/actions";
import type { LostReason } from "@/lib/types";

// ---------------------------------------------------------------------------
// Supabase Realtime client (browser-side, separate from server client)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const realtime = createClient(supabaseUrl, supabaseKey);

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

type ScreenState = "idle" | "live" | "result";

// ---------------------------------------------------------------------------
// Pricing config
// ---------------------------------------------------------------------------
const HOOKUP_FEE = 95;
const RATE_PER_MILE = 4;
const NON_RUNNER_FEE = 30;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DriverClient() {
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate estimate
  const estimate = HOOKUP_FEE + miles * RATE_PER_MILE + (nonRunner ? NON_RUNNER_FEE : 0);

  // ---- Supabase Realtime: watch for new calls ----
  useEffect(() => {
    const channel = realtime
      .channel("driver-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        (payload) => {
          const newCall = payload.new as CallRecord;
          if (newCall.disposition === "spam") return;
          setCall(newCall);
          setScreen("live");
          setElapsed(0);
          setExtracted({ service: null, pickup: null, dropoff: null, vehicle: null, urgency: null });
          setMiles(0);
          setNonRunner(false);
          setCustomerName("");
          setNotes("");
          setResultDone(false);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const updated = payload.new as CallRecord;
          if (call && updated.id === call.id) {
            setCall(updated);
            // Re-extract from transcript
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
          }
        },
      )
      .subscribe();

    return () => {
      realtime.removeChannel(channel);
    };
  }, [call?.id]);

  // ---- Call duration timer ----
  useEffect(() => {
    if (screen === "live") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen]);

  // ---- Result screen 10-second countdown ----
  useEffect(() => {
    if (screen !== "result") return;
    setResultTimer(10);
    const t = setInterval(() => {
      setResultTimer((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          setResultDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ---- Action handlers ----
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
    showToast("Proposal sent to customer");
  }, [call, customerName, extracted, estimate, notes]);

  const handleLost = useCallback(async () => {
    if (!call) return;
    setScreen("result");
    await dispatchLost(call.id, "Shopping around" as LostReason, estimate);
    showToast("Call marked lost");
  }, [call, estimate]);

  const handleReset = () => {
    setScreen("idle");
    setCall(null);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // =====================================================================
  // IDLE SCREEN — waiting for calls
  // =====================================================================
  if (screen === "idle") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mb-6">
          <span className="text-3xl">🎧</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">ACT Dispatch</h1>
        <p className="text-slate-400 text-sm mb-8">Waiting for incoming calls…</p>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm text-emerald-400 font-medium">Online — listening</span>
        </div>
      </div>
    );
  }

  // =====================================================================
  // RESULT SCREEN — 10 second post-call
  // =====================================================================
  if (screen === "result") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-6">
          {call?.disposition === "booked" ? "✅" : call?.disposition === "standby" ? "📤" : "❌"}
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {call?.disposition === "booked"
            ? "Job Booked!"
            : call?.disposition === "standby"
            ? "Proposal Sent"
            : "Call Lost"}
        </h1>
        {call?.disposition === "booked" && (
          <p className="text-emerald-400 text-lg font-bold mb-4">${estimate}</p>
        )}
        {call?.disposition === "standby" && (
          <p className="text-amber-400 text-sm mb-4">
            Customer will receive a text with your quote and an accept button.
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
            className="mt-8 px-8 py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold"
          >
            Ready for Next Call
          </button>
        )}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-semibold shadow-xl">
            {toast}
          </div>
        )}
      </div>
    );
  }

  // =====================================================================
  // LIVE CALL SCREEN — the core experience
  // =====================================================================
  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- Header: caller + timer ---- */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Live Call</span>
          </div>
          <div className="text-xl font-bold tabular-nums mt-0.5">
            {call?.caller_phone || "Unknown"}
          </div>
          <div className="text-xs opacity-70">
            {call?.source || "unknown"} source
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums">{formatTime(elapsed)}</div>
        </div>
      </div>

      {/* ---- Live transcript ---- */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Live Transcript
          </span>
          <span className="text-[10px] text-blue-400 font-medium">
            {call?.transcript_chunks?.length || 0} lines
          </span>
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1.5 text-sm">
          {(!call?.transcript_chunks || call.transcript_chunks.length === 0) ? (
            <div className="text-slate-500 text-xs italic">
              Transcript will appear here as you talk…
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

      {/* ---- Extracted info ---- */}
      <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
          Auto-Detected
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <InfoChip label="Service" value={extracted.service} />
          <InfoChip label="Pickup" value={extracted.pickup} />
          <InfoChip label="Dropoff" value={extracted.dropoff} />
          <InfoChip label="Vehicle" value={extracted.vehicle} />
        </div>
      </div>

      {/* ---- Customer name (manual) ---- */}
      <div className="px-4 py-3 border-b border-slate-700">
        <input
          type="text"
          placeholder="Customer name…"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* ---- Quote calculator ---- */}
      <div className="px-4 py-4 border-b border-slate-700">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">
          Quote
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase mb-1 block">Miles</label>
            <input
              type="number"
              value={miles}
              onChange={(e) => setMiles(Number(e.target.value) || 0)}
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
            <div className="text-[10px] text-slate-500 uppercase">Hookup ${HOOKUP_FEE} + {miles}mi × ${RATE_PER_MILE}{nonRunner ? ` + $${NON_RUNNER_FEE}` : ""}</div>
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

      {/* ---- Notes ---- */}
      <div className="px-4 py-3 border-b border-slate-700">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for this call…"
          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* ---- 3 ACTION BUTTONS ---- */}
      <div className="p-4 mt-auto">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleBooked}
            className="py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-center font-bold text-lg transition-colors active:scale-95"
          >
            <div className="text-2xl mb-1">✓</div>
            Booked
          </button>
          <button
            onClick={handleStandby}
            className="py-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white text-center font-bold text-lg transition-colors active:scale-95"
          >
            <div className="text-2xl mb-1">⏳</div>
            Standby
          </button>
          <button
            onClick={handleLost}
            className="py-5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-center font-bold text-lg transition-colors active:scale-95"
          >
            <div className="text-2xl mb-1">✕</div>
            Lost
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

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function InfoChip({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={`px-2.5 py-1.5 rounded-lg ${value ? "bg-blue-900/40 border border-blue-700/50" : "bg-slate-800 border border-slate-700"}`}>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-medium truncate ${value ? "text-blue-300" : "text-slate-600"}`}>
        {value || "—"}
      </div>
    </div>
  );
}
