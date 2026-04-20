"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import QueuePanel from "./components/QueuePanel";
import TranscriptPanel from "./components/TranscriptPanel";
import MessagesPanel from "./components/MessagesPanel";
import CopilotPanel from "./components/CopilotPanel";
import ExtractedFieldsPanel from "./components/ExtractedFieldsPanel";
import QuoteHelper, { type QuoteHelperState } from "./components/QuoteHelper";
import CallActions from "./components/CallActions";
import CloseReadiness, { getReadiness } from "./components/CloseReadiness";
import NotesPanel from "./components/NotesPanel";
import { LostReasonModal, CallbackModal } from "./components/Modals";
import {
  DriverNotificationPreview,
  CustomerConfirmationPreview,
  PostCallSummary,
} from "./components/Previews";
import StatusBadge from "./components/StatusBadge";
import { deriveExtractedFields } from "./extract";
import { mapCallToCallCenter } from "./mapCall";
import {
  dispatchBooked,
  dispatchLost,
  dispatchCallback,
  sendConfirmationText,
} from "./actions";
import type { CallCenterCall, CallCenterStatus, LostReason } from "./types";
import type { Call } from "@/lib/types";

type Props = { initialCalls: CallCenterCall[] };
type CallMap = Record<string, CallCenterCall>;

function toMap(calls: CallCenterCall[]): CallMap {
  return Object.fromEntries(calls.map((c) => [c.id, c]));
}

