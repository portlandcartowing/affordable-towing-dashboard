// CSV column contracts for the Google Ads marketing bot.
// Each schema defines required + optional columns and alias mappings so
// Google Ads exports (which vary by locale/version) map onto a canonical
// column name the prompt can rely on.

export interface ColumnSpec {
  canonical: string;
  required: boolean;
  aliases: string[]; // additional header strings that map to this canonical
}

export interface CsvSchema {
  name: "search_terms" | "keywords" | "ads";
  label: string;
  columns: ColumnSpec[];
}

const col = (canonical: string, required: boolean, aliases: string[] = []): ColumnSpec => ({
  canonical,
  required,
  aliases: aliases.map((a) => a.toLowerCase()),
});

export const SEARCH_TERMS_SCHEMA: CsvSchema = {
  name: "search_terms",
  label: "Search Terms report",
  columns: [
    col("search_term", true, ["search term", "query", "search query"]),
    col("campaign", true, ["campaign name"]),
    col("ad_group", true, ["ad group", "ad group name"]),
    col("match_type", true, ["match type", "search keyword match type"]),
    col("impressions", true, ["impr.", "impr"]),
    col("clicks", true),
    col("cost", true, ["spend"]),
    col("conversions", true, ["conv.", "conv", "phone calls", "call conversions"]),
    col("ctr", false),
    col("avg_cpc", false, ["avg. cpc"]),
    col("added_excluded", false, ["added/excluded", "status"]),
  ],
};

export const KEYWORDS_SCHEMA: CsvSchema = {
  name: "keywords",
  label: "Keywords report",
  columns: [
    col("keyword", true, ["search keyword", "keyword"]),
    col("match_type", true, ["match type", "keyword match type"]),
    col("campaign", true, ["campaign name"]),
    col("ad_group", true, ["ad group", "ad group name"]),
    col("status", true, ["keyword status"]),
    col("impressions", true, ["impr.", "impr"]),
    col("clicks", true),
    col("cost", true, ["spend"]),
    col("conversions", true, ["conv.", "conv", "phone calls"]),
    col("quality_score", false, ["qs"]),
    col("impression_share", false, ["search impression share", "impr. share"]),
  ],
};

export const ADS_SCHEMA: CsvSchema = {
  name: "ads",
  label: "Ads report",
  columns: [
    col("ad", true, ["ad name"]),
    col("headline_1", true, ["headline 1"]),
    col("headline_2", true, ["headline 2"]),
    col("headline_3", false, ["headline 3"]),
    col("description_1", true, ["description 1", "description line 1"]),
    col("description_2", false, ["description 2", "description line 2"]),
    col("campaign", true, ["campaign name"]),
    col("ad_group", true, ["ad group", "ad group name"]),
    col("status", true, ["ad status"]),
    col("impressions", true, ["impr.", "impr"]),
    col("clicks", true),
    col("ctr", false),
    col("cost", true, ["spend"]),
    col("conversions", true, ["conv.", "conv", "phone calls"]),
  ],
};

export const ALL_SCHEMAS = {
  search_terms: SEARCH_TERMS_SCHEMA,
  keywords: KEYWORDS_SCHEMA,
  ads: ADS_SCHEMA,
} as const;

// ---------- Parsing + validation ----------

export interface ParsedCsv {
  schema: CsvSchema;
  headerRow: string[]; // original headers as seen in the file
  canonicalHeaders: (string | null)[]; // same length, mapped to canonical or null
  rows: Record<string, string>[]; // each row keyed by canonical column name
  rawRowCount: number;
}

export interface ValidationError {
  schema: CsvSchema["name"];
  missing: string[];
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map((c) => c.trim());
}

function mapHeaderToCanonical(header: string, schema: CsvSchema): string | null {
  const norm = header.toLowerCase().trim();
  for (const c of schema.columns) {
    if (norm === c.canonical.replace(/_/g, " ") || norm === c.canonical) return c.canonical;
    if (c.aliases.includes(norm)) return c.canonical;
  }
  return null;
}

export function parseAndValidateCsv(
  text: string,
  schema: CsvSchema,
): { ok: true; parsed: ParsedCsv } | { ok: false; error: ValidationError } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Google Ads exports sometimes prepend a "Report" title line — find the
  // first line that parses to >= 3 columns and treat that as the header.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (parseCsvLine(lines[i]).length >= 3) {
      headerIdx = i;
      break;
    }
  }

  const headerRow = parseCsvLine(lines[headerIdx]);
  const canonicalHeaders = headerRow.map((h) => mapHeaderToCanonical(h, schema));

  const foundCanonicals = new Set(canonicalHeaders.filter(Boolean) as string[]);
  const missing = schema.columns
    .filter((c) => c.required && !foundCanonicals.has(c.canonical))
    .map((c) => c.canonical);

  if (missing.length > 0) {
    return { ok: false, error: { schema: schema.name, missing } };
  }

  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    // Skip total/summary rows
    const firstVal = cols[0]?.toLowerCase() ?? "";
    if (firstVal === "total" || firstVal.startsWith("--")) continue;

    const row: Record<string, string> = {};
    let hasAnyValue = false;
    canonicalHeaders.forEach((canonical, idx) => {
      if (!canonical) return;
      const val = cols[idx] ?? "";
      row[canonical] = val;
      if (val.trim()) hasAnyValue = true;
    });
    if (hasAnyValue) rows.push(row);
  }

  return {
    ok: true,
    parsed: { schema, headerRow, canonicalHeaders, rows, rawRowCount: rows.length },
  };
}

// ---------- Downloadable template generator ----------

export function buildTemplateCsv(schema: CsvSchema): string {
  const headers = schema.columns.map((c) =>
    c.canonical
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
  );
  // Add one example row so users see expected format
  const example = schema.columns.map((c) => {
    if (c.canonical.includes("cost")) return "0.00";
    if (c.canonical === "impressions" || c.canonical === "clicks") return "0";
    if (c.canonical === "conversions") return "0";
    if (c.canonical === "match_type") return "Exact";
    if (c.canonical === "status") return "Enabled";
    return "";
  });
  return [headers.join(","), example.join(",")].join("\n");
}
