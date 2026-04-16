"use client";

import { useMemo, useState } from "react";
import { splitText } from "@/lib/text-splitter";

type Mode = "youtube" | "chat" | "memo";
type Phase = "idle" | "fetchingTranscript" | "parsing" | "review" | "saving" | "done" | "error";

interface Node {
  id: string;
  type: "concept" | "person" | "tool" | "idea" | "event";
  label: string;
  description: string;
  tags: string[];
}
interface Edge { source: string; target: string; relation: string; }
interface ParseResult {
  importance: number;
  summary: string;
  nodes: Node[];
  edges: Edge[];
}
interface CommittedFile { path: string; htmlUrl: string; nodeId: string; }

type PartStatus = "pending" | "parsing" | "done" | "failed";

function mergeResults(results: ParseResult[]): ParseResult {
  const seenNodeIds = new Set<string>();
  const nodes: Node[] = [];
  for (const r of results) {
    for (const n of r.nodes) {
      if (!seenNodeIds.has(n.id)) {
        seenNodeIds.add(n.id);
        nodes.push(n);
      }
    }
  }

  const seenEdges = new Set<string>();
  const edges: Edge[] = [];
  for (const r of results) {
    for (const e of r.edges) {
      const key = `${e.source}|${e.target}|${e.relation}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        edges.push(e);
      }
    }
  }

  const importance = Math.max(...results.map((r) => r.importance));
  const summary = results.map((r) => r.summary).join(" | ");

  return { importance, summary, nodes, edges };
}

const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: "youtube", label: "YouTube", placeholder: "https://www.youtube.com/watch?v=..." },
  { id: "chat", label: "대화", placeholder: "AI 대화 전문을 붙여넣으세요." },
  { id: "memo", label: "메모", placeholder: "자유 메모를 입력하세요." },
];

const TYPE_COLORS: Record<Node["type"], string> = {
  concept: "bg-sky-900/40 text-sky-200 border-sky-700",
  person: "bg-amber-900/40 text-amber-200 border-amber-700",
  tool: "bg-emerald-900/40 text-emerald-200 border-emerald-700",
  idea: "bg-purple-900/40 text-purple-200 border-purple-700",
  event: "bg-rose-900/40 text-rose-200 border-rose-700",
};

function getSecret(): string {
  return process.env.NEXT_PUBLIC_PIPELINE_SECRET ?? "";
}

class ApiError extends Error {
  rawResponse?: string;
  constructor(message: string, rawResponse?: string) {
    super(message);
    this.name = "ApiError";
    this.rawResponse = rawResponse;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-pipeline-secret": getSecret() },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(json?.error ?? `${res.status}`, json?.rawResponse);
  }
  return json as T;
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("memo");
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [truncated, setTruncated] = useState(false);
  const [committed, setCommitted] = useState<CommittedFile[] | null>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [splitInfo, setSplitInfo] = useState<{ totalChars: number; partCount: number } | null>(null);
  const [partStatuses, setPartStatuses] = useState<PartStatus[]>([]);
  const [showAllNodes, setShowAllNodes] = useState(false);

  const edgesBySource = useMemo(() => {
    if (!result) return new Map<string, Edge[]>();
    const m = new Map<string, Edge[]>();
    for (const e of result.edges) {
      const arr = m.get(e.source) ?? [];
      arr.push(e);
      m.set(e.source, arr);
    }
    return m;
  }, [result]);

  const labelById = useMemo(() => {
    const m = new Map<string, string>();
    result?.nodes.forEach((n) => m.set(n.id, n.label));
    return m;
  }, [result]);

  async function onParse() {
    setError(null);
    setResult(null);
    setCommitted(null);
    setSourceUrl(undefined);
    setRawResponse(null);
    setShowRaw(false);
    setSplitInfo(null);
    setPartStatuses([]);
    setShowAllNodes(false);
    try {
      let textToParse = input.trim();
      let url: string | undefined;
      if (mode === "youtube") {
        url = textToParse;
        setPhase("fetchingTranscript");
        const { transcript } = await postJson<{ transcript: string }>("/api/youtube", { url });
        textToParse = transcript;
      }
      setPhase("parsing");

      const parts = splitText(textToParse);

      if (parts.length === 1) {
        const { result, truncated } = await postJson<{ result: ParseResult; truncated: boolean }>("/api/parse", {
          text: textToParse,
          sourceType: mode,
          sourceUrl: url,
        });
        setResult(result);
        setSourceUrl(url);
        setTruncated(truncated);
        setPhase("review");
      } else {
        setSplitInfo({ totalChars: textToParse.length, partCount: parts.length });
        setPartStatuses(new Array(parts.length).fill("pending") as PartStatus[]);

        const partResults: ParseResult[] = [];
        for (let i = 0; i < parts.length; i++) {
          setPartStatuses((prev) => {
            const next = [...prev];
            next[i] = "parsing";
            return next;
          });
          try {
            const { result } = await postJson<{ result: ParseResult; truncated: boolean }>("/api/parse", {
              text: parts[i],
              sourceType: mode,
              sourceUrl: url,
            });
            partResults.push(result);
            setPartStatuses((prev) => {
              const next = [...prev];
              next[i] = "done";
              return next;
            });
          } catch {
            setPartStatuses((prev) => {
              const next = [...prev];
              next[i] = "failed";
              return next;
            });
          }
        }

        if (partResults.length === 0) {
          throw new ApiError("모든 파트 파싱이 실패했습니다.");
        }

        const merged = mergeResults(partResults);
        setResult(merged);
        setSourceUrl(url);
        setTruncated(false);
        setPhase("review");
      }
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      if (err.rawResponse) setRawResponse(err.rawResponse);
      setPhase("error");
    }
  }

  async function onSave() {
    if (!result) return;
    setError(null);
    setPhase("saving");
    try {
      const res = await postJson<{ committed: CommittedFile[] }>("/api/save", {
        parseResult: result,
        sourceType: mode,
        sourceUrl,
      });
      setCommitted(res.committed);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setInput("");
    setResult(null);
    setCommitted(null);
    setError(null);
    setSourceUrl(undefined);
    setTruncated(false);
    setRawResponse(null);
    setShowRaw(false);
    setSplitInfo(null);
    setPartStatuses([]);
    setShowAllNodes(false);
  }

  const busy = phase === "fetchingTranscript" || phase === "parsing" || phase === "saving";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">OTSAR Input Pipeline</h1>
        <p className="text-sm text-neutral-400 mt-1">Phase 1 · vault/raw/input-pipeline/</p>
      </header>

      <section className="mb-4 flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded border text-sm ${
              mode === m.id ? "bg-white text-black border-white" : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
            }`}
          >
            {m.label}
          </button>
        ))}
      </section>

      <section className="mb-4">
        {mode === "youtube" ? (
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={MODES.find((m) => m.id === mode)!.placeholder}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-400 outline-none"
          />
        ) : (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={MODES.find((m) => m.id === mode)!.placeholder}
            rows={mode === "chat" ? 14 : 8}
            className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-400 outline-none font-mono"
          />
        )}
      </section>

      <section className="mb-6 flex gap-2">
        <button
          disabled={!input.trim() || busy}
          onClick={onParse}
          className="px-4 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-40"
        >
          {phase === "fetchingTranscript" ? "자막 추출 중…" : phase === "parsing" ? "파싱 중…" : "Parse"}
        </button>
        {(phase === "review" || phase === "done" || phase === "error") && (
          <button onClick={reset} className="px-4 py-2 rounded border border-neutral-700 text-sm">
            Reset
          </button>
        )}
      </section>

      {error && (
        <div className="mb-4 rounded border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
          <div>{error}</div>
          {rawResponse && (
            <div className="mt-2">
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs underline text-rose-300 hover:text-rose-100"
              >
                {showRaw ? "원본 응답 숨기기" : "파싱 실패 — Claude 원본 응답 보기"}
              </button>
              {showRaw && (
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-neutral-900 p-2 text-xs text-neutral-200">
                  {rawResponse}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {truncated && phase === "review" && (
        <div className="mb-4 rounded border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">
          입력이 10,000자를 초과하여 앞부분만 파싱되었습니다.
        </div>
      )}

      {splitInfo && (
        <div className="mb-4 rounded border border-sky-800 bg-sky-950/40 p-3 text-xs text-sky-200">
          <div>
            {splitInfo.totalChars.toLocaleString()}자 → {splitInfo.partCount}개 파트로 나눠서 파싱합니다
          </div>
          {partStatuses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {partStatuses.map((s, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded text-xs ${
                    s === "parsing"
                      ? "bg-sky-700 text-white"
                      : s === "done"
                      ? "bg-emerald-800 text-emerald-100"
                      : s === "failed"
                      ? "bg-rose-800 text-rose-100"
                      : "bg-neutral-800 text-neutral-400"
                  }`}
                >
                  파트 {i + 1}{" "}
                  {s === "parsing" ? "파싱 중…" : s === "done" ? "✅" : s === "failed" ? "❌" : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {result && (phase === "review" || phase === "saving") && (
        <section className="space-y-4">
          <div className="rounded border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  result.importance >= 3 ? "bg-neutral-700 text-neutral-100" : "bg-amber-900/70 text-amber-100"
                }`}
              >
                importance {result.importance}
              </span>
              {result.importance < 3 && (
                <span className="text-xs text-amber-300">낮은 중요도 — 저장 전 확인하세요</span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-neutral-200">{result.summary}</p>
          </div>

          <div className="grid gap-3">
            {(showAllNodes || result.nodes.length <= 10
              ? result.nodes
              : result.nodes.slice(0, 10)
            ).map((n) => (
              <div key={n.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLORS[n.type]}`}>{n.type}</span>
                  <h3 className="font-medium">{n.label}</h3>
                  <code className="text-[10px] text-neutral-500 ml-auto">{n.id}</code>
                </div>
                <p className="text-sm text-neutral-300 mb-2 whitespace-pre-wrap">{n.description}</p>
                {n.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {n.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {(edgesBySource.get(n.id) ?? []).length > 0 && (
                  <ul className="text-xs text-neutral-400 space-y-0.5 mt-2">
                    {(edgesBySource.get(n.id) ?? []).map((e, i) => (
                      <li key={i}>
                        <span className="text-neutral-500">{e.relation}</span>{" "}
                        → {labelById.get(e.target) ?? e.target}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {!showAllNodes && result.nodes.length > 10 && (
              <button
                onClick={() => setShowAllNodes(true)}
                className="py-2 rounded border border-neutral-700 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
              >
                더 보기 (+{result.nodes.length - 10}개) — 저장 시 전부 포함됩니다
              </button>
            )}
          </div>

          <button
            onClick={onSave}
            disabled={busy}
            className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium disabled:opacity-40"
          >
            {phase === "saving" ? "저장 중…" : "Approve & Commit"}
          </button>
        </section>
      )}

      {committed && phase === "done" && (
        <section className="space-y-2">
          <h2 className="text-sm text-neutral-400">저장 완료 ({committed.length}개 파일)</h2>
          <ul className="space-y-1 text-sm">
            {committed.map((c) => (
              <li key={c.path}>
                <a href={c.htmlUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                  {c.path}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
