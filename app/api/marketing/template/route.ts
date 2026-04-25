import { NextRequest, NextResponse } from "next/server";
import {
  ADS_SCHEMA,
  ALL_SCHEMAS,
  KEYWORDS_SCHEMA,
  SEARCH_TERMS_SCHEMA,
  buildTemplateCsv,
} from "@/lib/marketingBot/schemas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const which = searchParams.get("type");

  const schema =
    which === "keywords" ? KEYWORDS_SCHEMA
    : which === "ads" ? ADS_SCHEMA
    : which === "search_terms" ? SEARCH_TERMS_SCHEMA
    : null;

  if (!schema) {
    return NextResponse.json(
      { error: "Specify ?type=search_terms|keywords|ads" },
      { status: 400 },
    );
  }

  const csv = buildTemplateCsv(schema);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${schema.name}_template.csv"`,
    },
  });
}

// Export the schemas map so other tooling can introspect it if needed
export const _schemas = ALL_SCHEMAS;
