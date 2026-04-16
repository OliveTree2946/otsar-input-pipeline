import { NextResponse } from "next/server";
import { assertSecret } from "@/lib/auth";
import { fetchTranscriptText } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 30;

function classifyError(error: any): string {
  const msg: string = error?.message ?? String(error);
  const lower = msg.toLowerCase();
  if (error?.code === "NO_SUBTITLES" || lower.includes("자막이 비활성화")) {
    return "자막이 비활성화된 영상입니다";
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return "영상을 찾을 수 없습니다";
  }
  if (lower.includes("subtitles") || lower.includes("caption")) {
    return "자막 추출 중 오류 발생 (재시도 요망)";
  }
  return "알 수 없는 오류 — Vercel Logs 확인 필요";
}

export async function POST(req: Request) {
  let videoID: string | undefined;
  let originalUrl: string | undefined;

  try {
    assertSecret(req);
    const body = (await req.json()) as { url?: string };
    originalUrl = body.url;
    if (!originalUrl) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    const { transcript, videoId, selectedLang, videoTitle } = await fetchTranscriptText(originalUrl);
    videoID = videoId;

    return NextResponse.json({ transcript, videoId, selectedLang, videoTitle });
  } catch (error: any) {
    console.error("[EC-027] YouTube extraction failed:", {
      videoID,
      url: originalUrl,
      errorType: error?.constructor?.name ?? "Unknown",
      errorMessage: error?.message ?? String(error),
      errorStack: error?.stack,
    });

    const status = error?.status ?? 500;
    const userMessage = status === 400 ? (error?.message ?? classifyError(error)) : classifyError(error);
    return NextResponse.json(
      { error: userMessage, code: error?.code ?? "UNKNOWN" },
      { status }
    );
  }
}
