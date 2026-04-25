// ---------------------------------------------------------------------------
// Job pricing — single source of truth for the math.
//
//   total        = hookup_fee + (rate_per_mile * miles) + adjustment
//   driver_pay   = total * (commission_pct / 100)
//   gross_profit = total - driver_pay
//
// Drivers cannot override `total` directly. They can record a per-job
// `adjustment` (positive or negative) plus a short note explaining why
// (winch-out, discount, etc) — that flows into the formula.
// ---------------------------------------------------------------------------

export interface JobPricingInputs {
  hookup_fee: number | null;
  rate_per_mile: number | null;
  miles: number | null;
  adjustment: number | null;
  commission_pct: number | null; // 0-100
}

export interface JobPricing {
  hookup: number;
  mileage: number;
  adjustment: number;
  total: number;
  driver_pay: number;
  gross_profit: number;
}

export function priceJob(inputs: JobPricingInputs): JobPricing {
  const hookup = num(inputs.hookup_fee);
  const ratePerMile = num(inputs.rate_per_mile);
  const miles = num(inputs.miles);
  const adjustment = num(inputs.adjustment);
  const commissionPct = clamp(num(inputs.commission_pct), 0, 100);

  const mileage = round2(ratePerMile * miles);
  const total = round2(hookup + mileage + adjustment);
  const driverPay = round2(total * (commissionPct / 100));
  const grossProfit = round2(total - driverPay);

  return {
    hookup,
    mileage,
    adjustment,
    total,
    driver_pay: driverPay,
    gross_profit: grossProfit,
  };
}

function num(v: number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
