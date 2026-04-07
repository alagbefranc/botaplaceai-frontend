/**
 * Vertex AI Search Service (Discovery Engine)
 * 
 * Uses Google-CloudVertexBot to crawl and index websites.
 * This is the PRIMARY approach for website knowledge bases.
 * Falls back to custom crawler + RAG Engine if this fails.
 */

import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "";
const LOCATION = "global"; // Vertex AI Search works best with global

// Discovery Engine API base URL
const DISCOVERY_API_BASE = `https://discoveryengine.googleapis.com/v1`;

export interface DataStore {
  name: string;
  displayName: string;
  industryVertical?: string;
  solutionTypes?: string[];
  contentConfig?: string;
  createTime?: string;
}

export interface TargetSite {
  name?: string;
  providedUriPattern: string;
  type?: "INCLUDE" | "EXCLUDE";
  exactMatch?: boolean;
  indexingStatus?: string;
  updateTime?: string;
}

export interface SearchResult {
  document?: {
    name: string;
    derivedStructData?: Record<string, unknown>;
  };
  chunks?: Array<{
    content: string;
    relevanceScore?: number;
  }>;
}

let authClient: GoogleAuth | null = null;

/**
 * Get authenticated headers for Discovery Engine API
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (!authClient) {
    if (serviceAccountJson) {
      authClient = new GoogleAuth({
        credentials: JSON.parse(serviceAccountJson),
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        projectId: PROJECT_ID,
      });
    } else {
      // Use ADC with explicit quota project
      authClient = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        projectId: PROJECT_ID,
      });
    }
  }

  const client = await authClient.getClient();
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("Failed to get access token for Discovery Engine");
  }

  return {
    Authorization: `Bearer ${token.token}`,
    "Content-Type": "application/json",
    "x-goog-user-project": PROJECT_ID, // Required for quota project
  };
}

/**
 * Check if Vertex AI Search is configured
 */
export function isVertexSearchConfigured(): boolean {
  return Boolean(PROJECT_ID);
}

/**
 * Create a website data store for crawling
 * This enables Google-CloudVertexBot to crawl your website
 */
export async function createWebsiteDataStore(
  dataStoreId: string,
  displayName: string,
  advancedSiteSearch: boolean = false
): Promise<{ dataStore?: DataStore; operationName?: string; error?: string }> {
  if (!isVertexSearchConfigured()) {
    return { error: "Vertex AI Search not configured" };
  }

  console.log(`[VertexSearch] Creating website data store: ${dataStoreId}`);

  const headers = await getAuthHeaders();
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/collections/default_collection`;

  const response = await fetch(
    `${DISCOVERY_API_BASE}/${parent}/dataStores?dataStoreId=${dataStoreId}&createAdvancedSiteSearch=${advancedSiteSearch}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        displayName,
        industryVertical: "GENERIC",
        solutionTypes: ["SOLUTION_TYPE_SEARCH"],
        contentConfig: "PUBLIC_WEBSITE", // Enables website crawling
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[VertexSearch] Create data store error:", error);
    
    // Check if it already exists
    if (error.includes("ALREADY_EXISTS")) {
      return { dataStore: { name: `${parent}/dataStores/${dataStoreId}`, displayName } };
    }
    
    return { error: `Failed to create data store: ${error}` };
  }

  const operation = (await response.json()) as { name: string };
  console.log(`[VertexSearch] Data store creation started: ${operation.name}`);
  
  return { operationName: operation.name };
}

/**
 * Add a target site (URL pattern) for crawling
 * Google-CloudVertexBot will crawl URLs matching this pattern
 */
export async function addTargetSite(
  dataStoreId: string,
  urlPattern: string,
  type: "INCLUDE" | "EXCLUDE" = "INCLUDE"
): Promise<{ targetSite?: TargetSite; operationName?: string; error?: string }> {
  if (!isVertexSearchConfigured()) {
    return { error: "Vertex AI Search not configured" };
  }

  // Remove protocol from URL pattern (API requirement)
  const cleanPattern = urlPattern.replace(/^https?:\/\//, "");
  
  console.log(`[VertexSearch] Adding target site: ${cleanPattern}`);

  const headers = await getAuthHeaders();
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/collections/default_collection/dataStores/${dataStoreId}/siteSearchEngine`;

  const response = await fetch(
    `${DISCOVERY_API_BASE}/${parent}/targetSites`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        providedUriPattern: cleanPattern,
        type,
        exactMatch: false,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[VertexSearch] Add target site error:", error);
    return { error: `Failed to add target site: ${error}` };
  }

  const operation = (await response.json()) as { name: string };
  console.log(`[VertexSearch] Target site operation: ${operation.name}`);
  
  return { 
    operationName: operation.name,
    targetSite: { providedUriPattern: cleanPattern, type },
  };
}

/**
 * Trigger a recrawl of specific URIs
 */
export async function recrawlUris(
  dataStoreId: string,
  uris: string[]
): Promise<{ operationName?: string; error?: string }> {
  if (!isVertexSearchConfigured()) {
    return { error: "Vertex AI Search not configured" };
  }

  console.log(`[VertexSearch] Requesting recrawl for ${uris.length} URIs`);

  const headers = await getAuthHeaders();
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/collections/default_collection/dataStores/${dataStoreId}/siteSearchEngine`;

  const response = await fetch(
    `${DISCOVERY_API_BASE}/${parent}:recrawlUris`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ uris }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[VertexSearch] Recrawl error:", error);
    return { error: `Failed to recrawl: ${error}` };
  }

  const operation = (await response.json()) as { name: string };
  console.log(`[VertexSearch] Recrawl operation: ${operation.name}`);
  
  return { operationName: operation.name };
}

