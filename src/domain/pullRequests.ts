import { assertProjectAllowed, isProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type { PullRequestSummary, WorkItemSummary } from "../models.js";
import { ensureArray, mapPullRequest } from "./shared.js";
import { fetchWorkItemsByIds } from "./workItems.js";

export async function listPullRequests(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  repository: string,
  status: "active" | "completed" | "abandoned",
): Promise<PullRequestSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const encodedRepository = encodeURIComponent(repository);
  const encodedStatus = encodeURIComponent(status);

  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/git/repositories/${encodedRepository}/pullrequests?searchCriteria.status=${encodedStatus}&api-version=7.1`,
  );

  return ensureArray(response.value).map(mapPullRequest);
}

export async function getPullRequestWorkItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  repository: string,
  pullRequestId: number,
): Promise<WorkItemSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const encodedRepository = encodeURIComponent(repository);

  const response = await client.get<{ value?: Array<{ id?: number }> }>(
    `/${encodedProject}/_apis/git/repositories/${encodedRepository}/pullrequests/${pullRequestId}/workitems?api-version=7.1`,
  );

  const ids = ensureArray<{ id?: number }>(response.value)
    .map((workItem) => workItem.id)
    .filter((id): id is number => Number.isInteger(id));

  const workItems = await fetchWorkItemsByIds(client, ids);
  return config.azdoProjectAllowlist.length === 0
    ? workItems
    : workItems.filter((workItem) => isProjectAllowed(workItem.project ?? undefined, config));
}
