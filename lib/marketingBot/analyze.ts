import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildUserMessage, DEFAULT_CONTEXT } from "./prompt";
import type { BotBusinessContext, BotReport, BotResponse } from "./types";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 8000;

// Rough guard: if any CSV blows past this, we truncate to keep token usage
// predictable. The bot only needs representative rows to pattern-match on.
const MAX_CSV_CHARS = 60_000;

function cap(csv: string): string {
  if (csv.length <= MAX_CSV_CHARS) return csv;
  // Keep header + first N rows, then note truncation
  const lines = csv.split(/\r?\n/);
  let total = 0;
  const kept: string[] = [];
  for (const line of lines) {
    total += line.length + 1;
    if (total > MAX_CSV_CHARS) break;
    kept.push(line);
  }
  kept.push(`# --- truncated after ${kept.length} rows to fit token budget ---`);
  return kept.join("\n");
}

function extractJson(text: string): unknown {
  // Claude with system prompt should return bare JSON, but strip fences just in case
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const raw = fenceMatch ? fenceMatch[1] : trimmed;
  return JSON.parse(raw);
}

export async function runMarketingBot(args: {
  searchTermsCsv: string;
  keywordsCsv: string;
  adsCsv: string;
  context?: Partial<BotBusinessContext>;
}): Promise<BotResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { error: "upstream_error", detail: "ANTHROPIC_API_KEY not set" } };
  }

  const ctx: BotBusinessContext = { ...DEFAULT_CONTEXT, ...args.context };
  const client = new Anthropic({ apiKey });
  const started = Date.now();

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(ctx),
          cache_control: { type: "ephemeral" }, // cache the big system prompt
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserMessage(
            cap(args.searchTermsCsv),
            cap(args.keywordsCsv),
            cap(args.adsCsv),
          ),
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return {
        ok: false,
        error: { error: "upstream_error", detail: "No text block in response" },
      };
    }

    let parsed: unknown;
    try {
      parsed = extractJson(textBlock.text);
    } catch (e) {
      return {
        ok: false,
        error: {
          error: "invalid_json",
          detail: `Model returned non-JSON: ${(e as Error).message}`,
        },
      };
    }

    // If the model short-circuited with an error envelope
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const err = parsed as { error: string; detail?: string };
      return {
        ok: false,
        error: {
          error: err.error === "missing_column" ? "missing_column" : "upstream_error",
          detail: err.detail ?? "Model reported an error",
        },
      };
    }

    return {
      ok: true,
      report: parsed as BotReport,
      meta: { model: MODEL, ms: Date.now() - started },
    };
  } catch (e) {
    return {
      ok: false,
      error: { error: "upstream_error", detail: (e as Error).message },
    };
  }
}
