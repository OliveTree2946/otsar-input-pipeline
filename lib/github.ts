import { Octokit } from "@octokit/rest";
import { extractVideoId } from "./youtube";

function normalizeSourceUrl(sourceType: string, url: string): string {
  if (sourceType === "youtube") {
    const id = extractVideoId(url);
    if (id) return `youtube:${id}`;
  }
  return url;
}

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

function getConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    throw new Error("GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO must be set");
  }
  return { token, owner, repo, branch: "main" };
}

interface ExistingFrontmatter {
  sourceType: string;
  sourceUrl: string;
}

type ExistingState =
  | { kind: "missing" }
  | { kind: "exists"; frontmatter: ExistingFrontmatter | null };

function parseFrontmatter(content: string): ExistingFrontmatter | null {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  let sourceType = "";
  let sourceUrl = "";
  let closed = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "---") {
      closed = true;
      break;
    }
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
    if (key === "source_type") sourceType = val;
    else if (key === "source_url") sourceUrl = val;
  }
  if (!closed) return null;
  return { sourceType, sourceUrl };
}

async function readExisting(
  oct: Octokit,
  cfg: GitHubConfig,
  path: string,
): Promise<ExistingState> {
  try {
    const res = await oct.repos.getContent({
      owner: cfg.owner,
      repo: cfg.repo,
      path,
      ref: cfg.branch,
    });
    const data = res.data;
    if (
      !Array.isArray(data) &&
      data.type === "file" &&
      "content" in data &&
      typeof data.content === "string"
    ) {
      const raw = Buffer.from(data.content, "base64").toString("utf8");
      return { kind: "exists", frontmatter: parseFrontmatter(raw) };
    }
    return { kind: "exists", frontmatter: null };
  } catch (e) {
    const err = e as { status?: number };
    if (err.status === 404) return { kind: "missing" };
    throw e;
  }
}

export interface CommitResult {
  path: string;
  sha: string;
  htmlUrl: string;
  skipped?: boolean;
}

export async function commitFile(args: {
  path: string;
  altPathIfExists: string;
  content: string;
  message: string;
  expectedSource: { sourceType: string; sourceUrl: string };
}): Promise<CommitResult> {
  const cfg = getConfig();
  const oct = new Octokit({ auth: cfg.token });

  const existing = await readExisting(oct, cfg, args.path);

  if (existing.kind === "exists" && existing.frontmatter) {
    const { sourceType: wantType, sourceUrl: wantUrl } = args.expectedSource;
    const wantKey = normalizeSourceUrl(wantType, wantUrl);
    const haveKey = normalizeSourceUrl(
      existing.frontmatter.sourceType,
      existing.frontmatter.sourceUrl,
    );
    const sameSource =
      wantType.length > 0 &&
      wantUrl.length > 0 &&
      existing.frontmatter.sourceType === wantType &&
      wantKey === haveKey;
    if (sameSource) {
      console.log(
        `[input-pipeline] skip path=${args.path} reason=source-match type=${wantType} key=${wantKey}`,
      );
      return { path: args.path, sha: "", htmlUrl: "", skipped: true };
    }
  }

  const finalPath = existing.kind === "exists" ? args.altPathIfExists : args.path;

  const res = await oct.repos.createOrUpdateFileContents({
    owner: cfg.owner,
    repo: cfg.repo,
    path: finalPath,
    message: args.message,
    content: Buffer.from(args.content, "utf8").toString("base64"),
    branch: cfg.branch,
  });

  console.log(
    `[input-pipeline] write path=${finalPath} action=${existing.kind === "exists" ? "write-alt" : "write"}`,
  );

  return {
    path: finalPath,
    sha: res.data.content?.sha ?? "",
    htmlUrl: res.data.content?.html_url ?? "",
  };
}
