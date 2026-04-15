"use client";

import type { CopilotPrompt } from "../types";

const KIND_STYLE: Record<CopilotPrompt["kind"], string> = {
  info: "bg-slate-50 text-slate-700 border-slate-200",
  action: "bg-blue-50 text-blue-800 border-blue-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
};

const KIND_ICON: Record<CopilotPrompt["kind"], string> = {
  info: "ⓘ",
  action: "➤",
  warning: "⚠",
};

export default function CopilotPanel({
  prompts,
}: {
  prompts: CopilotPrompt[];
}) {
  // Cap to 2 visible prompts — copilot is a nudge, not a wall.
  const visible = prompts.slice(0, 2);

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-3.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
          Copilot
        </h3>
        <span className="text-[9px] uppercase tracking-wider text-slate-400">
          AI · mock
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="text-[11px] text-slate-400 text-center py-2">
          No suggestions.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((p) => (
            <li
              key={p.id}
              className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium leading-snug ${KIND_STYLE[p.kind]}`}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              <span className="shrink-0 text-sm leading-none">
                {KIND_ICON[p.kind]}
              </span>
              <span className="line-clamp-2">{p.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
