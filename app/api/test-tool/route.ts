import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "World";

  return NextResponse.json({
    greeting: `Hello, ${name}! This is a response from your custom tool endpoint.`,
    timestamp: new Date().toISOString(),
    source: "test-tool",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : "World";

  return NextResponse.json({
    greeting: `Hello, ${name}! This is a response from your custom tool endpoint.`,
    timestamp: new Date().toISOString(),
    source: "test-tool",
    receivedData: body,
  });
}
