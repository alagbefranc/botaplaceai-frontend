/**
 * Google Drive OAuth helpers (per-org SaaS approach)
 * Each organization stores its own refresh token - no service account Drive sharing required.
 */

import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET!;

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  );
}

export function getRedirectUri(): string {
  return `${getAppUrl()}/api/integrations/google-drive/callback`;
}

export function createOAuth2Client(refreshToken?: string) {
  const client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    getRedirectUri()
  );
  if (refreshToken) {
    client.setCredentials({ refresh_token: refreshToken });
  }
  return client;
}

/** Scopes required for reading Drive files */
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET
  );
}

/** Build the authorization URL for Google consent */
export function buildAuthUrl(orgId: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: DRIVE_SCOPES,
    prompt: "consent", // Force consent to always get refresh_token
    state: Buffer.from(JSON.stringify({ orgId })).toString("base64"),
  });
}

/** Exchange authorization code for tokens */
export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken: string | null;
  accessToken: string | null;
  email: string | null;
}> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get user's email
  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();
    email = data.email ?? null;
  } catch {
    // Email fetch is non-critical
  }

  return {
    refreshToken: tokens.refresh_token ?? null,
    accessToken: tokens.access_token ?? null,
    email,
  };
}

/** Get a valid access token from stored refresh token */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const client = createOAuth2Client(refreshToken);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to get access token from refresh token");
  return token;
}

export type DriveFileContent = {
  name: string;
  mimeType: string;
  text: string;
  size: number;
};

const EXPORTABLE_MIME_TYPES: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const SUPPORTED_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
  ...Object.keys(EXPORTABLE_MIME_TYPES),
];

/**
 * Download and extract text from a single Drive file.
 * Supports: Google Docs, Sheets, Slides (exported), .txt, .md, .csv, .json
 */
export async function downloadDriveFile(
  fileId: string,
  refreshToken: string
): Promise<DriveFileContent | null> {
  const client = createOAuth2Client(refreshToken);
  const drive = google.drive({ version: "v3", auth: client });

  // Get file metadata
  const { data: meta } = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size",
  });

  if (!meta.mimeType) return null;

  let text = "";
  const mimeType = meta.mimeType;

  if (EXPORTABLE_MIME_TYPES[mimeType]) {
    // Export Google Docs/Sheets/Slides as plain text
    const exportMime = EXPORTABLE_MIME_TYPES[mimeType];
    const { data } = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: "text" }
    );
    text = String(data);
  } else if (SUPPORTED_MIME_TYPES.includes(mimeType)) {
    // Download binary file
    const { data } = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );
    text = String(data);
  } else {
    return null; // Unsupported type (PDF, images, etc.)
  }

  return {
    name: meta.name ?? fileId,
    mimeType,
    text: text.slice(0, 500_000), // Cap at 500KB text
    size: text.length,
  };
}

/**
 * List all supported files in a Drive folder (1 level deep, max 50 files)
 */
export async function listDriveFolder(
  folderId: string,
  refreshToken: string
): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const client = createOAuth2Client(refreshToken);
  const drive = google.drive({ version: "v3", auth: client });

  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: 50,
  });

  return (data.files ?? []).filter(
    (f) =>
      f.id &&
      f.name &&
      f.mimeType &&
      (SUPPORTED_MIME_TYPES.includes(f.mimeType) ||
        !!EXPORTABLE_MIME_TYPES[f.mimeType])
  ) as Array<{ id: string; name: string; mimeType: string }>;
}

/**
 * Split text into chunks for RAG
 */
export function chunkText(
  text: string,
  sourceName: string,
  chunkSize = 1500,
  overlap = 150
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(`Source: ${sourceName}\n${chunk}`);
    }
    start = end - overlap;
    if (start >= end) break;
  }

  return chunks;
}
