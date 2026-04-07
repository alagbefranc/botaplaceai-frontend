import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractWebsiteData, normalizeWebsiteUrl } from "../_lib/website-extractor";
import {
  isVertexRagConfigured,
  getOrCreateCorpusForOrg,
  importTextToCorpus,
} from "@/lib/vertex-rag";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase admin environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function buildWebsiteSourceConfig(options: {
  pages?: Array<{ url: string; title: string | null; excerpt: string; charCount: number }>;
  chunks?: string[];
  totalCharacters?: number;
  extractionError?: string;
  vertexImported?: boolean;
}) {
  return {
    provider: "vertex_ai_search",
    ingestion_mode: "managed_crawl",
    connector: "website",
    extraction_engine: "internal_crawler_fallback",
    extracted_at: new Date().toISOString(),
    total_pages: options.pages?.length ?? 0,
    total_characters: options.totalCharacters ?? 0,
    pages: options.pages ?? [],
    sample_chunks: options.chunks?.slice(0, 4) ?? [],
    extraction_error: options.extractionError ?? null,
    vertex_imported: options.vertexImported ?? false,
  };
}

/**
 * Import chunks to Vertex AI RAG and update knowledge base with corpus ID
 */
async function importToVertexRag(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  kbId: string,
  orgId: string,
  name: string,
  chunks: string[]
): Promise<{ corpusId: string | null; error?: string }> {
  if (!isVertexRagConfigured()) {
    console.log("[KnowledgeBase] Vertex AI RAG not configured, skipping import");
    return { corpusId: null };
  }

  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("id, settings")
      .eq("id", orgId)
      .single();

    const existingCorpusId = org?.settings?.vertex_corpus_id as string | undefined;
    const corpusId = await getOrCreateCorpusForOrg(orgId, existingCorpusId);

    if (!corpusId) {
      return { corpusId: null, error: "Failed to create corpus" };
    }

    if (!existingCorpusId && corpusId) {
      await supabase
        .from("organizations")
        .update({
          settings: {
            ...(org?.settings || {}),
            vertex_corpus_id: corpusId,
          },
        })
        .eq("id", orgId);
    }

    await importTextToCorpus(corpusId, chunks, name);

    await supabase
      .from("knowledge_bases")
      .update({ vertex_corpus_id: corpusId })
      .eq("id", kbId);

    console.log(`[KnowledgeBase] Imported ${chunks.length} chunks to Vertex AI corpus: ${corpusId}`);
    return { corpusId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Vertex AI import failed";
    console.error("[KnowledgeBase] Vertex AI import error:", errorMessage);
    return { corpusId: null, error: errorMessage };
  }
}

// GET /api/knowledge-base/[id] - Get a single knowledge base
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("knowledge_bases")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[KnowledgeBase] Error fetching:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ knowledgeBase: data });
  } catch (error) {
    console.error("[KnowledgeBase] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/knowledge-base/[id] - Update a knowledge base
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, agentId, processingStatus, chunksCount, reextractWebsite } = body;

    const supabase = getSupabaseAdmin();

    if (reextractWebsite) {
      const { data: currentKnowledgeBase, error: fetchError } = await supabase
        .from("knowledge_bases")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !currentKnowledgeBase) {
        return NextResponse.json(
          { error: fetchError?.message || "Knowledge source not found" },
          { status: 404 }
        );
      }

      if (currentKnowledgeBase.source_type !== "website") {
        return NextResponse.json(
          { error: "Re-extraction is only supported for website sources" },
          { status: 400 }
        );
      }

      if (!currentKnowledgeBase.source_url) {
        return NextResponse.json(
          { error: "Website source is missing source_url" },
          { status: 400 }
        );
      }

      const normalizedUrl = normalizeWebsiteUrl(currentKnowledgeBase.source_url);

      await supabase
        .from("knowledge_bases")
        .update({
          processing_status: "processing",
          source_url: normalizedUrl,
        })
        .eq("id", id);

      try {
        const extraction = await extractWebsiteData(normalizedUrl);
        const resolvedStatus = extraction.chunks.length > 0 ? "ready" : "error";

        // Try to import to Vertex AI RAG if we have chunks
        let vertexImported = false;
        let vertexError: string | undefined;
        if (extraction.chunks.length > 0) {
          const vertexResult = await importToVertexRag(
            supabase,
            id,
            currentKnowledgeBase.org_id,
            currentKnowledgeBase.name,
            extraction.chunks
          );
          vertexImported = !!vertexResult.corpusId;
          vertexError = vertexResult.error;
        }

        const { data: updatedKnowledgeBase, error: updateError } = await supabase
          .from("knowledge_bases")
          .update({
            source_url: extraction.normalizedUrl,
            processing_status: resolvedStatus,
            chunks_count: extraction.chunks.length,
            source_config: buildWebsiteSourceConfig({
              pages: extraction.pages,
              chunks: extraction.chunks,
              totalCharacters: extraction.totalCharacters,
              extractionError:
                resolvedStatus === "error"
                  ? "No extractable text content found on crawled pages."
                  : vertexError,
              vertexImported,
            }),
          })
          .eq("id", id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        const vertexMsg = vertexImported
          ? " Imported to Vertex AI RAG."
          : vertexError
            ? ` Vertex AI: ${vertexError}`
            : "";

        return NextResponse.json({
          knowledgeBase: updatedKnowledgeBase,
          message:
            resolvedStatus === "ready"
              ? `Extracted ${extraction.chunks.length} chunks from ${extraction.pages.length} page(s).${vertexMsg}`
              : "No extractable text was found for this website.",
        });
      } catch (extractionError) {
        const extractionMessage =
          extractionError instanceof Error
            ? extractionError.message
            : "Website extraction failed";

        const { data: failedKnowledgeBase } = await supabase
          .from("knowledge_bases")
          .update({
            processing_status: "error",
            source_config: buildWebsiteSourceConfig({
              extractionError: extractionMessage,
            }),
          })
          .eq("id", id)
          .select()
          .single();

        return NextResponse.json(
          {
            knowledgeBase: failedKnowledgeBase ?? currentKnowledgeBase,
            error: extractionMessage,
          },
          { status: 500 }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (agentId !== undefined) updates.agent_id = agentId;
    if (processingStatus !== undefined) updates.processing_status = processingStatus;
    if (chunksCount !== undefined) updates.chunks_count = chunksCount;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("knowledge_bases")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[KnowledgeBase] Error updating:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ knowledgeBase: data });
  } catch (error) {
    console.error("[KnowledgeBase] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge-base/[id] - Delete a knowledge base
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("knowledge_bases")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[KnowledgeBase] Error deleting:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[KnowledgeBase] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
