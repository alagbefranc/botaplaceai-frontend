import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";
const COMPOSIO_V2 = "https://backend.composio.dev/api/v2";

interface ComposioAuthConfig {
  id: string;
  auth_scheme?: string;
  no_of_connections: number;
  status: "ENABLED" | "DISABLED";
  toolkit: {
    slug: string;
    logo: string;
  };
}

interface ComposioAccount {
  id: string;
  status: string;
  toolkit?: {
    slug: string;
  };
  user_id?: string;
}

interface ComposioApp {
  key: string;
  name: string;
  description: string;
  logo: string;
  categories: string[];
  auth_schemes?: string[];
}

// Recommended apps for AI agents - curated list of most useful integrations
const RECOMMENDED_APPS = [
  // Email
  'gmail', 'outlook', 'sendgrid',
  // Calendar & Scheduling
  'googlecalendar', 'calendly', 'cal', 'zoom',
  // CRM & Sales
  'hubspot', 'salesforce', 'pipedrive', 'zohocrm',
  // Support & Helpdesk
  'zendesk', 'freshdesk', 'intercom',
  // E-commerce & Payments
  'stripe', 'shopify', 'square', 'quickbooks',
  // Communication
  'slack', 'discord', 'twilio', 'whatsapp',
  // Project Management
  'jira', 'asana', 'trello', 'notion', 'linear', 'clickup',
  // Documents & Storage
  'googlesheets', 'googledrive', 'dropbox', 'airtable',
  // Social Media
  'twitter', 'linkedin',
  // Developer Tools
  'github',
  // Marketing
  'mailchimp', 'typeform',
];

function headers(apiKey: string) {
  return { "x-api-key": apiKey, "Content-Type": "application/json" } as const;
}

