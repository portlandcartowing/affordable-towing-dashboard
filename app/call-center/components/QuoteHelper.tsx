"use client";

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Per-service pricing model. Each service declares which inputs it actually
// uses so the UI doesn't show irrelevant fields. Rates are realistic for a
// Portland-area local towing/roadside business.
// ---------------------------------------------------------------------------

type ServiceKey =
  | "Tow"
  | "Jump Start"
  | "Lockout"
  | "Tire Change"
  | "Fuel Delivery";

type ServiceConfig = {
  base: number;
  mileage_rate: number; // 0 = no mileage
  allows_non_runner: boolean;
  allows_after_hours: boolean;
  extra_label?: string;   // e.g. "Gallons", "Distance"
  extra_rate?: number;    // per-unit rate for extra_label
  extra_default?: number;
};

const SERVICES: Record<ServiceKey, ServiceConfig> = {
  "Tow": {
    base: 95,
    mileage_rate: 4,
    allows_non_runner: true,
    allows_after_hours: true,
  },
  "Jump Start": {
    base: 65,
    mileage_rate: 0,
    allows_non_runner: false,
    allows_after_hours: true,
  },
  "Lockout": {
    base: 75,
    mileage_rate: 0,
    allows_non_runner: false,
    allows_after_hours: true,
  },
  "Tire Change": {
    base: 85,
    mileage_rate: 0,
    allows_non_runner: false,
    allows_after_hours: true,
  },
  "Fuel Delivery": {
    base: 65,
    mileage_rate: 0,
    allows_non_runner: false,
    allows_after_hours: true,
    extra_label: "Gallons",
    extra_rate: 6,
    extra_default: 3,
  },
};

const NON_RUNNER_FEE = 30;
const AFTER_HOURS_FEE = 45;

export type QuoteHelperState = {
  service_type: string;
  quote_base: number;
  quote_mileage: number;
  quote_non_runner: boolean;
  quote_after_hours: boolean;
  final_quote: number | null;
};

export default function QuoteHelper({
  state,
  onChange,
  onSendToJob,
}: {
  state: QuoteHelperState;
  onChange: (patch: Partial<QuoteHelperState>) => void;
  onSendToJob: (finalQuote: number) => void;
}) {
  const service = (SERVICES as Record<string, ServiceConfig>)[state.service_type] ??
    SERVICES["Tow"];

  const estimate = useMemo(() => {
    let total = state.quote_base;
    if (service.mileage_rate > 0) {
      total += state.quote_mileage * service.mileage_rate;
    }
    if (service.extra_rate != null) {
      total += state.quote_mileage * service.extra_rate;
    }
    if (service.allows_non_runner && state.quote_non_runner)
      total += NON_RUNNER_FEE;
    if (service.allows_after_hours && state.quote_after_hours)
      total += AFTER_HOURS_FEE;
    return total;
  }, [state, service]);

  const handleService = (key: string) => {
    const next = (SERVICES as Record<string, ServiceConfig>)[key] ?? SERVICES.Tow;
    onChange({
      service_type: key,
      quote_base: next.base,
      quote_mileage: next.extra_default ?? 0,
      quote_non_runner: false,
      quote_after_hours: state.quote_after_hours, // after-hours carries over
    });
  };

  const input =
    "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 tabular-nums";
  const label =
    "block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5";

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
          Quote Helper
        </h3>
        <span className="text-[9px] uppercase tracking-wider text-slate-400">
          live estimate
        </span>
      </div>

      {/* Service tabs — one tap select */}
      <div className="grid grid-cols-5 gap-1 mb-3">
        {(Object.keys(SERVICES) as ServiceKey[]).map((key) => {
          const active = state.service_type === key;
          // Compact label: first word only for long ones
          const short = key === "Jump Start" ? "Jump" : key === "Tire Change" ? "Tire" : key === "Fuel Delivery" ? "Fuel" : key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleService(key)}
              className={`px-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              title={key}
            >
              {short}
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Base</label>
            <input
              type="number"
              className={input}
              value={state.quote_base}
              onChange={(e) =>
                onChange({ quote_base: Number(e.target.value) || 0 })
              }
            />
          </div>
          {service.mileage_rate > 0 ? (
            <div>
              <label className={label}>Miles · ${service.mileage_rate}/mi</label>
              <input
                type="number"
                className={input}
                value={state.quote_mileage}
                onChange={(e) =>
                  onChange({ quote_mileage: Number(e.target.value) || 0 })
                }
              />
            </div>
          ) : service.extra_rate != null ? (
            <div>
              <label className={label}>
                {service.extra_label} · ${service.extra_rate}/ea
              </label>
              <input
                type="number"
                className={input}
                value={state.quote_mileage}
                onChange={(e) =>
                  onChange({ quote_mileage: Number(e.target.value) || 0 })
                }
              />
            </div>
          ) : (
            <div className="flex items-end">
              <div className="w-full text-[10px] text-slate-400 italic pb-2">
                Flat rate service
              </div>
            </div>
          )}
        </div>

        {(service.allows_non_runner || service.allows_after_hours) && (
          <div className="grid grid-cols-2 gap-2">
            {service.allows_non_runner ? (
              <Toggle
                label="Non-runner"
                fee={NON_RUNNER_FEE}
                value={state.quote_non_runner}
                onChange={(v) => onChange({ quote_non_runner: v })}
              />
            ) : (
              <div />
            )}
            {service.allows_after_hours && (
              <Toggle
                label="After hours"
                fee={AFTER_HOURS_FEE}
                value={state.quote_after_hours}
                onChange={(v) => onChange({ quote_after_hours: v })}
              />
            )}
          </div>
        )}

        <div className="bg-slate-900 text-white rounded-xl px-3 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
              Estimate
            </div>
            <div className="text-2xl font-bold tabular-nums leading-tight">
              ${estimate}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ final_quote: estimate })}
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            Use
          </button>
        </div>

        <div>
          <label className={label}>Final Quote</label>
          <div className="flex gap-1.5">
            <input
              type="number"
              className={`${input} flex-1`}
              value={state.final_quote ?? ""}
              placeholder="0"
              onChange={(e) =>
                onChange({
                  final_quote:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <button
              type="button"
              disabled={state.final_quote == null}
              onClick={() =>
                state.final_quote != null && onSendToJob(state.final_quote)
              }
              className="px-2.5 py-1.5 text-[11px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 whitespace-nowrap"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  fee,
  value,
  onChange,
}: {
  label: string;
  fee: number;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
        value
          ? "bg-blue-50 border-blue-300 text-blue-700"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span>{label}</span>
      <span className="text-[10px] tabular-nums opacity-70">+${fee}</span>
    </button>
  );
}
