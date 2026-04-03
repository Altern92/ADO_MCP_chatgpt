import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type { RepositorySummary } from "../models.js";
import { ensureArray, mapRepository } from "./shared.js";

export async function listRepositories(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
): Promise<RepositorySummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/git/repositories?api-version=7.1`,
  );

  return ensureArray(response.value).map(mapRepository);
}
