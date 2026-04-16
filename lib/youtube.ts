import { getVideoDetails } from "youtube-caption-extractor";

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
  selectedLang: string;
  videoTitle: string;
}

export async function fetchTranscriptText(url: string): Promise<TranscriptResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    const err = new Error("invalid YouTube URL") as Error & { status: number };
    err.status = 400;
    throw err;
  }

  // Try Korean first, then English. Package does not expose available-lang list,
  // so we probe sequentially and use the first non-empty result.
  for (const lang of ["ko", "en"]) {
    const details = await getVideoDetails({ videoID: videoId, lang });
    if (details.subtitles && details.subtitles.length > 0) {
      const transcript = details.subtitles
        .map((s) => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (transcript) {
        return { transcript, videoId, selectedLang: lang, videoTitle: details.title };
      }
    }
  }

  const err = new Error("자막이 비활성화된 영상입니다") as Error & { status: number; code: string };
  err.status = 400;
  err.code = "NO_SUBTITLES";
  throw err;
}
