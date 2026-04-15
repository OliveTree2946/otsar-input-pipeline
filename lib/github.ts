import { Octokit } from "@octokit/rest";

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

async function pathExists(oct: Octokit, cfg: GitHubConfig, path: string): Promise<boolean> {
  try {
    await oct.repos.getContent({ owner: cfg.owner, repo: cfg.repo, path, ref: cfg.branch });
    return true;
  } catch (e) {
    const err = e as { status?: number };
    if (err.status === 404) return false;
    throw e;
  }
}

export interface CommitResult {
  path: string;
  sha: string;
  htmlUrl: string;
}

export async function commitFile(args: {
  path: string;
  altPathIfExists: string;
  content: string;
  message: string;
}): Promise<CommitResult> {
  const cfg = getConfig();
  const oct = new Octokit({ auth: cfg.token });

  const exists = await pathExists(oct, cfg, args.path);
  const finalPath = exists ? args.altPathIfExists : args.path;

  const res = await oct.repos.createOrUpdateFileContents({
    owner: cfg.owner,
    repo: cfg.repo,
    path: finalPath,
    message: args.message,
    content: Buffer.from(args.content, "utf8").toString("base64"),
    branch: cfg.branch,
  });

  return {
    path: finalPath,
    sha: res.data.content?.sha ?? "",
    htmlUrl: res.data.content?.html_url ?? "",
  };
}
