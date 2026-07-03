import { realpath } from "node:fs/promises";
import path from "node:path";

export class ProjectBoundaryError extends Error {
  code = "OUTSIDE_PROJECT" as const;
  path: string;
  root: string;

  constructor(targetPath: string, root: string) {
    super(`Path ${targetPath} is outside the project boundary ${root}.`);
    this.name = "ProjectBoundaryError";
    this.path = targetPath;
    this.root = root;
  }
}

export async function canonicalPath(targetPath: string): Promise<string> {
  try {
    return await realpath(targetPath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      const parent = path.dirname(targetPath);
      if (parent === targetPath) return path.resolve(targetPath);
      const canonicalParent = await canonicalPath(parent);
      return path.join(canonicalParent, path.basename(targetPath));
    }
    throw error;
  }
}

export async function assertWithinProjectBoundary(
  root: string,
  targetPath: string,
): Promise<string> {
  const projectRoot = await canonicalPath(root);
  const candidatePath = path.resolve(targetPath);
  const candidate = await canonicalPath(candidatePath);
  if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
    throw new ProjectBoundaryError(candidate, projectRoot);
  }
  return candidate;
}
