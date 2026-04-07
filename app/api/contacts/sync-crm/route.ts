import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

// CRM apps supported for contact sync
const CRM_APPS = ["hubspot", "salesforce", "zohocrm", "pipedrive", "freshsales", "monday"];

interface ComposioAccount {
  id: string;
  status: string;
  toolkit?: { slug: string };
}

function composioHeaders(apiKey: string) {
  return { "x-api-key": apiKey, "Content-Type": "application/json" } as const;
}

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    phone?: string;
    mobilephone?: string;
    email?: string;
    company?: string;
  };
}

function normalizeHubSpotContact(raw: HubSpotContact, orgId: string) {
  const firstName = raw.properties.firstname ?? "";
  const lastName = raw.properties.lastname ?? "";
  const name = `${firstName} ${lastName}`.trim() || `Contact ${raw.id}`;
  const phone = raw.properties.phone ?? raw.properties.mobilephone ?? "";
  if (!phone) return null;

  return {
    org_id: orgId,
    name,
    phone,
    email: raw.properties.email ?? null,
    company: raw.properties.company ?? null,
    tags: [] as string[],
    source: "crm",
    crm_id: raw.id,
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

export async function POST() {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });

    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey || composioApiKey === "your-composio-api-key-here") {
      return NextResponse.json(
        { error: "Composio is not configured. Add COMPOSIO_API_KEY to your environment." },
        { status: 400 }
      );
    }

    const entityId = member.orgId;

    // Get connected accounts for this org
    const accountsRes = await fetch(
      `${COMPOSIO_BASE}/connected_accounts?user_ids=${entityId}&limit=100`,
      { headers: composioHeaders(composioApiKey), cache: "no-store" }
    );

    if (!accountsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch connected apps." }, { status: 500 });
    }

    const accountsPayload = (await accountsRes.json()) as { items?: ComposioAccount[] };
    const accounts = (accountsPayload.items ?? []).filter(
      (a) => a.status === "ACTIVE" && CRM_APPS.includes(a.toolkit?.slug ?? "")
    );

    if (accounts.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "No connected CRM apps found. Connect HubSpot, Salesforce, or another CRM in the Apps page.",
      });
    }

    let totalSynced = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      const appSlug = account.toolkit?.slug ?? "";

      try {
        // Execute the Composio action to fetch contacts
        const actionSlug =
          appSlug === "hubspot" ? "HUBSPOT_LIST_CONTACTS" :
          appSlug === "salesforce" ? "SALESFORCE_QUERY_RECORDS" :
          appSlug === "pipedrive" ? "PIPEDRIVE_GET_ALL_PERSONS" :
          null;

        if (!actionSlug) continue;

        const execRes = await fetch(`${COMPOSIO_BASE}/actions/${actionSlug}/execute`, {
          method: "POST",
          headers: composioHeaders(composioApiKey),
          body: JSON.stringify({
            connected_account_id: account.id,
            input: appSlug === "salesforce" ? { query: "SELECT Id, Name, Phone, Email, Account.Name FROM Contact LIMIT 500" } : {},
          }),
        });

        if (!execRes.ok) {
          errors.push(`${appSlug}: action execution failed`);
          continue;
        }

        const execPayload = (await execRes.json()) as {
          successful?: boolean;
          data?: { results?: HubSpotContact[]; contacts?: HubSpotContact[] };
        };

        if (!execPayload.successful) {
          errors.push(`${appSlug}: action returned unsuccessful`);
          continue;
        }

        const rawContacts: HubSpotContact[] =
          execPayload.data?.results ?? execPayload.data?.contacts ?? [];

        const records = rawContacts
          .map((raw) => normalizeHubSpotContact(raw, member.orgId))
          .filter(Boolean);

        if (records.length === 0) continue;

        // Upsert — use crm_id + org_id as dedup key
        const { data, error } = await admin
          .from("contacts")
          .upsert(records as object[], { onConflict: "org_id,phone", ignoreDuplicates: false })
          .select("id");

        if (error) {
          errors.push(`${appSlug}: db error — ${error.message}`);
        } else {
          totalSynced += (data ?? []).length;
        }
      } catch (err) {
        errors.push(`${appSlug}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    return NextResponse.json({
      synced: totalSynced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to sync contacts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
