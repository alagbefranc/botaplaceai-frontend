/**
 * Agent Avatar Utility
 * Returns the agent's custom avatar URL or a DiceBear-generated fallback.
 * DiceBear "notionists" style produces black-and-white illustrated portraits.
 */

const DICEBEAR_BASE = "https://api.dicebear.com/9.x/notionists/svg";

/**
 * Get the avatar URL for an agent.
 * If the agent has a custom avatar_url (e.g. from Gemini generation), use that.
 * Otherwise, generate a deterministic DiceBear avatar from the agent's ID.
 */
export function getAgentAvatarUrl(
  agentId: string,
  customAvatarUrl?: string | null
): string {
  if (customAvatarUrl) return customAvatarUrl;
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(agentId)}&backgroundColor=e8e8e8&radius=12`;
}
