import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, SPOTIFY_COOKIE } from "@/lib/spotify";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  let slug = "";
  let key = "";
  try {
    const state = JSON.parse(Buffer.from(stateRaw ?? "", "base64url").toString());
    slug = state.slug ?? "";
    key = state.key ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const back = new URL(`/host/e/${slug}`, url.origin);
  back.searchParams.set("key", key);

  if (denied || !code) {
    back.searchParams.set("spotify", "denied");
    return NextResponse.redirect(back);
  }

  try {
    const tokens = await exchangeCode(code);
    const store = await cookies();
    store.set(SPOTIFY_COOKIE, JSON.stringify(tokens), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    back.searchParams.set("spotify", "connected");
  } catch {
    back.searchParams.set("spotify", "error");
  }
  return NextResponse.redirect(back);
}
