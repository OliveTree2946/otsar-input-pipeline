import { NextResponse } from "next/server";
import { assertSecret } from "@/lib/auth";
import { fetchTranscriptText } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 30;

function classifyError(error: any): string {
  const code: string = error?.code ?? "";
  const status: number = error?.status ?? 500;
  const msg: string = error?.message ?? String(error);

  if (code === "NO_TRANSCRIPT" || msg.includes("자막이 없습니다")) {
    return "이 영상에는 자막이 없습니다";
  }
  if (status === 401 || msg.includes("401")) {
    return "인증 실패 — API 키 확인 필요";
  }
  if (status === 403 || msg.includes("403")) {
    return "접근 제한 영상입니다";
  }
  if (status === 404 || msg.includes("not found") || msg.includes("404")) {
    return "영상을 찾을 수 없습니다";
  }
  if (status === 429 || msg.includes("429")) {
    return "월 사용량 초과 — Supadata 대시보드 확인 필요";
  }
  return "자막 추출 오류 — Vercel Logs 확인 필요";
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

    const { transcript, videoId, lang, availableLangs, creditsUsed } =
      await fetchTranscriptText(originalUrl);
    videoID = videoId;

    console.log(`[EC-027] Credits used: ${creditsUsed}, lang: ${lang}`);

    return NextResponse.json({ transcript, videoId, lang, availableLangs, creditsUsed });
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
