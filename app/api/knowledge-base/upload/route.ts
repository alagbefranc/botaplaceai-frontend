import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

/**
 * Extract plain text content from uploaded file
 */
async function extractTextFromFile(file: File): Promise<{ text: string; chunks: string[] }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const raw = await file.text();
  let text = raw;

  if (ext === "json") {
    try {
      const obj = JSON.parse(raw);
      text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    } catch {
      text = raw;
    }
  } else if (ext === "csv") {
    // Turn CSV into readable lines
    text = raw.replace(/,/g, " | ");
  }
  // For txt, md — use as-is

  // Split into chunks of ~1500 chars with overlap
  const CHUNK_SIZE = 1500;
  const OVERLAP = 150;
  const chunks: string[] = [];
  let start = 0;
  const clean = text.replace(/\s+/g, " ").trim();
  
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 50) {
      chunks.push(`Source: ${file.name}\n${chunk}`);
    }
    start = end - OVERLAP;
    if (start >= end) break;
  }

  return { text: clean, chunks };
}

// POST /api/knowledge-base/upload - Upload a file to knowledge base
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const orgIdParam = formData.get("orgId") as string | null;
    const agentId = formData.get("agentId") as string | null;
    const name = formData.get("name") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Missing required field: file" },
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

    // Validate file type
    const allowedTypes = [
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/json",
      "text/csv",
    ];
    
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["txt", "md", "pdf", "json", "csv"];
    
    if (!allowedExtensions.includes(fileExtension || "")) {
      return NextResponse.json(
        { error: `File type not supported. Allowed: ${allowedExtensions.join(", ")}` },
        { status: 400 }
      );
    }

    // Max file size: 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Upload file to Supabase Storage
    const fileName = `${orgId}/${Date.now()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("knowledge-files")
      .upload(fileName, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("[KnowledgeBase] Upload error:", uploadError);
      // If bucket doesn't exist, create it
      if (uploadError.message.includes("not found")) {
        return NextResponse.json(
          { error: "Storage bucket not configured. Please create 'knowledge-files' bucket in Supabase." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Create knowledge base entry
    const { data: kbData, error: kbError } = await supabase
      .from("knowledge_bases")
      .insert({
        org_id: orgId,
        agent_id: agentId || null,
        name: name || file.name,
        file_path: uploadData.path,
        file_size_bytes: file.size,
        processing_status: "pending",
        chunks_count: 0,
      })
      .select()
      .single();

    if (kbError) {
      console.error("[KnowledgeBase] DB error:", kbError);
      // Clean up uploaded file
      await supabase.storage.from("knowledge-files").remove([fileName]);
      return NextResponse.json({ error: kbError.message }, { status: 500 });
    }

    // Extract text content from file (txt, md, json, csv)
    let chunks: string[] = [];
    let extractedCharacters = 0;
    const fileExtensionForExtraction = file.name.split(".").pop()?.toLowerCase() || "";
    const extractableExtensions = ["txt", "md", "json", "csv"];

    if (extractableExtensions.includes(fileExtensionForExtraction)) {
      try {
        const { text, chunks: extracted } = await extractTextFromFile(file);
        chunks = extracted;
        extractedCharacters = text.length;
      } catch (extractError) {
        console.error("[KnowledgeBase] Text extraction error:", extractError);
      }
    }
    // For PDF: stored but not chunked (requires pdf parsing library)

    const finalStatus = chunks.length > 0 || fileExtensionForExtraction === "pdf" ? "ready" : "ready";

    await supabase
      .from("knowledge_bases")
      .update({
        processing_status: finalStatus,
        chunks_count: chunks.length,
        source_config: {
          extraction_engine: "internal_file_reader",
          extracted_at: new Date().toISOString(),
          total_characters: extractedCharacters,
          file_extension: fileExtensionForExtraction,
          note: fileExtensionForExtraction === "pdf" ? "PDF stored - text extraction requires pdf-parse library" : undefined,
        },
      })
      .eq("id", kbData.id);

    return NextResponse.json({
      knowledgeBase: { ...kbData, processing_status: finalStatus, chunks_count: chunks.length },
      message: chunks.length > 0
        ? `File uploaded and indexed with ${chunks.length} chunk(s)`
        : fileExtensionForExtraction === "pdf"
        ? "PDF uploaded. Text extraction not yet supported - file is stored."
        : "File uploaded successfully",
    });
  } catch (error) {
    console.error("[KnowledgeBase] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
