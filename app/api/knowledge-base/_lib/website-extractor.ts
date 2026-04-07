export interface ExtractedWebsitePage {
  url: string;
  title: string | null;
  excerpt: string;
  charCount: number;
}

export interface WebsiteExtractionResult {
  normalizedUrl: string;
  pages: ExtractedWebsitePage[];
  chunks: string[];
  totalCharacters: number;
}

const MAX_PAGES_TO_CRAWL = 6;
const MAX_PAGE_TEXT_LENGTH = 14000;
const MAX_TOTAL_TEXT_LENGTH = 70000;
const FETCH_TIMEOUT_MS = 12000;
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 180;

export function normalizeWebsiteUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();

  if (!trimmed) {
    throw new Error("Website URL is required");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  const parsedUrl = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Website URL must use http or https");
  }

  parsedUrl.hash = "";

  return parsedUrl.toString();
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch?.[1]) {
    return null;
  }

  return decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim().slice(0, 180) || null;
}

function stripHtmlToText(html: string) {
  const withoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");

  const withoutTags = withoutScripts
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withoutTags)
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n +/g, "\n")
    .trim();
}

function extractInternalLinks(html: string, baseUrl: string, origin: string) {
  const links: string[] = [];
  const hrefRegex = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi;

  let match = hrefRegex.exec(html);
  while (match) {
    const href = match[1];

    try {
      const parsedUrl = new URL(href, baseUrl);
      if (parsedUrl.origin !== origin) {
        match = hrefRegex.exec(html);
        continue;
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        match = hrefRegex.exec(html);
        continue;
      }

      parsedUrl.hash = "";
      links.push(parsedUrl.toString());
    } catch {
      // Skip malformed links
    }

    match = hrefRegex.exec(html);
  }

  return links;
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "OmnichannelAI-KBBot/1.0 (+KnowledgeBaseIndexer)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return null;
    }

    const html = await response.text();

    return {
      html,
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function chunkText(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end));

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}

export async function extractWebsiteData(rawUrl: string): Promise<WebsiteExtractionResult> {
  const normalizedUrl = normalizeWebsiteUrl(rawUrl);
  const origin = new URL(normalizedUrl).origin;

  const queue: string[] = [normalizedUrl];
  const visited = new Set<string>();
  const pages: ExtractedWebsitePage[] = [];
  const pagePayloads: string[] = [];

  let totalCharacters = 0;

  while (
    queue.length > 0
    && pages.length < MAX_PAGES_TO_CRAWL
    && totalCharacters < MAX_TOTAL_TEXT_LENGTH
  ) {
    const targetUrl = queue.shift();
    if (!targetUrl) {
      continue;
    }

    if (visited.has(targetUrl)) {
      continue;
    }

    visited.add(targetUrl);

    const fetched = await fetchHtml(targetUrl);
    if (!fetched) {
      continue;
    }

    const text = stripHtmlToText(fetched.html).slice(0, MAX_PAGE_TEXT_LENGTH).trim();
    const title = extractTitle(fetched.html);

    if (text.length > 80) {
      pages.push({
        url: fetched.finalUrl,
        title,
        excerpt: text.slice(0, 280),
        charCount: text.length,
      });

      pagePayloads.push(`Source URL: ${fetched.finalUrl}\n${text}`);
      totalCharacters += text.length;
    }

    const discoveredLinks = extractInternalLinks(fetched.html, fetched.finalUrl, origin);
    for (const link of discoveredLinks) {
      if (visited.has(link) || queue.includes(link)) {
        continue;
      }

      if (queue.length + pages.length >= MAX_PAGES_TO_CRAWL * 4) {
        break;
      }

      queue.push(link);
    }
  }

  const combinedText = pagePayloads.join("\n\n");
  const chunks = chunkText(combinedText);

  return {
    normalizedUrl,
    pages,
    chunks,
    totalCharacters,
  };
}
