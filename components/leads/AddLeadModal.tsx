"use client";

import { useState, useTransition } from "react";
import { createLead } from "@/app/leads/actions";

const SERVICES = ["Tow", "Jump Start", "Tire Change", "Lockout", "Fuel Delivery", "Winch Out"];
const SOURCES = ["Google Ads", "Facebook", "SEO", "Referral", "Repeat", "Other"];

export default function AddLeadModal() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer: "",
    phone: "",
    service: SERVICES[0],
    city: "",
    source: SOURCES[0],
    price: "",
    notes: "",
    booked: false,
  });

  const reset = () => {
    setForm({
      customer: "",
      phone: "",
      service: SERVICES[0],
      city: "",
      source: SOURCES[0],
      price: "",
      notes: "",
      booked: false,
    });
    setError(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createLead({
        customer: form.customer.trim(),
        phone: form.phone.trim(),
        service: form.service,
        city: form.city.trim(),
        source: form.source,
        price: form.price ? Number(form.price) : null,
        notes: form.notes.trim(),
        booked: form.booked,
      });
      if (!res.ok) {
        setError(res.error || "Failed to create lead");
        return;
      }
      close();
    });
  };

  const input =
    "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400";
  const label = "block text-xs font-medium text-slate-600 mb-1";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
      >
        + Add Lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">New Lead</h2>
              <button
                onClick={close}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={label}>Customer</label>
                  <input
                    required
                    className={input}
                    value={form.customer}
                    onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  />
                </div>

                <div>
                  <label className={label}>Phone</label>
                  <input
                    required
                    type="tel"
                    className={input}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className={label}>City</label>
                  <input
                    className={input}
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>

                <div>
                  <label className={label}>Service</label>
                  <select
                    className={input}
                    value={form.service}
                    onChange={(e) => setForm({ ...form, service: e.target.value })}
                  >
                    {SERVICES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={label}>Source</label>
                  <select
                    className={input}
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  >
                    {SOURCES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={label}>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={input}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.booked}
                      onChange={(e) => setForm({ ...form, booked: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Mark as booked
                  </label>
                </div>

                <div className="col-span-2">
                  <label className={label}>Notes</label>
                  <textarea
                    rows={3}
                    className={input}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={close}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {isPending ? "Saving…" : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
