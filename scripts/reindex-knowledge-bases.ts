/**
 * Reindex pending knowledge bases
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple website extractor
const MAX_PAGES = 6;

interface Page {
  url: string;
  title: string;
  content: string;
  charCount: number;
}

async function fetchPage(url: string): Promise<{ title: string; content: string; links: string[] } | null> {
  try {
    // Skip non-HTML resources
    const skipExtensions = ['.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp'];
    if (skipExtensions.some(ext => url.toLowerCase().endsWith(ext))) {
      return null;
    }
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "OmnichannelAI-KBBot/1.0 (+KnowledgeBaseIndexer)",
      },
    });
    if (!res.ok) return null;
    
    const html = await res.text();
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
    
    // Remove scripts, styles, nav, footer
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    
    // Remove problematic Unicode characters for JSON
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
               .replace(/[\u2000-\u206F\u2E00-\u2E7F]/g, ' ');
    
    // Extract links
    const links: string[] = [];
    const linkMatches = html.matchAll(/href=["']([^"']+)["']/gi);
    const baseUrl = new URL(url);
    for (const match of linkMatches) {
      try {
        const href = match[1];
        if (href.startsWith("/")) {
          links.push(new URL(href, baseUrl.origin).href);
        } else if (href.startsWith(baseUrl.origin)) {
          links.push(href);
        }
      } catch {}
    }
    
    return { title, content: text.slice(0, 10000), links: [...new Set(links)] };
  } catch (e) {
    console.error(`  ❌ Failed to fetch ${url}:`, e);
    return null;
  }
}

async function crawlWebsite(startUrl: string): Promise<{ pages: Page[]; chunks: string[] }> {
  const baseUrl = new URL(startUrl);
  const visited = new Set<string>();
  const toVisit = [startUrl];
  const pages: Page[] = [];
  const chunks: string[] = [];
  
  while (toVisit.length > 0 && pages.length < MAX_PAGES) {
    const url = toVisit.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    
    console.log(`  📄 Crawling: ${url}`);
    const page = await fetchPage(url);
    if (!page) continue;
    
    pages.push({
      url,
      title: page.title,
      content: page.content,
      charCount: page.content.length,
    });
    
    if (page.content.length > 100) {
      chunks.push(`Source URL: ${url}\n${page.title}\n${page.content}`);
    }
    
    // Add internal links
    for (const link of page.links) {
      if (link.startsWith(baseUrl.origin) && !visited.has(link)) {
        toVisit.push(link);
      }
    }
  }
  
  return { pages, chunks };
}

async function main() {
  console.log("🔄 Reindexing pending knowledge bases...\n");

  // Get all pending KBs
  const { data: kbs, error } = await supabase
    .from("knowledge_bases")
    .select("id, name, source_url")
    .eq("processing_status", "pending");

  if (error) {
    console.error("Error:", error);
    return;
  }

  if (!kbs?.length) {
    console.log("✅ No pending knowledge bases found!");
    return;
  }

  console.log(`Found ${kbs.length} pending knowledge bases\n`);

  for (const kb of kbs) {
    console.log(`📚 Processing: ${kb.name}`);
    console.log(`   URL: ${kb.source_url}`);

    if (!kb.source_url) {
      console.log("   ⚠️  No source URL, skipping\n");
      continue;
    }

    try {
      // Crawl the website
      const { pages, chunks } = await crawlWebsite(kb.source_url);
      
      if (chunks.length === 0) {
        // Update to error status
        await supabase
          .from("knowledge_bases")
          .update({
            processing_status: "error",
            source_config: {
              extraction_error: "No content extracted",
              extraction_engine: "internal_crawler_fallback",
              extracted_at: new Date().toISOString(),
            },
          })
          .eq("id", kb.id);
        console.log("   ❌ No content extracted\n");
        continue;
      }

      // Update to ready status
      const { error: updateError } = await supabase
        .from("knowledge_bases")
        .update({
          processing_status: "ready",
          chunks_count: chunks.length,
          source_config: {
            pages,
            total_pages: pages.length,
            total_characters: pages.reduce((sum, p) => sum + p.charCount, 0),
            sample_chunks: chunks.slice(0, 3),
            extraction_engine: "internal_crawler_fallback",
            extracted_at: new Date().toISOString(),
            provider: "internal",
            connector: "website",
          },
        })
        .eq("id", kb.id);

      if (updateError) {
        console.error("   ❌ Update failed:", updateError.message);
      } else {
        console.log(`   ✅ Indexed ${chunks.length} chunks from ${pages.length} pages\n`);
      }
    } catch (e) {
      console.error("   ❌ Error:", e, "\n");
    }
  }

  console.log("🎉 Reindexing complete!");
}

main().catch(console.error);