export async function GET() {
  try {
    const { member } = await getOrgMemberContext();

    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey || composioApiKey === "your-composio-api-key-here") {
      return NextResponse.json({ integrations: [] });
    }

    // entityId = orgId — connections belong to the org
    const entityId = member.orgId;

    // Fetch apps and connected accounts, plus ALL auth configs (paginated)
    const [appsRes, accountsRes] = await Promise.all([
      fetch(`${COMPOSIO_V2}/apps?limit=200`, {
        headers: headers(composioApiKey),
        cache: "no-store",
      }),
      fetch(`${COMPOSIO_BASE}/connected_accounts?user_ids=${entityId}&limit=100`, {
        headers: headers(composioApiKey),
        cache: "no-store",
      }),
    ]);

    // Paginate through all auth configs — Composio v3 caps at 20/page regardless of limit
    const allAuthConfigs: ComposioAuthConfig[] = [];
    let cursor: string | null = null;
    do {
      const url = cursor
        ? `${COMPOSIO_BASE}/auth_configs?cursor=${cursor}`
        : `${COMPOSIO_BASE}/auth_configs`;
      const res = await fetch(url, { headers: headers(composioApiKey), cache: "no-store" });
      if (!res.ok) break;
      const page = (await res.json()) as { items?: ComposioAuthConfig[]; next_cursor?: string | null };
      allAuthConfigs.push(...(page.items ?? []));
      cursor = page.next_cursor ?? null;
    } while (cursor);

    const appsPayload = appsRes.ok
      ? ((await appsRes.json()) as { items?: ComposioApp[] })
      : { items: [] };

    const accountsPayload = accountsRes.ok
      ? ((await accountsRes.json()) as { items?: ComposioAccount[] })
      : { items: [] };

    const allApps = appsPayload.items ?? [];
    const allAccounts = accountsPayload.items ?? [];

    // Build auth config lookup by toolkit slug
    const authConfigByApp = new Map<string, ComposioAuthConfig>();
    for (const config of allAuthConfigs) {
      if (config.status !== "ENABLED") continue;
      const existing = authConfigByApp.get(config.toolkit.slug);
      if (!existing || (config.no_of_connections > existing.no_of_connections)) {
        authConfigByApp.set(config.toolkit.slug, config);
      }
    }

    // Build connection status per app — prefer ACTIVE
    const connectionByApp = new Map<string, ComposioAccount>();
    for (const account of allAccounts) {
      const slug = account.toolkit?.slug ?? "";
      if (!slug) continue;
      const existing = connectionByApp.get(slug);
      if (!existing || (account.status === "ACTIVE" && existing.status !== "ACTIVE")) {
        connectionByApp.set(slug, account);
      }
    }

    // Build app lookup
    const appByKey = new Map<string, ComposioApp>();
    for (const app of allApps) {
      appByKey.set(app.key, app);
    }

    // Build the final list - show recommended apps + any with auth configs
    const seenApps = new Set<string>();
    const integrations: Array<{
      integrationId: string;
      appName: string;
      displayName: string;
      description: string;
      authScheme: string;
      logo: string;
      status: string;
      connectedAccountId: string | null;
      connectionCount: number;
      category: string;
    }> = [];

    // First add apps that have auth configs (configured integrations)
    for (const config of authConfigByApp.values()) {
      const slug = config.toolkit.slug;
      seenApps.add(slug);
      
      const account = connectionByApp.get(slug);
      const app = appByKey.get(slug);
      let status = "not_connected";
      let connectedAccountId: string | null = null;

      if (account) {
        connectedAccountId = account.id;
        if (account.status === "ACTIVE") status = "connected";
        else if (account.status === "EXPIRED") status = "expired";
        else if (account.status === "INITIATED" || account.status === "INITIALIZING") status = "pending";
        else if (account.status === "FAILED") status = "error";
      }

      integrations.push({
        integrationId: config.id,
        appName: slug,
        displayName: formatAppName(slug),
        description: app?.description ?? "",
        authScheme: config.auth_scheme ?? "",
        logo: config.toolkit.logo || app?.logo || "",
        status,
        connectedAccountId,
        connectionCount: config.no_of_connections,
        category: getAppCategory(slug),
      });
    }

    // Then add recommended apps that aren't already in the list
    for (const appKey of RECOMMENDED_APPS) {
      if (seenApps.has(appKey)) continue;
      
      const app = appByKey.get(appKey);
      if (!app) continue; // App not available in Composio
      
      seenApps.add(appKey);
      
      integrations.push({
        integrationId: `app_${appKey}`,
        appName: appKey,
        displayName: formatAppName(appKey),
        description: app.description ?? "",
        authScheme: app.auth_schemes?.[0] ?? "OAUTH2",
        logo: app.logo || "",
        status: "not_connected",
        connectedAccountId: null,
        connectionCount: 0,
        category: getAppCategory(appKey),
      });
    }

    // Sort: connected first, then expired, then rest alphabetically
    integrations.sort((a, b) => {
      const order: Record<string, number> = { connected: 0, expired: 1, pending: 2, error: 3, not_connected: 4 };
      const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
      if (diff !== 0) return diff;
      return a.displayName.localeCompare(b.displayName);
    });

    return NextResponse.json({ integrations });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load connected apps.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getAppCategory(appKey: string): string {
  const categories: Record<string, string> = {
    gmail: "Email", outlook: "Email", sendgrid: "Email",
    googlecalendar: "Calendar", calendly: "Calendar", cal: "Calendar", zoom: "Calendar",
    hubspot: "CRM", salesforce: "CRM", pipedrive: "CRM", zohocrm: "CRM",
    zendesk: "Support", freshdesk: "Support", intercom: "Support",
    stripe: "Payments", shopify: "E-commerce", square: "Payments", quickbooks: "Finance",
    slack: "Communication", discord: "Communication", twilio: "Communication", whatsapp: "Communication",
    jira: "Project Management", asana: "Project Management", trello: "Project Management",
    notion: "Project Management", linear: "Project Management", clickup: "Project Management",
    googlesheets: "Documents", googledrive: "Documents", dropbox: "Documents", airtable: "Documents",
    twitter: "Social Media", linkedin: "Social Media",
    github: "Developer Tools",
    mailchimp: "Marketing", typeform: "Marketing",
  };
  return categories[appKey] || "Other";
}

function formatAppName(appName: string): string {
  const special: Record<string, string> = {
    gmail: "Gmail",
    googlecalendar: "Google Calendar",
    googlesheets: "Google Sheets",
    microsoft_teams: "Microsoft Teams",
    freshservice: "Freshservice",
    freshdesk: "Freshdesk",
    outlook: "Outlook",
    github: "GitHub",
    cal: "Cal.com",
    calendly: "Calendly",
    slack: "Slack",
    hubspot: "HubSpot",
    stripe: "Stripe",
    jira: "Jira",
    notion: "Notion",
  };
  return special[appName] || appName.charAt(0).toUpperCase() + appName.slice(1).replace(/_/g, " ");
}
