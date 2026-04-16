const SUPADATA_BASE = "https://api.supadata.ai/v1";

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1).split("?")[0] || null;
    }
    if (u.hostname.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

export interface TranscriptResult {
  transcript: string;
  videoId: string;
  lang: string;
  availableLangs: string[];
  creditsUsed: string | null;
}

async function pollJobResult(
  jobId: string,
  apiKey: string
): Promise<{ content: string; lang: string; availableLangs: string[] }> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const res = await fetch(`${SUPADATA_BASE}/transcript/${jobId}`, {
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) {
      const err = new Error(`Job poll failed: ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }

    const job = await res.json();
    if (job.status === "completed") {
      return { content: job.content, lang: job.lang, availableLangs: job.availableLangs ?? [] };
    }
    if (job.status === "failed") {
      throw new Error(`Job failed: ${job.error ?? "unknown"}`);
    }
    // queued / active → 계속 폴링
  }
  throw new Error("Job timeout (60s)");
}

export async function fetchTranscriptText(url: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    const err = new Error("invalid YouTube URL") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    const err = new Error("SUPADATA_API_KEY 환경변수 미설정") as Error & { status: number };
    err.status = 500;
    throw err;
  }

  const params = new URLSearchParams({
    url,
    text: "true",
    mode: "native",
  });

  const response = await fetch(`${SUPADATA_BASE}/transcript?${params}`, {
    headers: { "x-api-key": apiKey },
  });

  const creditsUsed = response.headers.get("x-billable-requests");

  // 202: 20분 초과 영상 — async job
  if (response.status === 202) {
    const { jobId } = await response.json();
    const job = await pollJobResult(jobId, apiKey);
    return {
      transcript: job.content,
      videoId,
      lang: job.lang,
      availableLangs: job.availableLangs,
      creditsUsed,
    };
  }

  // 206: 자막 없음 (mode=native)
  if (response.status === 206) {
    const err = new Error("이 영상에는 자막이 없습니다") as Error & {
      status: number;
      code: string;
      canRetryWithAI: boolean;
    };
    err.status = 400;
    err.code = "NO_TRANSCRIPT";
    err.canRetryWithAI = true;
    throw err;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    const err = new Error(`Supadata API ${response.status}: ${errorBody}`) as Error & {
      status: number;
    };
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  // data: { content: string, lang: string, availableLangs: string[] }

  return {
    transcript: data.content,
    videoId,
    lang: data.lang,
    availableLangs: data.availableLangs ?? [],
    creditsUsed,
  };
}
