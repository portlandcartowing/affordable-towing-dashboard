"use client";

import { useState } from "react";
import BotReportView from "./BotReport";
import type { BotResponse } from "@/lib/marketingBot/types";

type FileKey = "search_terms" | "keywords" | "ads";

const FILE_LABELS: Record<FileKey, string> = {
  search_terms: "Search Terms",
  keywords: "Keywords",
  ads: "Ads",
};

export default function MarketingBot() {
  const [files, setFiles] = useState<Record<FileKey, File | null>>({
    search_terms: null,
    keywords: null,
    ads: null,
  });
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<BotResponse | null>(null);

  const allReady = files.search_terms && files.keywords && files.ads;

  const setFile = (key: FileKey, file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const run = async () => {
    if (!allReady) return;
    setRunning(true);
    setResponse(null);
    const form = new FormData();
    form.set("search_terms", files.search_terms!);
    form.set("keywords", files.keywords!);
    form.set("ads", files.ads!);

    try {
      const res = await fetch("/api/marketing/analyze", {
        method: "POST",
        body: form,
      });
      const data: BotResponse = await res.json();
      setResponse(data);
    } catch (e) {
      setResponse({
        ok: false,
        error: { error: "upstream_error", detail: (e as Error).message },
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-slate-900">AI Marketing Bot</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload 3 Google Ads exports — Claude returns negatives to add, keywords to pause, and ad copy fixes.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            {(Object.keys(FILE_LABELS) as FileKey[]).map((k) => (
              <a
                key={k}
                href={`/api/marketing/template?type=${k}`}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                {FILE_LABELS[k]} template
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(Object.keys(FILE_LABELS) as FileKey[]).map((k) => (
            <FileSlot
              key={k}
              label={FILE_LABELS[k]}
              file={files[k]}
              onChange={(f) => setFile(k, f)}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={run}
            disabled={!allReady || running}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:bg-slate-200 disabled:text-slate-400 hover:bg-blue-700 transition-colors"
          >
            {running ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>
      </div>

      {response && !response.ok && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <div className="text-sm font-semibold text-rose-800">
            {response.error.error === "missing_column" ? "CSV format error" : "Analysis failed"}
          </div>
          <div className="text-sm text-rose-700 mt-1">{response.error.detail}</div>
        </div>
      )}

      {response && response.ok && (
        <>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Model: {response.meta.model}</span>
            <span>·</span>
            <span>{(response.meta.ms / 1000).toFixed(1)}s</span>
          </div>
          <BotReportView report={response.report} />
        </>
      )}
    </div>
  );
}

function FileSlot({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.name.endsWith(".csv")) onChange(f);
      }}
      className={`block rounded-xl border-2 border-dashed p-4 cursor-pointer transition-colors ${
        dragOver
          ? "border-blue-400 bg-blue-50"
          : file
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
      }`}
    >
      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      {file ? (
        <div>
          <div className="text-sm font-medium text-emerald-800 truncate">{file.name}</div>
          <div className="text-xs text-emerald-700 mt-0.5">
            {(file.size / 1024).toFixed(1)} KB · click to replace
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500">Click or drop .csv</div>
      )}
    </label>
  );
}
