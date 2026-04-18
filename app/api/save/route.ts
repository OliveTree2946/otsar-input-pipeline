import { NextResponse } from "next/server";
import { assertSecret } from "@/lib/auth";
import { commitFile } from "@/lib/github";
import { renderNodeMarkdown, timestampSuffix, vaultPathForNode } from "@/lib/markdown";
import { ParseResultSchema, SOURCE_TYPES, type SourceType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    assertSecret(req);
    const body = (await req.json()) as {
      parseResult?: unknown;
      sourceType?: string;
      sourceUrl?: string;
    };

    if (!body.sourceType || !SOURCE_TYPES.includes(body.sourceType as SourceType)) {
      return NextResponse.json({ error: "invalid sourceType" }, { status: 400 });
    }
    const parsed = ParseResultSchema.safeParse(body.parseResult);
    if (!parsed.success) {
      return NextResponse.json({ error: `invalid parseResult: ${parsed.error.message}` }, { status: 400 });
    }

    const parseResult = parsed.data;
    const sourceType = body.sourceType as SourceType;
    const sourceUrl = body.sourceUrl ?? "";
    const createdISODate = new Date().toISOString().slice(0, 10);
    const suffix = timestampSuffix();
    const committed: {
      path: string;
      htmlUrl: string;
      nodeId: string;
      skipped: boolean;
    }[] = [];

    for (const node of parseResult.nodes) {
      const content = renderNodeMarkdown(node, {
        sourceType,
        sourceUrl,
        createdISODate,
        parseResult,
      });
      const primaryPath = vaultPathForNode(node, createdISODate);
      const altPath = vaultPathForNode(node, createdISODate, suffix);
      const result = await commitFile({
        path: primaryPath,
        altPathIfExists: altPath,
        content,
        message: `[input-pipeline] Add ${node.type}: ${node.label}`,
        expectedSource: { sourceType, sourceUrl },
      });
      committed.push({
        path: result.path,
        htmlUrl: result.htmlUrl,
        nodeId: node.id,
        skipped: result.skipped === true,
      });
    }

    return NextResponse.json({ committed });
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
