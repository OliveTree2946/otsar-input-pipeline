import { NextResponse } from "next/server";
import { assertSecret } from "@/lib/auth";
import { parseWithClaude, ParseFailedError } from "@/lib/claude-parser";
import { SOURCE_TYPES, type SourceType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    assertSecret(req);
    const body = (await req.json()) as { text?: string; sourceType?: string; sourceUrl?: string };
    if (!body.text || !body.sourceType) {
      return NextResponse.json({ error: "text and sourceType required" }, { status: 400 });
    }
    if (!SOURCE_TYPES.includes(body.sourceType as SourceType)) {
      return NextResponse.json({ error: "invalid sourceType" }, { status: 400 });
    }

    const { result, truncated, rawResponse } = await parseWithClaude({
      text: body.text,
      sourceType: body.sourceType as SourceType,
      sourceUrl: body.sourceUrl,
    });
    return NextResponse.json({ result, truncated, rawResponse });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (e instanceof ParseFailedError) {
      return NextResponse.json(
        { error: err.message, rawResponse: e.rawResponse },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
