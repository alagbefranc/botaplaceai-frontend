import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status")?.trim() ?? "";
    const source = searchParams.get("source")?.trim() ?? "";
    const tag = searchParams.get("tag")?.trim() ?? "";
    const sortField = searchParams.get("sortField") ?? "created_at";
    const sortDir = searchParams.get("sortDir") === "ascend" ? true : false;

    let query = admin
      .from("contacts")
      .select("*", { count: "exact" })
      .eq("org_id", member.orgId);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (source) {
      query = query.eq("source", source);
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }

    const allowedSorts = ["name", "phone", "company", "status", "source", "created_at", "updated_at"];
    const safeSort = allowedSorts.includes(sortField) ? sortField : "created_at";
    query = query
      .order(safeSort, { ascending: sortDir })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      contacts: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load contacts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });
    const body = await request.json().catch(() => null);

    if (!body?.name?.trim() || !body?.phone?.trim()) {
      return NextResponse.json({ error: "name and phone are required." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("contacts")
      .insert({
        org_id: member.orgId,
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: body.email?.trim() || null,
        company: body.company?.trim() || null,
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [],
        notes: body.notes?.trim() || null,
        source: "manual",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to create contact.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
