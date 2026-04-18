import { z } from "zod";

export const RELATIONS = [
  "DERIVED_FROM",
  "USES",
  "APPLIED_IN",
  "SUPERSEDES",
  "CONTRADICTS",
  "REQUIRES",
  "PART_OF",
  "ENABLES",
] as const;
export type Relation = (typeof RELATIONS)[number];

export const NODE_TYPES = ["concept", "person", "tool", "idea", "event"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const SOURCE_TYPES = ["youtube", "chat", "memo"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(NODE_TYPES),
  label: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()),
});
export type Node = z.infer<typeof NodeSchema>;

export const EdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  relation: z.enum(RELATIONS),
});
export type Edge = z.infer<typeof EdgeSchema>;

export const ParseResultSchema = z.object({
  importance: z.number().int().min(1).max(5),
  summary: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;
