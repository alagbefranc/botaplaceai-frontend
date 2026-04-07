/**
 * Vertex AI RAG Engine Service for Next.js
 *
 * Manages RAG corpora for multi-tenant knowledge bases.
 * Each tenant/org gets their own corpus for document retrieval.
 */

import { GoogleAuth } from "google-auth-library";

// Configuration from environment
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "";
const LOCATION = process.env.VERTEX_AI_LOCATION || "us-central1";

// RAG API base URL
const RAG_API_BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/${LOCATION}`;

export interface RagCorpus {
  name: string;
  displayName: string;
  description?: string;
  createTime?: string;
  updateTime?: string;
}

export interface RagFile {
  name: string;
  displayName: string;
  sizeBytes?: string;
  ragFileType?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ImportRagFilesConfig {
  ragFileChunkingConfig?: {
    chunkSize?: number;
    chunkOverlap?: number;
  };
}

export interface UploadFileResult {
  ragFile: RagFile;
  error?: string;
}

export interface ImportOperationResult {
  operationName: string;
  error?: string;
}

let authClient: GoogleAuth | null = null;

/**
 * Get authenticated headers for Vertex AI API calls
 * Uses Application Default Credentials (ADC) or service account JSON
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!authClient) {
    if (serviceAccountJson) {
      // Use service account JSON from env
      authClient = new GoogleAuth({
        credentials: JSON.parse(serviceAccountJson),
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        projectId: PROJECT_ID,
      });
    } else {
      // Fallback: Use ADC (works in GCP environments or with gcloud auth)
      authClient = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        projectId: PROJECT_ID,
      });
    }
  }

  const client = await authClient.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error(
      "Failed to get access token. Check GOOGLE_APPLICATION_CREDENTIALS_JSON or run `gcloud auth application-default login`"
    );
  }

  return {
    Authorization: `Bearer ${token.token}`,
    "Content-Type": "application/json",
    "x-goog-user-project": PROJECT_ID, // Required for quota project
  };
}

/**
 * Check if Vertex AI RAG is properly configured
 */
export function isVertexRagConfigured(): boolean {
  return Boolean(PROJECT_ID && LOCATION);
}

/**
 * Create a new RAG corpus for a tenant/organization
 */
export async function createRagCorpus(
  orgId: string,
  displayName: string,
  description?: string
): Promise<RagCorpus> {
  if (!isVertexRagConfigured()) {
    throw new Error("Vertex AI RAG not configured. Set GOOGLE_CLOUD_PROJECT env var.");
  }

  console.log(`[VertexRAG] Creating corpus for org: ${orgId}`);

  const headers = await getAuthHeaders();

  const response = await fetch(`${RAG_API_BASE}/ragCorpora`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      displayName: displayName || `${orgId}_knowledge`,
      description: description || `Knowledge base for organization ${orgId}`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[VertexRAG] Create corpus error:", error);
    throw new Error(`Failed to create RAG corpus: ${error}`);
  }

  const data = (await response.json()) as RagCorpus;
  console.log(`[VertexRAG] Created corpus: ${data.name}`);
  return data;
}

/**
 * Get an existing RAG corpus by ID
 */
export async function getRagCorpus(corpusId: string): Promise<RagCorpus | null> {
  if (!isVertexRagConfigured()) return null;

  const headers = await getAuthHeaders();

  const corpusName = corpusId.startsWith("projects/")
    ? corpusId
    : `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}`;

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${corpusName}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.text();
    throw new Error(`Failed to get RAG corpus: ${error}`);
  }

  return (await response.json()) as RagCorpus;
}

/**
 * List all RAG corpora for the project
 */
export async function listRagCorpora(): Promise<RagCorpus[]> {
  if (!isVertexRagConfigured()) return [];

  const headers = await getAuthHeaders();

  const response = await fetch(`${RAG_API_BASE}/ragCorpora`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list RAG corpora: ${error}`);
  }

  const data = (await response.json()) as { ragCorpora?: RagCorpus[] };
  return data.ragCorpora || [];
}

/**
 * Delete a RAG corpus
 */
