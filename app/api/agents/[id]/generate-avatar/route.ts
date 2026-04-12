import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { getGeminiApiKey } from "@/lib/server/gemini-api-key";

export const runtime = "nodejs";

const AVATAR_PROMPT =
  "Generate a minimalist black and white hand-drawn illustration portrait avatar of a unique person. " +
  "Simple clean line art style on a plain light gray (#e8e8e8) background. " +
  "Head and shoulders only, facing slightly to the side. " +
  "The style should look like a quick ink sketch — expressive but simple. " +
  "No text, no labels, no watermarks. Square aspect ratio.";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { admin, member } = await getOrgMemberContext();

    // Verify agent belongs to org
    const { data: agent, error: agentError } = await admin
      .from("agents")
      .select("id, name")
      .eq("id", agentId)
      .eq("org_id", member.orgId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get Gemini API key
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Generate image with Gemini
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-05-20",
      contents: `${AVATAR_PROMPT} This avatar represents an AI agent named "${agent.name}".`,
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    // Extract image data from response
    let imageBase64: string | null = null;
    let mimeType = "image/png";

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageBase64) {
      return NextResponse.json(
        { error: "Failed to generate avatar image" },
        { status: 500 }
      );
    }

    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(imageBase64, "base64");
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const filePath = `${member.orgId}/${agentId}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("agent-avatars")
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[GenerateAvatar] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = admin.storage.from("agent-avatars").getPublicUrl(filePath);

    // Add cache-busting parameter
    const avatarUrl = `${publicUrl}?v=${Date.now()}`;

    // Update agent record
    const { error: updateError } = await admin
      .from("agents")
      .update({ avatar_url: avatarUrl })
      .eq("id", agentId);

    if (updateError) {
      console.error("[GenerateAvatar] DB update error:", updateError);
      return NextResponse.json(
        { error: "Failed to save avatar URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (error: unknown) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to generate avatar";
    console.error("[GenerateAvatar] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/agents/[id]/generate-avatar - Reset to DiceBear default
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { admin, member } = await getOrgMemberContext();

    // Clear avatar_url
    const { error } = await admin
      .from("agents")
      .update({ avatar_url: null })
      .eq("id", agentId)
      .eq("org_id", member.orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Try to remove the file from storage (non-critical)
    await admin.storage
      .from("agent-avatars")
      .remove([`${member.orgId}/${agentId}.png`, `${member.orgId}/${agentId}.jpg`])
      .catch(() => {});

    return NextResponse.json({ avatar_url: null });
  } catch (error: unknown) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to reset avatar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
