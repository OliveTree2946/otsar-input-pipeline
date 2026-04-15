import type { Edge, Node, ParseResult, SourceType } from "./types";
import { NODE_TYPE_PREFIX } from "./types";

const PIPELINE_VERSION = 1;

export interface RenderContext {
  sourceType: SourceType;
  sourceUrl?: string;
  createdISODate: string;
  parseResult: ParseResult;
}

function slugifyId(id: string, type: string): string {
  const prefix = `${type}-`;
  const base = id.startsWith(prefix) ? id.slice(prefix.length) : id;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function vaultPathForNode(node: Node, suffix?: string): string {
  const prefix = NODE_TYPE_PREFIX[node.type];
  const slug = slugifyId(node.id, node.type);
  const base = `${prefix}-${slug}`;
  const name = suffix ? `${base}-${suffix}.md` : `${base}.md`;
  return `vault/raw/input-pipeline/${name}`;
}

function edgesForNode(node: Node, allNodes: Node[], edges: Edge[]): string {
  const labelById = new Map(allNodes.map((n) => [n.id, n.label]));
  const outgoing = edges.filter((e) => e.source === node.id);
  if (!outgoing.length) return "";
  const lines = outgoing.map((e) => {
    const target = labelById.get(e.target) ?? e.target;
    return `- ${e.relation}: [[${target}]]`;
  });
  return `\n## 관계\n${lines.join("\n")}\n`;
}

export function renderNodeMarkdown(node: Node, ctx: RenderContext): string {
  const frontmatter = [
    "---",
    `id: ${node.id}`,
    `type: ${node.type}`,
    `source_type: ${ctx.sourceType}`,
    `created: ${ctx.createdISODate}`,
    `importance: ${ctx.parseResult.importance}`,
    `source_url: ${ctx.sourceUrl ?? ""}`,
    `pipeline_version: ${PIPELINE_VERSION}`,
    "---",
    "",
  ].join("\n");

  const tagLine = node.tags.length ? `\ntags: ${node.tags.map((t) => `#${t}`).join(" ")}\n` : "";
  const relations = edgesForNode(node, ctx.parseResult.nodes, ctx.parseResult.edges);

  return `${frontmatter}# ${node.label}\n\n${node.description.trim()}\n${tagLine}${relations}`;
}

export function timestampSuffix(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}
