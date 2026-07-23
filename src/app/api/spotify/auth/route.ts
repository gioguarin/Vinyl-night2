import { NextResponse } from "next/server";
import { requireHost } from "@/lib/auth";
import { getAuthUrl } from "@/lib/spotify";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") ?? "";
  const key = url.searchParams.get("key");

  const event = await requireHost(slug, key);
  if (!event) return NextResponse.json({ error: "Invalid host key" }, { status: 401 });

  const state = Buffer.from(JSON.stringify({ slug: event.slug, key })).toString("base64url");
  try {
    return NextResponse.redirect(getAuthUrl(state));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
