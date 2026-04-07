/**
 * Vertex AI Context Caching
 * Caches agent system prompts so they are not re-sent on every conversation turn.
 * Minimum cacheable size: 1,024 tokens. TTL: 1 hour (refreshed on agent save).
 *
 * Docs: https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview
 */

import { GoogleGenAI } from "@google/genai";

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT!;
// Gemini context caching uses the global endpoint on Vertex AI.
// VERTEX_AI_LOCATION (europe-west3) is used for Model Garden (Claude/Mistral).
const LOCATION = "global";
const MODEL    = "gemini-3-flash-preview"; // Caching supported on this model

// 1 hour TTL — refreshed every time the agent is saved
const CACHE_TTL_SECONDS = 3600;

// Rough token estimate: 4 chars ≈ 1 token
const MIN_CACHE_CHARS = 4096; // ~1,024 tokens

function vertexClient() {
  return new GoogleGenAI({
    vertexai: true,
    project: PROJECT,
    location: LOCATION,
  });
}

export interface CacheResult {
  cacheId: string;       // full resource name e.g. projects/.../cachedContents/abc
  expiresAt: Date;
}

/**
 * Create a new cached content entry for an agent's system prompt.
 * Returns null if the prompt is too short to be worth caching.
 */
export async function createAgentCache(
  systemPrompt: string,
  agentName: string
): Promise<CacheResult | null> {
  if (systemPrompt.length < MIN_CACHE_CHARS) return null;

  const ai = vertexClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

  try {
    const cache = await ai.caches.create({
      model: MODEL,
      config: {
        displayName: `agent-${agentName.toLowerCase().replace(/\s+/g, "-")}`,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        ttl: `${CACHE_TTL_SECONDS}s`,
      },
    });

    return {
      cacheId: cache.name!,
      expiresAt,
    };
  } catch (err: any) {
    // Vertex requires at least 1,024 tokens — if the prompt is below that (despite
    // the character check), skip caching rather than crashing the save flow.
    const msg = err?.message ?? "";
    if (msg.includes("minimum token count") || msg.includes("INVALID_ARGUMENT")) {
      return null;
    }
    throw err;
  }
}

/**
 * Update TTL on an existing cache (refresh so it doesn't expire mid-day).
 */
export async function refreshAgentCache(cacheId: string): Promise<Date> {
  const ai = vertexClient();
  const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

  await ai.caches.update({
    name: cacheId,
    config: { ttl: `${CACHE_TTL_SECONDS}s` },
  });

  return expiresAt;
}

/**
 * Delete a cached content entry (called when agent is deleted or prompt changes significantly).
 */
export async function deleteAgentCache(cacheId: string): Promise<void> {
  try {
    const ai = vertexClient();
    await ai.caches.delete({ name: cacheId });
  } catch {
    // Silently ignore — cache may have already expired
  }
}

/**
 * Decide whether the existing cache is still valid or needs refresh.
 * Refreshes if expiry is within 10 minutes.
 */
export async function ensureAgentCache(
  systemPrompt: string,
  agentName: string,
  existingCacheId: string | null,
  existingExpiresAt: Date | null
): Promise<CacheResult | null> {
  const tenMinutes = 10 * 60 * 1000;
  const needsRefresh =
    !existingCacheId ||
    !existingExpiresAt ||
    existingExpiresAt.getTime() - Date.now() < tenMinutes;

  if (!needsRefresh && existingCacheId && existingExpiresAt) {
    return { cacheId: existingCacheId, expiresAt: existingExpiresAt };
  }

  // If we have a stale cache, delete it first
  if (existingCacheId) {
    await deleteAgentCache(existingCacheId);
  }

  return createAgentCache(systemPrompt, agentName);
}

/**
 * Returns a cachedContent config object to pass into generateContent / bidiGenerateContent.
 */
export function buildCachedContentConfig(cacheId: string) {
  return { cachedContent: cacheId };
}
