import { isProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type { ProjectSummary } from "../models.js";
import { ensureArray, mapProject } from "./shared.js";

export async function listProjects(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): Promise<ProjectSummary[]> {
  const response = await client.get<{ value?: unknown[] }>(
    "/_apis/projects?api-version=7.1",
  );

  const projects = ensureArray(response.value).map(mapProject);

  if (config.azdoProjectAllowlist.length === 0) {
    return projects;
  }

  return projects.filter(
    (project) =>
      isProjectAllowed(project.name, config) || isProjectAllowed(project.id, config),
  );
}
