"use client";

import { useState } from "react";

type CampaignSummary = {
  campaign: string;
  cost: number;
  clicks: number;
  conversions: number;
  cpc: number;
  cpa: number;
};

type DailyRow = {
  id: string;
  date: string;
  campaign: string;
  cost: number;
  clicks: number;
  conversions: number;
};

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function CampaignTable({
  campaigns,
  dailyRows,
}: {
  campaigns: CampaignSummary[];
  dailyRows: DailyRow[];
}) {
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const toggle = (name: string) =>
    setExpandedCampaign((prev) => (prev === name ? null : name));

  if (campaigns.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
            No campaign data yet. Sync Google Ads to populate.
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <>
      {campaigns.map((c) => {
        const isOpen = expandedCampaign === c.campaign;
        const campaignDays = dailyRows.filter((r) => r.campaign === c.campaign);

        return (
          <tbody key={c.campaign}>
            <tr
              onClick={() => toggle(c.campaign)}
              className={`border-t border-t-slate-100 cursor-pointer transition-colors ${
                isOpen ? "bg-blue-50/40" : "hover:bg-slate-50/50"
              }`}
            >
              <td className="px-5 py-3 font-medium text-slate-900">
                <div className="flex items-center gap-2">
                  <span className={`text-slate-400 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                  {c.campaign}
                </div>
              </td>
              <td className="px-5 py-3 text-right text-slate-600">{money(c.cost)}</td>
              <td className="px-5 py-3 text-right text-slate-600">
                {c.clicks.toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right text-slate-600">{c.conversions}</td>
              <td className="px-5 py-3 text-right text-slate-600">{money(c.cpc)}</td>
              <td className="px-5 py-3 text-right text-slate-600">{money(c.cpa)}</td>
            </tr>
            {isOpen && (
              <tr>
                <td colSpan={6} className="p-0">
                  <div className="bg-slate-50/60 px-5 py-3 border-t border-slate-100">
                    <div className="text-[11px] uppercase text-slate-400 font-medium mb-2">
                      Daily Breakdown — {c.campaign}
                    </div>
                    {campaignDays.length === 0 ? (
                      <div className="text-xs text-slate-400 py-2">No daily data.</div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="text-slate-400 uppercase">
                          <tr>
                            <th className="text-left py-1.5 pr-4">Date</th>
                            <th className="text-right py-1.5 px-4">Cost</th>
                            <th className="text-right py-1.5 px-4">Clicks</th>
                            <th className="text-right py-1.5 px-4">Conv.</th>
                            <th className="text-right py-1.5 px-4">CPC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaignDays.map((d) => (
                            <tr key={d.id} className="border-t border-slate-200/60">
                              <td className="py-1.5 pr-4 text-slate-600">{d.date}</td>
                              <td className="py-1.5 px-4 text-right text-slate-700">{money(d.cost)}</td>
                              <td className="py-1.5 px-4 text-right text-slate-700">{d.clicks.toLocaleString()}</td>
                              <td className="py-1.5 px-4 text-right text-slate-700">{d.conversions}</td>
                              <td className="py-1.5 px-4 text-right text-slate-700">
                                {d.clicks > 0 ? money(d.cost / d.clicks) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        );
      })}
    </>
  );
}
