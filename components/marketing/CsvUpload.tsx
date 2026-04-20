"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadGoogleAdsCsv } from "@/app/marketing/uploadActions";

export default function CsvUpload() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setResult({ ok: false, message: "Please upload a .csv file" });
      return;
    }

    const formData = new FormData();
    formData.set("csv", file);

    startTransition(async () => {
      const res = await uploadGoogleAdsCsv(formData);
      if (res.ok) {
        setResult({ ok: true, message: `Imported ${res.imported} rows` });
        router.refresh();
        setTimeout(() => setResult(null), 3000);
      } else {
        setResult({ ok: false, message: res.error || "Upload failed" });
      }
    });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-uploaded
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Import Google Ads Data</h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Export a CSV from Google Ads (Campaigns → Reports → Download) and upload it here.
        Expects columns: Date, Campaign, Cost, Clicks, Conversions.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          className="hidden"
        />
        {isPending ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Importing...
          </div>
        ) : (
          <>
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm font-medium text-slate-700">
              Drop CSV here or click to browse
            </div>
            <div className="text-xs text-slate-400 mt-1">
              .csv files from Google Ads
            </div>
          </>
        )}
      </div>

      {result && (
        <div
          className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${
            result.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