export async function deleteRagCorpus(corpusId: string): Promise<void> {
  if (!isVertexRagConfigured()) return;

  const headers = await getAuthHeaders();

  const corpusName = corpusId.startsWith("projects/")
    ? corpusId
    : `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}`;

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${corpusName}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete RAG corpus: ${error}`);
  }

  console.log(`[VertexRAG] Deleted corpus: ${corpusId}`);
}

/**
 * Upload a single file directly to a RAG corpus (up to 25MB)
 * Supports: PDF, TXT, HTML, Markdown, JSON, CSV, and more
 */
export async function uploadFileToCorpus(
  corpusId: string,
  fileContent: Buffer | string,
  fileName: string,
  mimeType: string,
  displayName?: string
): Promise<UploadFileResult> {
  if (!isVertexRagConfigured()) {
    return { ragFile: {} as RagFile, error: "Vertex AI RAG not configured" };
  }

  console.log(`[VertexRAG] Uploading file ${fileName} to corpus: ${corpusId}`);

  const corpusName = corpusId.startsWith("projects/")
    ? corpusId
    : `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}`;

  // Get access token for multipart upload
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  let token: string;

  if (!authClient) {
    if (serviceAccountJson) {
      authClient = new GoogleAuth({
        credentials: JSON.parse(serviceAccountJson),
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
    } else {
      authClient = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
    }
  }

  const client = await authClient.getClient();
  const accessToken = await client.getAccessToken();
  token = accessToken.token || "";

  if (!token) {
    return { ragFile: {} as RagFile, error: "Failed to get access token" };
  }

  // Convert string content to Buffer if needed
  const contentBuffer = typeof fileContent === "string" 
    ? Buffer.from(fileContent, "utf-8") 
    : fileContent;

  // Create multipart form data
  const boundary = `----VertexRAGUpload${Date.now()}`;
  const metadata = {
    ragFile: {
      displayName: displayName || fileName,
    },
  };

  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const endBoundary = `\r\n--${boundary}--`;

  const bodyParts = [
    Buffer.from(metadataPart, "utf-8"),
    Buffer.from(filePart, "utf-8"),
    contentBuffer,
    Buffer.from(endBoundary, "utf-8"),
  ];
  const body = Buffer.concat(bodyParts);

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/upload/v1beta1/${corpusName}/ragFiles:upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
      },
      body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[VertexRAG] Upload file error:", error);
    return { ragFile: {} as RagFile, error: `Failed to upload file: ${error}` };
  }

  const data = (await response.json()) as { ragFile: RagFile };
  console.log(`[VertexRAG] Uploaded file: ${data.ragFile.name}`);
  return { ragFile: data.ragFile };
}

/**
 * Import files from Google Drive into a RAG corpus
 * @param resourceId - The Google Drive folder or file ID (from the URL)
 * @param resourceType - Either "folder" or "file"
 */
export async function importFromGoogleDrive(
  corpusId: string,
  resourceId: string,
  resourceType: "folder" | "file" = "folder",
  config?: ImportRagFilesConfig
): Promise<ImportOperationResult> {
  if (!isVertexRagConfigured()) {
    return { operationName: "", error: "Vertex AI RAG not configured" };
  }

  console.log(`[VertexRAG] Importing from Google Drive ${resourceType}: ${resourceId}`);

  const headers = await getAuthHeaders();

  const corpusName = corpusId.startsWith("projects/")
    ? corpusId
    : `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}`;

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles:import`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        importRagFilesConfig: {
          googleDriveSource: {
            resourceIds: [
              {
                resourceId: resourceId,
                resourceType: resourceType === "folder" ? "RESOURCE_TYPE_FOLDER" : "RESOURCE_TYPE_FILE",
              },
            ],
          },
          ragFileChunkingConfig: config?.ragFileChunkingConfig || {
            chunkSize: 512,
            chunkOverlap: 100,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[VertexRAG] Google Drive import error:", error);
    return { operationName: "", error: `Failed to import from Google Drive: ${error}` };
  }

  const operation = (await response.json()) as { name: string };
  console.log(`[VertexRAG] Google Drive import operation started: ${operation.name}`);
  return { operationName: operation.name };
}

/**
 * Import raw text content into a RAG corpus by uploading as a text file
 * This converts text chunks into a single text file and uploads it directly
 */
