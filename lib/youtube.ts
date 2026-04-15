import { YoutubeTranscript } from "youtube-transcript";

export function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
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

export async function fetchTranscriptText(url: string): Promise<{ transcript: string; videoId: string }> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("invalid YouTube URL");

  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  if (!segments?.length) throw new Error("no captions available for this video");
  const transcript = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  if (!transcript) throw new Error("empty transcript");
  return { transcript, videoId };
}
