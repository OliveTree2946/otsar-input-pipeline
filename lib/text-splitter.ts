const DEFAULT_MAX_CHARS = 10_000;
const OVERLAP_CHARS = 500;

/**
 * 분할점 찾기: targetPos 이전에서 가장 자연스러운 경계를 반환한다.
 * 우선순위: \n\n > \n > 문장끝(. ) > 공백 > 하드컷
 */
function findSplitPoint(text: string, targetPos: number): number {
  const searchFrom = Math.max(0, targetPos - 1_000);
  const segment = text.slice(searchFrom, targetPos);

  // a. 문단 경계 \n\n
  const doubleNewline = segment.lastIndexOf("\n\n");
  if (doubleNewline !== -1) return searchFrom + doubleNewline + 2;

  // b. 줄바꿈 \n
  const newline = segment.lastIndexOf("\n");
  if (newline !== -1) return searchFrom + newline + 1;

  // c. 문장끝 ". " 또는 ".\n" 또는 문자열 끝
  for (let i = segment.length - 1; i >= 0; i--) {
    if (segment[i] === "." && (i + 1 >= segment.length || /\s/.test(segment[i + 1]))) {
      return searchFrom + i + 1;
    }
  }

  // d. 공백
  const space = segment.lastIndexOf(" ");
  if (space !== -1) return searchFrom + space + 1;

  // 최후 수단: 하드컷
  return targetPos;
}

/**
 * 텍스트를 maxChars 단위로 분할한다.
 * - maxChars 이하면 배열 길이 1로 그대로 반환.
 * - 파트 간 OVERLAP_CHARS만큼 겹침 (맥락 단절 방지).
 */
export function splitText(text: string, maxChars: number = DEFAULT_MAX_CHARS): string[] {
  if (text.length <= maxChars) return [text];

  const parts: string[] = [];
  let start = 0;

  while (start < text.length) {
    const remaining = text.length - start;
    if (remaining <= maxChars) {
      parts.push(text.slice(start));
      break;
    }

    const targetEnd = start + maxChars;
    const splitPos = findSplitPoint(text, targetEnd);

    parts.push(text.slice(start, splitPos));

    // 다음 파트는 OVERLAP_CHARS만큼 되돌아가서 시작 (항상 전진 보장)
    const nextStart = splitPos - OVERLAP_CHARS;
    start = nextStart > start ? nextStart : splitPos;
  }

  return parts;
}