export async function importTextToCorpus(
  corpusId: string,
  textChunks: string[],
  displayName: string,
  config?: ImportRagFilesConfig
): Promise<{ operationName: string | null; ragFile?: RagFile; error?: string }> {
  if (!isVertexRagConfigured()) {
    return { operationName: null, error: "Vertex AI RAG not configured" };
  }

  // Combine chunks into a single text document with separators
  const combinedText = textChunks.join("\n\n---\n\n");
  const fileName = `${displayName.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;

  console.log(`[VertexRAG] Converting ${textChunks.length} chunks to file: ${fileName}`);

  // Use the direct file upload API
  const result = await uploadFileToCorpus(
    corpusId,
    combinedText,
    fileName,
    "text/plain",
    displayName
  );

  if (result.error) {
    return { operationName: null, error: result.error };
  }

  return { operationName: null, ragFile: result.ragFile };
}

/**
 * Import files from Google Cloud Storage into a RAG corpus
 */
export async function importFilesToCorpus(
  corpusId: string,
  gcsUri: string,
  config?: ImportRagFilesConfig
): Promise<void> {
  if (!isVertexRagConfigured()) {
    throw new Error("Vertex AI RAG not configured");
  }

  console.log(`[VertexRAG] Importing files to corpus: ${corpusId}`);

  const headers = await getAuthHeaders();

  const corpusName = corpusId.startsWith("projects/")
    ? corpusId
    : `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}`;

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles:import`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        importRagFilesConfig: {
          gcsSource: {
            uris: [gcsUri],
          },
          ragFileChunkingConfig: config?.ragFileChunkingConfig || {
            chunkSize: 512,
            chunkOverlap: 100,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to import files: ${error}`);
  }

  const operation = (await response.json()) as { name: string };
  console.log(`[VertexRAG] Import operation started: ${operation.name}`);
}

/**
 * List files in a RAG corpus
 */
export async function listRagFiles(corpusId: string): Promise<RagFile[]> {
  if (!isVertexRagConfigured()) return [];

  const headers = await getAuthHeaders();

  const corpusName = corpusId.startsWith("projects/")
    ? corpusId
    : `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}`;

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${corpusName}/ragFiles`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list RAG files: ${error}`);
  }

  const data = (await response.json()) as { ragFiles?: RagFile[] };
  return data.ragFiles || [];
}

/**
 * Delete a file from a RAG corpus
 */
export async function deleteRagFile(corpusId: string, fileId: string): Promise<void> {
  if (!isVertexRagConfigured()) return;

  const headers = await getAuthHeaders();

  const fileName = `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}/ragFiles/${fileId}`;

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${fileName}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete RAG file: ${error}`);
  }

  console.log(`[VertexRAG] Deleted file: ${fileId}`);
}

/**
 * Get or create a corpus for an organization
 * Returns the corpus ID (creates one if it doesn't exist)
 */
export async function getOrCreateCorpusForOrg(
  orgId: string,
  existingCorpusId?: string | null
): Promise<string | null> {
  if (!isVertexRagConfigured()) {
    console.log("[VertexRAG] Not configured, skipping corpus creation");
    return null;
  }

  // If we have an existing corpus ID, verify it exists
  if (existingCorpusId) {
    const corpus = await getRagCorpus(existingCorpusId);
    if (corpus) {
      return existingCorpusId;
    }
    console.log(`[VertexRAG] Existing corpus ${existingCorpusId} not found, creating new one`);
  }

  // Create a new corpus for this org
  const corpus = await createRagCorpus(orgId, `${orgId}_knowledge`);

  // Extract the corpus ID from the full name
  // Format: projects/{project}/locations/{location}/ragCorpora/{corpusId}
  const parts = corpus.name.split("/");
  return parts[parts.length - 1];
}

/**
 * Build the RAG tool configuration for Gemini Live API
 * This is passed to the session config to enable automatic retrieval
 */
export function buildRagToolConfig(corpusId: string, storeContext: boolean = true) {
  const corpusName = corpusId.startsWith("projects/")
    ? corpusId
    : `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${corpusId}`;

  return {
    retrieval: {
      vertexRagStore: {
        ragResources: [
          {
            ragCorpus: corpusName,
          },
        ],
        storeContext,
      },
    },
  };
}

/**
 * Check the status of an import operation
 */
export async function checkImportOperation(
  operationName: string
): Promise<{ done: boolean; error?: string }> {
  if (!isVertexRagConfigured()) {
    return { done: false, error: "Vertex AI RAG not configured" };
  }

  const headers = await getAuthHeaders();

  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${operationName}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { done: false, error: `Failed to check operation: ${error}` };
  }

  const data = (await response.json()) as { done?: boolean; error?: { message: string } };
  if (data.error) {
    return { done: true, error: data.error.message };
  }
  return { done: data.done || false };
}

export const vertexRagService = {
  isVertexRagConfigured,
  createRagCorpus,
  getRagCorpus,
  listRagCorpora,
  deleteRagCorpus,
  uploadFileToCorpus,
  importFromGoogleDrive,
  importTextToCorpus,
  importFilesToCorpus,
  listRagFiles,
  deleteRagFile,
  getOrCreateCorpusForOrg,
  buildRagToolConfig,
  checkImportOperation,
  PROJECT_ID,
  LOCATION,
};