// ---------------------------------------------------------------------------
// Supabase client for realtime — runs in the browser
// ---------------------------------------------------------------------------
function getRealtimeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CallCenterClient({ initialCalls }: Props) {
  const [calls, setCalls] = useState<CallMap>(() => toMap(initialCalls));
  const [selectedId, setSelectedId] = useState<string>(
    () => initialCalls.find((c) => c.status === "live")?.id ?? initialCalls[0]?.id ?? "",
  );
  const [showLostModal, setShowLostModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const selected = calls[selectedId];
  const callList = useMemo(
    () =>
      Object.values(calls).sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      ),
    [calls],
  );

  const patch = useCallback(
    (id: string, updater: (c: CallCenterCall) => CallCenterCall) => {
      setCalls((prev) => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: updater(prev[id]) };
      });
    },
    [],
  );

  // ---- Supabase realtime: listen for new/updated calls ----
  useEffect(() => {
    const client = getRealtimeClient();

    const channel = client
      .channel("call-center-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        (payload) => {
          const newCall = mapCallToCallCenter(payload.new as Call);
          setCalls((prev) => ({ [newCall.id]: newCall, ...prev }));
          // Auto-select new live calls
          setSelectedId(newCall.id);
          showToast("New call incoming");
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        (payload) => {
          const updated = payload.new as Call;
          setCalls((prev) => {
            if (!prev[updated.id]) return prev;
            const existing = prev[updated.id];
            const mapped = mapCallToCallCenter(updated);
            // Preserve local state that hasn't been persisted yet
            return {
              ...prev,
              [updated.id]: {
                ...mapped,
                // Keep local quote state if not yet persisted
                quote_base: existing.quote_base,
                quote_mileage: existing.quote_mileage,
                quote_non_runner: existing.quote_non_runner,
                quote_after_hours: existing.quote_after_hours,
                // Keep local notes if the server hasn't updated them
                notes: mapped.notes || existing.notes,
                // Re-derive extracted fields from updated transcript
                extracted: mapped.transcript.length > existing.transcript.length
                  ? deriveExtractedFields(mapped.transcript, existing.extracted)
                  : existing.extracted,
              },
            };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { from_number: string; body: string };
          // Show toast for incoming texts
          if (msg.from_number && msg.body) {
            showToast(`SMS from ${msg.from_number}: ${msg.body.slice(0, 50)}`);
          }
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quoteState: QuoteHelperState | null = selected
    ? {
        service_type: selected.extracted.service_type.value ?? "Tow",
        quote_base: selected.quote_base,
        quote_mileage: selected.quote_mileage,
        quote_non_runner: selected.quote_non_runner,
        quote_after_hours: selected.quote_after_hours,
        final_quote: selected.final_quote,
      }
    : null;

  const handleQuoteChange = (patchState: Partial<QuoteHelperState>) => {
    if (!selected) return;
    patch(selected.id, (c) => ({
      ...c,
      quote_base: patchState.quote_base ?? c.quote_base,
      quote_mileage: patchState.quote_mileage ?? c.quote_mileage,
      quote_non_runner: patchState.quote_non_runner ?? c.quote_non_runner,
      quote_after_hours: patchState.quote_after_hours ?? c.quote_after_hours,
      final_quote:
        patchState.final_quote !== undefined
          ? patchState.final_quote
          : c.final_quote,
      extracted: patchState.service_type
        ? {
            ...c.extracted,
            service_type: {
              value: patchState.service_type,
              confidence: "high" as const,
            },
          }
        : c.extracted,
    }));
  };

  const handleSendToJob = (finalQuote: number) => {
    if (!selected) return;
    patch(selected.id, (c) => ({
      ...c,
      final_quote: finalQuote,
      extracted: {
        ...c.extracted,
        quoted_price: { value: finalQuote, confidence: "high" as const },
      },
    }));
    showToast(`Final quote $${finalQuote} locked in`);
  };

  const handleNotesChange = (value: string) => {
    if (!selected) return;
    patch(selected.id, (c) => ({ ...c, notes: value }));
  };

  const setStatus = (id: string, status: CallCenterStatus) =>
    patch(id, (c) => ({ ...c, status }));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const readiness = selected ? getReadiness(selected) : null;

  // ---------------------------------------------------------------------------
  // Action handlers — wired to real server actions
  // ---------------------------------------------------------------------------
  const handlers = selected
    ? {
        onMarkQuoted: () => {
          setStatus(selected.id, "quoted");
          showToast("Marked as quoted");
        },

        onBookJob: async () => {
          if (actionPending) return;
          setActionPending(true);
          const e = selected.extracted;
          const result = await dispatchBooked(selected.id, {
            customer: e.customer_name.value,
            phone: e.callback_phone.value,
            service: e.service_type.value,
            pickup_city: e.pickup_address.value,
            dropoff_city: e.dropoff_address.value,
            vehicle_year: e.vehicle_year.value ? parseInt(e.vehicle_year.value) : null,
            vehicle_make: e.vehicle_make.value,
            vehicle_model: e.vehicle_model.value,
            price: selected.final_quote ?? e.quoted_price.value,
            notes: selected.notes,
          });
          setActionPending(false);

          if (result.ok) {
            patch(selected.id, (c) => ({
              ...c,
              status: "booked",
              extracted: {
                ...c.extracted,
                booked: { value: true, confidence: "high" as const },
              },
            }));
            showToast("Job booked + lead created");
          } else {
            showToast(`Error: ${result.error}`);
          }
        },

        onMarkLost: () => setShowLostModal(true),
        onSetCallback: () => setShowCallbackModal(true),

        onSendToDriver: () => {
          // TODO: Wire to push notification to driver
          showToast("Driver notification queued");
        },

        onSendConfirmation: async () => {
          const phone = selected.extracted.callback_phone.value;
          if (!phone) {
            showToast("No phone number to send to");
            return;
          }
          setActionPending(true);
          const result = await sendConfirmationText(
            phone,
            selected.extracted.customer_name.value,
            selected.final_quote ?? selected.extracted.quoted_price.value,
          );
          setActionPending(false);
          showToast(result.ok ? "Confirmation text sent" : `SMS failed: ${result.error}`);
        },

        onSaveNotes: async () => {
          // Save notes to Supabase directly
          const client = getRealtimeClient();
          await client
            .from("calls")
            .update({ notes: selected.notes })
            .eq("id", selected.id);
          showToast("Notes saved");
        },
      }
    : null;

  const confirmLost = async (reason: LostReason) => {
    if (!selected) return;
    setActionPending(true);
    const result = await dispatchLost(
      selected.id,
      reason as import("@/lib/types").LostReason,
      selected.final_quote ?? selected.extracted.quoted_price.value,
    );
    setActionPending(false);

    if (result.ok) {
      patch(selected.id, (c) => ({ ...c, status: "lost", lost_reason: reason }));
      setShowLostModal(false);
      showToast(`Lost · ${reason}`);
    } else {
      showToast("Error saving lost reason");
    }
  };

  const confirmCallback = async (iso: string) => {
    if (!selected) return;
    setActionPending(true);
    const result = await dispatchCallback(
      selected.id,
      iso,
      selected.extracted.callback_phone.value,
    );
    setActionPending(false);

    if (result.ok) {
      patch(selected.id, (c) => ({ ...c, status: "callback", callback_at: iso }));
      setShowCallbackModal(false);
      showToast(
        `Callback · ${new Date(iso).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      );
    } else {
      showToast("Error setting callback");
    }
  };

  const canBook = Boolean(
    readiness && (readiness.level === "ready" || readiness.level === "almost_ready"),
  );

  if (!selected || !quoteState || !handlers || !readiness) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="text-4xl">☎</div>
          <div className="text-lg font-semibold text-slate-700">No calls in queue</div>
          <div className="text-sm text-slate-500 max-w-sm">
            Inbound calls will appear here automatically when customers call your tracking numbers.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)] min-h-0 bg-slate-50">
      {/* ---------------- LEFT: QUEUE ---------------- */}
      <div className="xl:w-64 shrink-0 h-56 xl:h-full border-b xl:border-b-0 xl:border-r border-slate-200/70 min-h-0">
        <QueuePanel
          calls={callList}
          selectedId={selected.id}
          onSelect={setSelectedId}
        />
      </div>

      {/* ---------------- CENTER: WORKSPACE ---------------- */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto">
        <ActiveCallHeader call={selected} />

        <div className="flex-1 grid grid-cols-1 gap-3 p-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[300px]">
            <TranscriptPanel
              chunks={selected.transcript}
              status={selected.status}
            />
            <MessagesPanel
              callerPhone={selected.caller_phone}
              callId={selected.id}
            />
          </div>

          {(selected.status === "booked" || selected.status === "completed") && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <DriverNotificationPreview call={selected} />
                <CustomerConfirmationPreview call={selected} />
              </div>
              <PostCallSummary call={selected} />
            </>
          )}

          {selected.status === "lost" && <PostCallSummary call={selected} />}

          {selected.status === "callback" && selected.callback_at && (
            <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status="callback" size="md" />
                <span className="text-sm font-semibold text-slate-900">
                  Callback{" "}
                  {new Date(selected.callback_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Reminder fires in dispatcher inbox.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- RIGHT: OPERATOR TOOLS ---------------- */}
      <div className="xl:w-[340px] shrink-0 h-full min-h-0 border-t xl:border-t-0 xl:border-l border-slate-200/70 overflow-y-auto bg-slate-50">
        <div className="p-3 space-y-3">
          <CloseReadiness call={selected} />
          <CopilotPanel prompts={selected.copilot} />
          <ExtractedFieldsPanel fields={selected.extracted} />
          <QuoteHelper
            state={quoteState}
            onChange={handleQuoteChange}
            onSendToJob={handleSendToJob}
          />
          <NotesPanel value={selected.notes} onChange={handleNotesChange} />
          <CallActions
            status={selected.status}
            handlers={handlers}
            canBook={canBook}
          />
        </div>
      </div>

      {/* ---------------- MODALS ---------------- */}
      {showLostModal && (
        <LostReasonModal
          onCancel={() => setShowLostModal(false)}
          onConfirm={confirmLost}
        />
      )}
      {showCallbackModal && (
        <CallbackModal
          onCancel={() => setShowCallbackModal(false)}
          onConfirm={confirmCallback}
        />
      )}

      {/* ---------------- TOAST ---------------- */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveCallHeader
// ---------------------------------------------------------------------------

function ActiveCallHeader({ call }: { call: CallCenterCall }) {
  const e = call.extracted;
  const vehicle = [e.vehicle_year.value, e.vehicle_make.value, e.vehicle_model.value]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="border-b border-slate-200/70 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <StatusBadge status={call.status} pulse={call.status === "live"} size="md" />
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums leading-none truncate">
            {call.caller_phone}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {call.dispatcher ? `· ${call.dispatcher}` : ""} · {call.source}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold leading-none">
            Duration
          </div>
          <div className="text-base font-bold text-slate-900 tabular-nums leading-tight">
            {formatDuration(call.duration_seconds)}
          </div>
        </div>
      </div>

      {(e.service_type.value || e.pickup_address.value || vehicle) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {e.service_type.value && <Chip label={e.service_type.value} tone="blue" />}
          {vehicle && <Chip label={vehicle} />}
          {e.pickup_address.value && (
            <Chip label={`◉ ${e.pickup_address.value}`} />
          )}
          {e.dropoff_address.value && (
            <Chip label={`➤ ${e.dropoff_address.value}`} />
          )}
          {call.final_quote != null && (
            <Chip label={`$${call.final_quote}`} tone="emerald" />
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, tone = "slate" }: { label: string; tone?: "slate" | "blue" | "emerald" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium ${styles}`}>
      {label}
    </span>
  );
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
