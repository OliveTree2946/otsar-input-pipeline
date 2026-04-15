export function assertSecret(req: Request): void {
  const expected = process.env.PIPELINE_SECRET;
  if (!expected) throw new Error("PIPELINE_SECRET not configured");
  const given = req.headers.get("x-pipeline-secret");
  if (given !== expected) {
    const err = new Error("unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
}
