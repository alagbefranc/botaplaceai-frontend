const GEMINI_KEY_ENV_NAMES = [
  "BUILDER_LLM_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "NEXT_PUBLIC_GEMINI_API_KEY",
  "NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY",
] as const;

function normalizeGeminiKey(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unwrapped = trimmed.slice(1, -1).trim();
    return unwrapped.length > 0 ? unwrapped : null;
  }

  return trimmed;
}

export function getGeminiApiKey(): string | null {
  for (const envName of GEMINI_KEY_ENV_NAMES) {
    const normalized = normalizeGeminiKey(process.env[envName]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function getGeminiApiKeyEnvNames(): readonly string[] {
  return GEMINI_KEY_ENV_NAMES;
}
