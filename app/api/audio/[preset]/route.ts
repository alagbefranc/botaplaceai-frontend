import { NextRequest, NextResponse } from "next/server";

/** CDN URLs for each hold music preset (same source as lib/domain/agent-builder.ts) */
const PRESET_CDN_URLS: Record<string, string> = {
  classical_1: "https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3",
  jazz_1:      "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
  ambient_1:   "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3",
  corporate_1: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bcd.mp3",
  upbeat_1:    "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b0939c6.mp3",
};

/**
 * GET /api/audio/[preset]
 * Server-side proxy for hold music preset audio files.
 * Fetches from the CDN and re-serves with CORS headers so the browser
 * can play via new Audio('/api/audio/jazz_1') without CORS errors.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ preset: string }> }
) {
  const { preset } = await params;
  const cdnUrl = PRESET_CDN_URLS[preset];

  if (!cdnUrl) {
    return new NextResponse("Unknown preset", { status: 404 });
  }

  try {
    const upstream = await fetch(cdnUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AudioProxy/1.0)",
        Accept: "audio/mpeg, audio/*",
      },
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status}`, {
        status: 502,
      });
    }

    const contentType =
      upstream.headers.get("content-type") || "audio/mpeg";

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[AudioProxy] Failed to fetch CDN audio:", err);
    return new NextResponse("Failed to fetch audio", { status: 502 });
  }
}
