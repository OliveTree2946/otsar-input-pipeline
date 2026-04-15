import { NextResponse } from "next/server";
import { assertSecret } from "@/lib/auth";
import { fetchTranscriptText } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    assertSecret(req);
    const { url } = (await req.json()) as { url?: string };
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

    const { transcript, videoId } = await fetchTranscriptText(url);
    return NextResponse.json({ transcript, videoId });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
