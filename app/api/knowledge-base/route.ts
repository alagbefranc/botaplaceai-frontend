import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractWebsiteData, normalizeWebsiteUrl } from "./_lib/website-extractor";
import {
  isVertexRagConfigured,
  getOrCreateCorpusForOrg,
  importTextToCorpus,
  uploadFileToCorpus,
} from "@/lib/vertex-rag";
import {
  isVertexSearchConfigured,
  createWebsiteKnowledgeBase,
} from "@/lib/vertex-search";
import {
  downloadDriveFile,
  listDriveFolder,
  chunkText,
} from "@/lib/google-drive-oauth";

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

/**
 * Resolve orgId - handles "_current" placeholder by looking up the agent's org
 */
async function resolveOrgId(
  orgIdParam: string | null,
  agentId: string | null,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<string | null> {
  if (!orgIdParam) return null;
  
  // If not a placeholder, return as-is
  if (orgIdParam !== "_current") return orgIdParam;
  
  // Resolve via agent if available
  if (agentId) {
    const { data: agent } = await supabase
      .from("agents")
      .select("org_id")
      .eq("id", agentId)
      .single();
    if (agent?.org_id) return agent.org_id;
  }
  
  // Fallback: get first org (for single-tenant setups)
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .limit(1);
  return orgs?.[0]?.id || null;
}

function buildWebsiteSourceConfig(options: {
  pages?: Array<{ url: string; title: string | null; excerpt: string; charCount: number }>;
  chunks?: string[];
  totalCharacters?: number;
  extractionError?: string;
  vertexImported?: boolean;
  // Vertex AI Search (primary) fields
  vertexSearchDataStoreId?: string;
  vertexSearchOperationName?: string;
  crawlMethod?: "vertex_search" | "fallback_crawler";
}) {
  return {
    provider: "vertex_ai_search",
    ingestion_mode: "managed_crawl",
    connector: "website",
    crawl_method: options.crawlMethod ?? "fallback_crawler",
    extraction_engine: options.crawlMethod === "vertex_search" ? "google_cloudvertexbot" : "internal_crawler_fallback",
    extracted_at: new Date().toISOString(),
    total_pages: options.pages?.length ?? 0,
    total_characters: options.totalCharacters ?? 0,
    pages: options.pages ?? [],
    sample_chunks: options.chunks?.slice(0, 4) ?? [],
    extraction_error: options.extractionError ?? null,
    vertex_imported: options.vertexImported ?? false,
    // Vertex AI Search specific
    vertex_search_data_store_id: options.vertexSearchDataStoreId ?? null,
    vertex_search_operation_name: options.vertexSearchOperationName ?? null,
  };
}

function buildGoogleDriveSourceConfig(options: {
  driveId: string;
  resourceType: "folder" | "file";
  operationName?: string;
  error?: string;
  vertexImported?: boolean;
  processedFiles?: Array<{ name: string; chunks: number }>;
  totalCharacters?: number;
  chunksCount?: number;
}) {
  return {
    provider: "vertex_ai_search",
    ingestion_mode: "google_drive",
    connector: "google_drive",
    drive_resource_id: options.driveId,
    resource_type: options.resourceType,
    imported_at: new Date().toISOString(),
    operation_name: options.operationName ?? null,
    import_error: options.error ?? null,
    vertex_imported: options.vertexImported ?? false,
    processed_files: options.processedFiles ?? [],
    total_characters: options.totalCharacters ?? 0,
    chunks_count: options.chunksCount ?? 0,
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
    // Get or create corpus for the org
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

    // Store corpus ID in org settings if new
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

    // Import chunks to the corpus as a text file
    const importResult = await importTextToCorpus(corpusId, chunks, name);
    
    if (importResult.error) {
      console.warn(`[KnowledgeBase] Vertex AI import warning: ${importResult.error}`);
      // Still save corpus ID even if import failed - corpus was created
      await supabase
        .from("knowledge_bases")
        .update({ vertex_corpus_id: corpusId })
        .eq("id", kbId);
      return { corpusId, error: importResult.error };
    }

    // Update the knowledge base with the corpus ID
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

// GET /api/knowledge-base - List all knowledge bases for an org
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgIdParam = searchParams.get("orgId");
    const agentId = searchParams.get("agentId");

    const supabase = getSupabaseAdmin();
    const orgId = await resolveOrgId(orgIdParam, agentId, supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Missing or invalid orgId" }, { status: 400 });
    }

    let query = supabase
      .from("knowledge_bases")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[KnowledgeBase] Error fetching:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ knowledgeBases: data });
  } catch (error) {
    console.error("[KnowledgeBase] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/knowledge-base - Create a new knowledge base entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      orgId: orgIdParam, 
      agentId, 
      name, 
      filePath, 
      fileSizeBytes, 
      sourceType, 
      sourceUrl,
      // Google Drive specific fields
      driveResourceId,
      driveResourceType = "folder",
    } = body;
    const resolvedSourceType = sourceType || "file";

    if (resolvedSourceType === "website" && !sourceUrl) {
      return NextResponse.json(
        { error: "Missing required field: sourceUrl for website sources" },
        { status: 400 }
      );
    }

    if (resolvedSourceType === "google_drive" && !driveResourceId) {
      return NextResponse.json(
        { error: "Missing required field: driveResourceId for Google Drive sources" },
        { status: 400 }
      );
    }

    const resolvedSourceUrl =
      resolvedSourceType === "website"
        ? normalizeWebsiteUrl(String(sourceUrl))
        : resolvedSourceType === "google_drive"
          ? `https://drive.google.com/${driveResourceType === "folder" ? "folders" : "file/d"}/${driveResourceId}`
          : sourceUrl || null;

    const processingStatus =
      resolvedSourceType === "website" || resolvedSourceType === "google_drive" 
        ? "processing" 
        : "pending";

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const orgId = await resolveOrgId(orgIdParam, agentId, supabase);

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing or invalid orgId" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("knowledge_bases")
      .insert({
        org_id: orgId,
        agent_id: agentId || null,
        name,
        file_path: filePath || null,
        file_size_bytes: fileSizeBytes || null,
        source_type: resolvedSourceType,
        source_url: resolvedSourceUrl,
        source_config:
          resolvedSourceType === "website"
            ? {
                provider: "vertex_ai_search",
                ingestion_mode: "managed_crawl",
                connector: "website",
              }
            : resolvedSourceType === "google_drive"
              ? {
                  provider: "vertex_ai_search",
                  ingestion_mode: "google_drive",
                  connector: "google_drive",
                  drive_resource_id: driveResourceId,
                  resource_type: driveResourceType,
                }
              : {},
        processing_status: processingStatus,
        chunks_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("[KnowledgeBase] Error creating:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle Google Drive import using org's OAuth token (SaaS-safe, per-org)
    if (resolvedSourceType === "google_drive" && driveResourceId) {
      try {
        // Get org's stored OAuth refresh token
        const { data: org } = await supabase
          .from("organizations")
          .select("id, settings")
          .eq("id", orgId)
          .single();

        const refreshToken = (org?.settings as Record<string, string> | null)?.google_drive_refresh_token;

        if (!refreshToken) {
          const { data: failedKb } = await supabase
            .from("knowledge_bases")
            .update({
              processing_status: "error",
              source_config: buildGoogleDriveSourceConfig({
                driveId: driveResourceId,
                resourceType: driveResourceType as "folder" | "file",
                error: "Google Drive not connected. Please connect your Google Drive first.",
                vertexImported: false,
              }),
            })
            .eq("id", data.id)
            .select()
            .single();

          return NextResponse.json({
            knowledgeBase: failedKb ?? data,
            warning: "Google Drive is not connected for this organization. Please connect it first in the Knowledge Base settings.",
          }, { status: 403 });
        }

        // Download files from Drive using org's OAuth token
        const allChunks: string[] = [];
        const processedFiles: Array<{ name: string; chunks: number }> = [];
        let totalCharacters = 0;

        if (driveResourceType === "folder") {
          // List and download all supported files in the folder
          const files = await listDriveFolder(driveResourceId, refreshToken);
          console.log(`[KnowledgeBase] Found ${files.length} supported files in Drive folder`);

          for (const file of files) {
            try {
              const content = await downloadDriveFile(file.id, refreshToken);
              if (content && content.text.length > 0) {
                const chunks = chunkText(content.text, content.name);
                allChunks.push(...chunks);
                totalCharacters += content.text.length;
                processedFiles.push({ name: content.name, chunks: chunks.length });
              }
            } catch (fileErr) {
              console.warn(`[KnowledgeBase] Could not process ${file.name}:`, fileErr);
            }
          }
        } else {
          // Single file
          const content = await downloadDriveFile(driveResourceId, refreshToken);
          if (content && content.text.length > 0) {
            const chunks = chunkText(content.text, content.name);
            allChunks.push(...chunks);
            totalCharacters += content.text.length;
            processedFiles.push({ name: content.name, chunks: chunks.length });
          }
        }

        const resolvedStatus = allChunks.length > 0 ? "ready" : "error";
        const errorMsg = allChunks.length === 0
          ? driveResourceType === "folder"
            ? "No supported files found in folder (or folder is empty)"
            : "File type not supported or file is empty"
          : undefined;

        // Optionally also index in Vertex AI RAG
        let vertexCorpusId: string | null = null;
        if (allChunks.length > 0) {
          const ragResult = await importToVertexRag(supabase, data.id, orgId, name, allChunks);
          vertexCorpusId = ragResult.corpusId;
        }

        const { data: updatedKb, error: updateError } = await supabase
          .from("knowledge_bases")
          .update({
            processing_status: resolvedStatus,
            chunks_count: allChunks.length,
            vertex_corpus_id: vertexCorpusId,
            source_config: buildGoogleDriveSourceConfig({
              driveId: driveResourceId,
              resourceType: driveResourceType as "folder" | "file",
              error: errorMsg,
              vertexImported: !!vertexCorpusId,
              processedFiles,
              totalCharacters,
              chunksCount: allChunks.length,
            }),
          })
          .eq("id", data.id)
          .select()
          .single();

        if (updateError) throw updateError;

        return NextResponse.json({
          knowledgeBase: updatedKb,
          message: allChunks.length > 0
            ? `Google Drive indexed: ${allChunks.length} chunks from ${processedFiles.length} file(s)`
            : `Google Drive import failed: ${errorMsg}`,
        });
      } catch (driveError) {
        const errorMessage = driveError instanceof Error ? driveError.message : "Google Drive import failed";
        console.error("[KnowledgeBase] Google Drive error:", errorMessage);

        const { data: failedKb } = await supabase
          .from("knowledge_bases")
          .update({
            processing_status: "error",
            source_config: buildGoogleDriveSourceConfig({
              driveId: driveResourceId,
              resourceType: driveResourceType as "folder" | "file",
              error: errorMessage,
              vertexImported: false,
            }),
          })
          .eq("id", data.id)
          .select()
          .single();

        return NextResponse.json({
          knowledgeBase: failedKb ?? data,
          warning: errorMessage,
          message: "Google Drive source added, but import failed.",
        });
      }
    }

    // Handle website extraction with dual approach:
    // 1. PRIMARY: Vertex AI Search (Google-CloudVertexBot crawling)
    // 2. FALLBACK: Custom crawler + Vertex AI RAG Engine upload
    if (resolvedSourceType === "website" && resolvedSourceUrl) {
      let crawlMethod: "vertex_search" | "fallback_crawler" = "fallback_crawler";
      let vertexSearchDataStoreId: string | undefined;
      let vertexSearchOperationName: string | undefined;
      let vertexSearchError: string | undefined;
      let useFallback = false;

      // Step 1: Try Vertex AI Search (Google-CloudVertexBot) first
      if (isVertexSearchConfigured()) {
        console.log(`[KnowledgeBase] Trying Vertex AI Search for: ${resolvedSourceUrl}`);
        const searchResult = await createWebsiteKnowledgeBase(orgId, resolvedSourceUrl, name);
        
        if (searchResult.dataStoreId && !searchResult.fallbackRequired) {
          // Vertex AI Search succeeded - Google-CloudVertexBot will crawl
          crawlMethod = "vertex_search";
          vertexSearchDataStoreId = searchResult.dataStoreId;
          vertexSearchOperationName = searchResult.operationName;
          
          const { data: updatedKnowledgeBase, error: updateError } = await supabase
            .from("knowledge_bases")
            .update({
              source_url: resolvedSourceUrl,
              processing_status: "processing", // Crawling in progress
              vertex_corpus_id: searchResult.dataStoreId, // Store data store ID
              source_config: buildWebsiteSourceConfig({
                crawlMethod: "vertex_search",
                vertexSearchDataStoreId: searchResult.dataStoreId,
                vertexSearchOperationName: searchResult.operationName,
                vertexImported: true,
              }),
            })
            .eq("id", data.id)
            .select()
            .single();

          if (updateError) {
            throw updateError;
          }

          return NextResponse.json({
            knowledgeBase: updatedKnowledgeBase,
            message: `Website indexing started with Google-CloudVertexBot. The crawler will index your site automatically.`,
            crawlMethod: "vertex_search",
            operationName: searchResult.operationName,
          });
        } else {
          // Vertex AI Search failed, need fallback
          useFallback = true;
          vertexSearchError = searchResult.error;
          console.log(`[KnowledgeBase] Vertex AI Search failed, using fallback: ${vertexSearchError}`);
        }
      } else {
        useFallback = true;
        console.log(`[KnowledgeBase] Vertex AI Search not configured, using fallback crawler`);
      }

      // Step 2: Fallback - Use custom crawler + Vertex AI RAG Engine
      if (useFallback) {
        try {
          const extraction = await extractWebsiteData(resolvedSourceUrl);
          const resolvedStatus = extraction.chunks.length > 0 ? "ready" : "error";

          // Try to import to Vertex AI RAG if we have chunks
          let vertexImported = false;
          let vertexError: string | undefined;
          if (extraction.chunks.length > 0) {
            const vertexResult = await importToVertexRag(
              supabase,
              data.id,
              orgId,
              name,
              extraction.chunks
            );
            vertexImported = !!vertexResult.corpusId;
            vertexError = vertexResult.error;
          }

          const { data: updatedKnowledgeBase, error: updateError } = await supabase
            .from("knowledge_bases")
            .update({
              source_url: extraction.normalizedUrl,
              chunks_count: extraction.chunks.length,
              processing_status: resolvedStatus,
              source_config: buildWebsiteSourceConfig({
                crawlMethod: "fallback_crawler",
                pages: extraction.pages,
                chunks: extraction.chunks,
                totalCharacters: extraction.totalCharacters,
                extractionError:
                  resolvedStatus === "error"
                    ? "No extractable text content found on crawled pages."
                    : vertexSearchError || vertexError,
                vertexImported,
              }),
            })
            .eq("id", data.id)
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
                : "Website added, but no extractable text was found.",
            crawlMethod: "fallback_crawler",
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
                crawlMethod: "fallback_crawler",
                extractionError: extractionMessage,
              }),
            })
            .eq("id", data.id)
            .select()
            .single();

          return NextResponse.json({
            knowledgeBase: failedKnowledgeBase ?? data,
            warning: extractionMessage,
            message: "Website added, but extraction failed.",
            crawlMethod: "fallback_crawler",
          });
        }
      }
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
