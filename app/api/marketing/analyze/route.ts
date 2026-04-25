import { NextRequest, NextResponse } from "next/server";
import {
  ADS_SCHEMA,
  KEYWORDS_SCHEMA,
  SEARCH_TERMS_SCHEMA,
  parseAndValidateCsv,
} from "@/lib/marketingBot/schemas";
import { runMarketingBot } from "@/lib/marketingBot/analyze";
import type { BotBusinessContext } from "@/lib/marketingBot/types";

export const runtime = "nodejs";
export const maxDuration = 120; // Claude analysis can take up to 2 min

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const searchTermsFile = form.get("search_terms") as File | null;
  const keywordsFile = form.get("keywords") as File | null;
  const adsFile = form.get("ads") as File | null;

  if (!searchTermsFile || !keywordsFile || !adsFile) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          error: "missing_column",
          detail: "All three files required: search_terms, keywords, ads",
        },
      },
      { status: 400 },
    );
  }

  const [searchTermsText, keywordsText, adsText] = await Promise.all([
    searchTermsFile.text(),
    keywordsFile.text(),
    adsFile.text(),
  ]);

  // Validate each CSV has the required columns before spending tokens
  const stValid = parseAndValidateCsv(searchTermsText, SEARCH_TERMS_SCHEMA);
  if (!stValid.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          error: "missing_column",
          detail: `search_terms.csv missing: ${stValid.error.missing.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  const kwValid = parseAndValidateCsv(keywordsText, KEYWORDS_SCHEMA);
  if (!kwValid.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          error: "missing_column",
          detail: `keywords.csv missing: ${kwValid.error.missing.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  const adsValid = parseAndValidateCsv(adsText, ADS_SCHEMA);
  if (!adsValid.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          error: "missing_column",
          detail: `ads.csv missing: ${adsValid.error.missing.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  // Optional context overrides posted as JSON string
  let contextOverride: Partial<BotBusinessContext> | undefined;
  const ctxRaw = form.get("context");
  if (typeof ctxRaw === "string" && ctxRaw.trim()) {
    try {
      contextOverride = JSON.parse(ctxRaw);
    } catch {
      // ignore malformed context, fall back to defaults
    }
  }

  const result = await runMarketingBot({
    searchTermsCsv: searchTermsText,
    keywordsCsv: keywordsText,
    adsCsv: adsText,
    context: contextOverride,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
