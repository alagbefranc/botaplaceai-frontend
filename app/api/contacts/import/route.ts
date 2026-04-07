import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

// E.164 format: + followed by 1-15 digits
const E164_RE = /^\+[1-9]\d{1,14}$/;

// Reserved contact columns — all others become dynamic variables
const RESERVED_COLS = new Set(["number", "name", "email", "company", "tags", "notes"]);

interface CsvRow {
  [key: string]: string | undefined;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Headers are lowercased and trimmed
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });

    const body = await request.json().catch(() => null);
    if (!body?.csv || typeof body.csv !== "string") {
      return NextResponse.json({ error: "csv field is required." }, { status: 400 });
    }

    const { headers, rows } = parseCsv(body.csv);
    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in CSV." }, { status: 400 });
    }

    // Validate required 'number' column
    if (!headers.includes("number")) {
      return NextResponse.json({
        error: "Missing required column: 'number'. The CSV must have a lowercase 'number' column with E.164 formatted phone numbers.",
      }, { status: 400 });
    }

    // Dynamic variable columns = everything except reserved columns
    const dynamicCols = headers.filter((h) => !RESERVED_COLS.has(h));

    let invalidCount = 0;
    const records = rows
      .map((row) => {
        const number = (row["number"] ?? "").trim();

        // Skip blank rows
        if (!number) return null;

        // Validate E.164
        if (!E164_RE.test(number)) {
          invalidCount++;
          return null;
        }

        const name = (row["name"] ?? "").trim() || number; // fallback to number if no name
        const email = (row["email"] ?? "").trim() || null;
        const company = (row["company"] ?? "").trim() || null;
        const notes = (row["notes"] ?? "").trim() || null;
        const tagsRaw = (row["tags"] ?? "").trim();
        const tags = tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean) : [];

        // Collect dynamic variables
        const variables: Record<string, string> = {};
        for (const col of dynamicCols) {
          const val = (row[col] ?? "").trim();
          if (val) variables[col] = val;
        }

        return {
          org_id: member.orgId,
          name,
          phone: number,
          email,
          company,
          notes,
          tags,
          variables,
          source: "csv",
          status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (records.length === 0) {
      return NextResponse.json({
        error: `No valid rows found. All ${invalidCount} phone numbers were not in E.164 format (e.g. +14151234567).`,
      }, { status: 400 });
    }

    // Upsert in batches of 100 — skip duplicates based on org_id+phone
    let inserted = 0;
    let skipped = 0;
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { data, error } = await admin
        .from("contacts")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(batch as any[], {
          onConflict: "org_id,phone",
          ignoreDuplicates: false, // update variables on re-import
        })
        .select("id");

      if (error) {
        console.error("[contacts/import] upsert error:", error);
      } else {
        inserted += (data ?? []).length;
        skipped += batch.length - (data ?? []).length;
      }
    }

    return NextResponse.json({
      imported: inserted,
      skipped,
      total: records.length,
      invalid: invalidCount,
      dynamicVariables: dynamicCols,
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to import contacts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
