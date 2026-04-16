import Anthropic from "@anthropic-ai/sdk";
import { ParseResultSchema, RELATIONS, NODE_TYPES } from "./types";
import type { ParseResult, SourceType } from "./types";

const MODEL = "claude-opus-4-6";
const MAX_OUTPUT_TOKENS = 4096;
const MAX_INPUT_CHARS = 10_000;

const SYSTEM_PROMPT = `당신은 Joseph의 개인 지식을 구조화하는 파서입니다.

입력된 텍스트에서:
1. 핵심 개념 노드를 추출하세요. 각 노드 필드: id, type, label, description, tags.
   - id 형식: {type의 영문 소문자}-{kebab-case slug} (예: "concept-noise-attenuator")
   - type은 반드시 다음 중 하나: ${NODE_TYPES.join(", ")}
2. 노드 간 관계를 추출하세요. relation은 반드시 다음 중 하나:
   ${RELATIONS.join(", ")}
   - 새 관계 타입을 발명하지 마세요.
   - source, target은 반드시 nodes 배열에 존재하는 id여야 합니다.
3. 전체 중요도를 1~5 정수로 판단하세요.
4. 핵심 요약을 1~2문장 한국어로 작성하세요.

출력은 반드시 아래 JSON 스키마만 출력하세요. 설명, 코드 펜스, prose 금지.
{
  "importance": number(1..5),
  "summary": string,
  "nodes": [{ "id": string, "type": string, "label": string, "description": string, "tags": string[] }],
  "edges": [{ "source": string, "target": string, "relation": string }]
}

## 절대 규칙
- 응답은 JSON 객체 하나만 출력하세요. 설명, 분석, 인사말 등 다른 텍스트를 절대 포함하지 마세요.
- 노드는 최대 5개까지만 추출하세요. 5개를 초과하면 중요도가 높은 것만 남기세요.
- 입력이 아무리 길어도 JSON 응답은 간결하게 유지하세요.
- description은 반드시 1문장(30자 이내)으로 제한하세요.
- tags는 노드당 최대 3개까지만.`;

const TRUNCATION_NOTE =
  "(입력이 길어 일부만 전달되었습니다. 전달된 부분에서만 노드를 추출하세요.)";

export class ParseFailedError extends Error {
  rawResponse: string;
  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "ParseFailedError";
    this.rawResponse = rawResponse;
  }
}

function buildUserMessage(
  text: string,
  sourceType: SourceType,
  sourceUrl: string | undefined,
  truncated: boolean
): string {
  const header = `[SOURCE_TYPE=${sourceType}] [URL=${sourceUrl ?? "none"}]`;
  const suffix = truncated ? `\n\n${TRUNCATION_NOTE}` : "";
  return `${header}\n\n${text}${suffix}`;
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

async function callClaude(client: Anthropic, userMsg: string, retryHint?: string): Promise<string> {
  const system = retryHint ? `${SYSTEM_PROMPT}\n\n${retryHint}` : SYSTEM_PROMPT;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    messages: [{ role: "user", content: userMsg }],
  });
  const block = res.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") throw new Error("no text in Claude response");
  return block.text;
}

export async function parseWithClaude(args: {
  text: string;
  sourceType: SourceType;
  sourceUrl?: string;
}): Promise<{ result: ParseResult; truncated: boolean; rawResponse: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const truncated = args.text.length > MAX_INPUT_CHARS;
  const text = truncated ? args.text.slice(0, MAX_INPUT_CHARS) : args.text;
  const userMsg = buildUserMessage(text, args.sourceType, args.sourceUrl, truncated);

  const client = new Anthropic({ apiKey });

  let raw = await callClaude(client, userMsg);
  let parsed = tryParse(raw);
  if (!parsed) {
    raw = await callClaude(
      client,
      userMsg,
      "이전 응답이 유효한 JSON이 아니었습니다. 스키마에 맞는 유효한 JSON만 반환하세요."
    );
    parsed = tryParse(raw);
  }
  if (!parsed) {
    throw new ParseFailedError("Claude did not return valid JSON after retry", raw);
  }

  const validated = ParseResultSchema.safeParse(parsed);
  if (!validated.success) {
    throw new ParseFailedError(
      `parse result validation failed: ${validated.error.message}`,
      raw
    );
  }
  return { result: validated.data, truncated, rawResponse: raw };
}

function tryParse(raw: string): unknown | null {
  try {
    return JSON.parse(extractJSON(raw));
  } catch {
    return null;
  }
}
