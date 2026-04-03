import { DEFAULT_TOP, MAX_TOP } from "../constants.js";
import { assertProjectAllowed, isProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type { WorkItemSummary } from "../models.js";
import { clampTop, ensureArray, mapWorkItem, WORK_ITEM_FIELDS } from "./shared.js";

export interface SearchWorkItemsInput {
  readonly project?: string;
  readonly assignedToMe?: boolean;
  readonly state?: string;
  readonly text?: string;
  readonly top?: number;
}

function escapeWiqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildAllowedProjectsClause(allowlist: readonly string[]): string | null {
  if (allowlist.length === 0) {
    return null;
  }

  if (allowlist.length === 1) {
    return `[System.TeamProject] = '${escapeWiqlLiteral(allowlist[0])}'`;
  }

  const projects = allowlist
    .map((project) => `'${escapeWiqlLiteral(project)}'`)
    .join(", ");

  return `[System.TeamProject] IN (${projects})`;
}

export function buildSearchWorkItemsWiql(
  input: SearchWorkItemsInput,
  allowlist: readonly string[] = [],
): string {
  const clauses: string[] = [];

  if (input.project) {
    clauses.push(`[System.TeamProject] = '${escapeWiqlLiteral(input.project)}'`);
  } else {
    const allowlistClause = buildAllowedProjectsClause(allowlist);
    if (allowlistClause) {
      clauses.push(allowlistClause);
    }
  }

  if (input.assignedToMe) {
    clauses.push("[System.AssignedTo] = @Me");
  }

  if (input.state?.trim()) {
    clauses.push(`[System.State] = '${escapeWiqlLiteral(input.state.trim())}'`);
  }

  if (input.text?.trim()) {
    const escapedText = escapeWiqlLiteral(input.text.trim());
    clauses.push(
      `([System.Title] CONTAINS '${escapedText}' OR [System.Description] CONTAINS '${escapedText}')`,
    );
  }

  const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";

  return `SELECT [System.Id] FROM WorkItems${whereClause} ORDER BY [System.ChangedDate] DESC`;
}

export async function fetchWorkItemsByIds(
  client: AzureDevOpsClientLike,
  ids: readonly number[],
): Promise<WorkItemSummary[]> {
  if (ids.length === 0) {
    return [];
  }

  const fields = WORK_ITEM_FIELDS.map(encodeURIComponent).join(",");
  const joinedIds = ids.join(",");
  const response = await client.get<{ value?: unknown[] }>(
    `/_apis/wit/workitems?ids=${joinedIds}&fields=${fields}&api-version=7.1`,
  );

  return ensureArray(response.value).map(mapWorkItem);
}

export async function getWorkItem(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  id: number,
): Promise<WorkItemSummary> {
  const fields = WORK_ITEM_FIELDS.map(encodeURIComponent).join(",");
  const response = await client.get<unknown>(
    `/_apis/wit/workitems/${id}?fields=${fields}&api-version=7.1`,
  );

  const item = mapWorkItem(response);

  if (
    config.azdoProjectAllowlist.length > 0 &&
    !isProjectAllowed(item.project ?? undefined, config)
  ) {
    throw new Error(
      item.project
        ? `Work item belongs to project "${item.project}" which is not permitted by this connector.`
        : "Work item project is not available and cannot be validated against the allowlist.",
    );
  }

  return item;
}

export async function searchWorkItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: SearchWorkItemsInput,
): Promise<{ readonly query: SearchWorkItemsInput; readonly workItems: WorkItemSummary[] }> {
  if (input.project) {
    assertProjectAllowed(input.project, config);
  }

  const normalizedInput: SearchWorkItemsInput = {
    ...input,
    project: input.project?.trim() || undefined,
    state: input.state?.trim() || undefined,
    text: input.text?.trim() || undefined,
    top: clampTop(input.top, DEFAULT_TOP),
  };

  const pathPrefix = normalizedInput.project
    ? `/${encodeURIComponent(normalizedInput.project)}`
    : "";
  const wiql = buildSearchWorkItemsWiql(
    normalizedInput,
    normalizedInput.project ? [] : config.azdoProjectAllowlist,
  );

  const wiqlResponse = await client.post<{ workItems?: Array<{ id?: number }> }>(
    `${pathPrefix}/_apis/wit/wiql?api-version=7.1&$top=${normalizedInput.top}`,
    { query: wiql },
  );

  const ids = ensureArray<{ id?: number }>(wiqlResponse.workItems)
    .map((workItem) => workItem.id)
    .filter((id): id is number => Number.isInteger(id))
    .slice(0, normalizedInput.top);

  const workItems = await fetchWorkItemsByIds(client, ids);

  const filteredItems =
    config.azdoProjectAllowlist.length === 0
      ? workItems
      : workItems.filter((item) => isProjectAllowed(item.project ?? undefined, config));

  return {
    query: normalizedInput,
    workItems: filteredItems,
  };
}