/**
 * Get data store info
 */
export async function getDataStore(
  dataStoreId: string
): Promise<{ dataStore?: DataStore; error?: string }> {
  if (!isVertexSearchConfigured()) {
    return { error: "Vertex AI Search not configured" };
  }

  const headers = await getAuthHeaders();
  const name = `projects/${PROJECT_ID}/locations/${LOCATION}/collections/default_collection/dataStores/${dataStoreId}`;

  const response = await fetch(
    `${DISCOVERY_API_BASE}/${name}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return { error: "Data store not found" };
    }
    const error = await response.text();
    return { error: `Failed to get data store: ${error}` };
  }

  const dataStore = (await response.json()) as DataStore;
  return { dataStore };
}

/**
 * List target sites for a data store
 */
export async function listTargetSites(
  dataStoreId: string
): Promise<{ targetSites: TargetSite[]; error?: string }> {
  if (!isVertexSearchConfigured()) {
    return { targetSites: [], error: "Vertex AI Search not configured" };
  }

  const headers = await getAuthHeaders();
  const parent = `projects/${PROJECT_ID}/locations/${LOCATION}/collections/default_collection/dataStores/${dataStoreId}/siteSearchEngine`;

  const response = await fetch(
    `${DISCOVERY_API_BASE}/${parent}/targetSites`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { targetSites: [], error: `Failed to list target sites: ${error}` };
  }

  const data = (await response.json()) as { targetSites?: TargetSite[] };
  return { targetSites: data.targetSites || [] };
}

/**
 * Search the indexed website content
 */
export async function searchWebsiteContent(
  dataStoreId: string,
  query: string,
  pageSize: number = 10
): Promise<{ results: SearchResult[]; error?: string }> {
  if (!isVertexSearchConfigured()) {
    return { results: [], error: "Vertex AI Search not configured" };
  }

  const headers = await getAuthHeaders();
  const servingConfig = `projects/${PROJECT_ID}/locations/${LOCATION}/collections/default_collection/dataStores/${dataStoreId}/servingConfigs/default_search`;

  const response = await fetch(
    `${DISCOVERY_API_BASE}/${servingConfig}:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        pageSize,
        queryExpansionSpec: {
          condition: "AUTO",
        },
        spellCorrectionSpec: {
          mode: "AUTO",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[VertexSearch] Search error:", error);
    return { results: [], error: `Search failed: ${error}` };
  }

  const data = (await response.json()) as { results?: SearchResult[] };
  return { results: data.results || [] };
}

/**
 * Check operation status
 */
export async function checkOperation(
  operationName: string
): Promise<{ done: boolean; error?: string; result?: unknown }> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${DISCOVERY_API_BASE}/${operationName}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { done: false, error: `Failed to check operation: ${error}` };
  }

  const data = (await response.json()) as { done?: boolean; error?: { message: string }; response?: unknown };
  
  if (data.error) {
    return { done: true, error: data.error.message };
  }
  
  return { done: data.done || false, result: data.response };
}

/**
 * Create a complete website knowledge base with crawling
 * This is the main entry point for website indexing
 */
export async function createWebsiteKnowledgeBase(
  orgId: string,
  websiteUrl: string,
  displayName: string
): Promise<{
  dataStoreId?: string;
  operationName?: string;
  error?: string;
  fallbackRequired?: boolean;
}> {
  // Generate a unique data store ID
  const dataStoreId = `kb-${orgId}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  
  console.log(`[VertexSearch] Creating website KB for: ${websiteUrl}`);

  // Step 1: Create the data store
  const createResult = await createWebsiteDataStore(dataStoreId, displayName);
  
  if (createResult.error) {
    // If creation fails, signal that fallback is required
    console.warn(`[VertexSearch] Data store creation failed, fallback required: ${createResult.error}`);
    return { error: createResult.error, fallbackRequired: true };
  }

  // Step 2: Add the target site for crawling
  const siteResult = await addTargetSite(dataStoreId, websiteUrl);
  
  if (siteResult.error) {
    console.warn(`[VertexSearch] Target site addition failed: ${siteResult.error}`);
    return { 
      dataStoreId, 
      error: siteResult.error,
      fallbackRequired: true,
    };
  }

  console.log(`[VertexSearch] Website KB created successfully: ${dataStoreId}`);
  
  return {
    dataStoreId,
    operationName: siteResult.operationName,
  };
}

export const vertexSearchService = {
  isVertexSearchConfigured,
  createWebsiteDataStore,
  addTargetSite,
  recrawlUris,
  getDataStore,
  listTargetSites,
  searchWebsiteContent,
  checkOperation,
  createWebsiteKnowledgeBase,
  PROJECT_ID,
  LOCATION,
};
