"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

export interface ProviderVoice {
  id: string;
  name: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
}

interface CacheEntry {
  voices: ProviderVoice[];
  ts: number;
}

// Module-level cache shared across all hook instances
const voiceCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches voices from the backend proxy for a given TTS provider.
 * Caches results so switching providers back and forth doesn't re-fetch.
 */
export function useProviderVoices(provider: string | undefined) {
  const [voices, setVoices] = useState<ProviderVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchVoices = useCallback(async (prov: string) => {
    // Check cache first
    const cached = voiceCache.get(prov);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setVoices(cached.voices);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${BACKEND_URL}/voices/${prov}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error || `HTTP ${res.status}`
        );
      }
      const data = (await res.json()) as { voices: ProviderVoice[] };
      voiceCache.set(prov, { voices: data.voices, ts: Date.now() });
      setVoices(data.voices);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
      setVoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!provider) {
      setVoices([]);
      return;
    }
    fetchVoices(provider);
    return () => abortRef.current?.abort();
  }, [provider, fetchVoices]);

  return { voices, loading, error };
}
