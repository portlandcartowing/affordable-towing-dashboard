"use client";

import { useState } from "react";
import { addDriver, updateDriver, deleteDriver } from "./actions";

type Driver = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  hookup_fee: number;
  rate_per_mile: number;
  commission_pct: number;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700",
  busy: "bg-amber-50 text-amber-700",
  offline: "bg-slate-100 text-slate-500",
};

export default function DriversManager({ initialDrivers }: { initialDrivers: Driver[] }) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await addDriver(formData);
      form.reset();
      setShowAdd(false);
      window.location.reload();
    } catch (err: any) {
      alert("Error adding driver: " + err.message);
    }
    setLoading(false);
  };

  const handleUpdate = async (id: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateDriver(id, formData);
      setEditId(null);
      window.location.reload();
    } catch (err: any) {
      alert("Error updating driver: " + err.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string | null) => {
    if (!confirm(`Delete driver ${name || "Unknown"}?`)) return;
    try {
      await deleteDriver(id);
      setDrivers(drivers.filter((d) => d.id !== id));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Driver Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add Driver"}
        </button>
      </div>

      {/* Add Driver Form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-6 space-y-4"
        >
          <h3 className="font-semibold text-slate-900">New Driver</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="name" placeholder="Full Name" required
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm focus:ring-blue-400 outline-none" />
            <input name="email" type="email" placeholder="Email" required
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm focus:ring-blue-400 outline-none" />
            <input name="phone" placeholder="Phone"
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm focus:ring-blue-400 outline-none" />
            <input name="hookup_fee" type="number" step="0.01" placeholder="Hookup Fee ($)" defaultValue="95"
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm focus:ring-blue-400 outline-none" />
            <input name="rate_per_mile" type="number" step="0.01" placeholder="Rate Per Mile ($)" defaultValue="4"
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm focus:ring-blue-400 outline-none" />
            <input name="commission_pct" type="number" min="0" max="100" placeholder="Commission %" defaultValue="50"
              className="px-3 py-2 rounded-xl ring-1 ring-slate-200 text-sm focus:ring-blue-400 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? "Adding..." : "Add Driver"}
          </button>
        </form>
      )}

      {/* Drivers Table */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Driver</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Contact</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Rates</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-slate-50 transition-colors">
                {editId === driver.id ? (
                  <td colSpan={5} className="px-4 py-4">
                    <form onSubmit={(e) => handleUpdate(driver.id, e)} className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <input name="name" defaultValue={driver.name || ""} placeholder="Name"
                          className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-blue-400" />
                        <input name="email" defaultValue={driver.email || ""} placeholder="Email"
                          className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-blue-400" />
                        <input name="phone" defaultValue={driver.phone || ""} placeholder="Phone"
                          className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-blue-400" />
                        <input name="hookup_fee" type="number" step="0.01" defaultValue={driver.hookup_fee} placeholder="Hookup ($)"
                          className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-blue-400" />
                        <input name="rate_per_mile" type="number" step="0.01" defaultValue={driver.rate_per_mile} placeholder="Rate/mi ($)"
                          className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-blue-400" />
                        <input name="commission_pct" type="number" min="0" max="100" defaultValue={driver.commission_pct} placeholder="Commission %"
                          className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-blue-400" />
                        <select name="status" defaultValue={driver.status}
                          className="px-3 py-2 rounded-lg ring-1 ring-slate-200 text-sm outline-none focus:ring-blue-400">
                          <option value="available">Available</option>
                          <option value="busy">Busy</option>
                          <option value="offline">Offline</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={loading}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditId(null)}
                          className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{driver.name || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-600">{driver.email || "—"}</p>
                      <p className="text-slate-400 text-xs">{driver.phone || ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${STATUS_STYLES[driver.status] || "bg-slate-100 text-slate-500"}`}>
                        {driver.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>${driver.hookup_fee} hookup &middot; ${driver.rate_per_mile}/mi</div>
                      <div className="text-xs text-slate-400">Driver gets {driver.commission_pct}%</div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setEditId(driver.id)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(driver.id, driver.name)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  No drivers yet. Click "+ Add Driver" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
