import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type {
  CommitSearchResultsByWorkItem,
  PullRequestSearchResultsByWorkItem,
  RequirementTraceabilityReport,
  SavedQueriesCatalog,
  SavedQueryExecutionSummary,
  SavedQuerySummary,
  TraceabilityDatasetExport,
  WorkItemFull,
  WorkItemTestLinksSummary,
  WorkItemRevisionSummary,
  WorkItemUpdateSummary,
  WorkItemsDeltaExport,
} from "../models.js";
import {
  asInteger,
  asRecord,
  asString,
  clampTop,
  ensureArray,
  mapSavedQuery,
} from "./shared.js";
import {
  exportWorkItemsFull,
  fetchWorkItemFullBaseByIds,
  searchWorkItemsAdvanced,
  type ExportWorkItemsFullInput,
  type SearchWorkItemsAdvancedInput,
} from "./workItems.js";
import {
  getRequirementTraceabilityReport,
  listWorkItemTestLinks,
} from "./traceability.js";
import {
  searchCommitsByWorkItem,
  searchPullRequestsByWorkItem,
} from "./codeIntelligence.js";

type ProjectScopedConfig = Pick<AppConfig, "azdoProjectAllowlist">;
type QueryTreeMode = "tree" | "flat";
type SavedQueryExpand = "none" | "fields" | "relations" | "links" | "all";

// Azure DevOps query catalog endpoint currently accepts only depth values 0..2.
const DEFAULT_QUERY_DEPTH = 2;
const MAX_QUERY_DEPTH = 2;

export interface ListSavedQueriesInput {
  readonly project: string;
  readonly depth?: number;
  readonly mode?: QueryTreeMode;
  readonly includeWiql?: boolean;
  readonly includeRaw?: boolean;
}

export interface RunSavedQueryInput {
  readonly project: string;
  readonly queryId?: string;
  readonly path?: string;
  readonly includeWorkItems?: boolean;
  readonly includeRaw?: boolean;
  readonly top?: number;
  readonly expand?: SavedQueryExpand;
}

export interface ExportWorkItemsDeltaInput extends SearchWorkItemsAdvancedInput {
  readonly fromDate?: string;
  readonly changedSince?: string;
  readonly includeWorkItems?: boolean;
  readonly includeUpdates?: boolean;
  readonly includeRevisions?: boolean;
  readonly includeRaw?: boolean;
  readonly maxItems?: number;
  readonly expand?: SavedQueryExpand;
  readonly includeRelations?: boolean;
  readonly includeLinks?: boolean;
}

export interface ExportTraceabilityDatasetInput extends SearchWorkItemsAdvancedInput {
  readonly queryId?: string;
  readonly path?: string;
  readonly includeWorkItems?: boolean;
  readonly includeTestLinks?: boolean;
  readonly includeCoverage?: boolean;
  readonly includePullRequests?: boolean;
  readonly includeCommits?: boolean;
  readonly includeSuites?: boolean;
  readonly includePlans?: boolean;
  readonly includeRecentRuns?: boolean;
  readonly includeRaw?: boolean;
  readonly maxItems?: number;
  readonly expand?: SavedQueryExpand;
  readonly includeRelations?: boolean;
  readonly includeLinks?: boolean;
}

function encodeProject(project: string): string {
  return encodeURIComponent(project);
}

function normalizeMode(mode: QueryTreeMode | undefined): QueryTreeMode {
  return mode === "flat" ? "flat" : "tree";
}

function normalizeDepth(depth: number | undefined): number {
  if (depth === undefined) {
    return DEFAULT_QUERY_DEPTH;
  }

  return Math.max(0, Math.min(MAX_QUERY_DEPTH, Math.floor(depth)));
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeExpand(value: SavedQueryExpand | undefined): SavedQueryExpand {
  return value ?? "none";
}

function normalizeRunSavedQueryInput(input: RunSavedQueryInput): RunSavedQueryInput & {
  readonly project: string;
} {
  const normalized = {
    ...input,
    project: input.project.trim(),
    queryId: input.queryId?.trim(),
    path: input.path?.trim(),
  };

  const hasQueryId = Boolean(normalized.queryId);
  const hasPath = Boolean(normalized.path);

  if (hasQueryId === hasPath) {
    throw new Error("Provide exactly one of queryId or path.");
  }

  return normalized;
}

function normalizeChangedSince(input: ExportWorkItemsDeltaInput): string {
  const changedSince = input.changedSince?.trim() || input.fromDate?.trim();

  if (!changedSince) {
    throw new Error("Provide changedSince or fromDate.");
  }

  return changedSince;
}

function normalizeExportMaxItems(top: number | undefined, maxItems: number | undefined): number {
  return clampTop(maxItems ?? top, 100);
}

function getResponseCollection(raw: unknown): unknown[] {
  const record = asRecord(raw);
  const value = ensureArray(record.value);

  if (value.length > 0 || Array.isArray(record.value)) {
    return value;
  }

  return Array.isArray(raw) ? raw : [];
}

function getQueryRoots(raw: unknown): unknown[] {
  const collection = getResponseCollection(raw);
  if (collection.length > 0) {
    return collection;
  }

  return asString(asRecord(raw).name) ? [raw] : [];
}

function buildSavedQueryTree(
  rawNodes: readonly unknown[],
  options: {
    readonly includeWiql?: boolean;
    readonly includeRaw?: boolean;
  } = {},
): readonly SavedQuerySummary[] {
  return rawNodes.map((rawNode) => {
    const children = buildSavedQueryTree(ensureArray(asRecord(rawNode).children), options);
    return mapSavedQuery(rawNode, {
      includeWiql: options.includeWiql,
      includeRaw: options.includeRaw,
      children,
    });
  });
}

function flattenSavedQueryTree(nodes: readonly SavedQuerySummary[]): SavedQuerySummary[] {
  const flat: SavedQuerySummary[] = [];

  for (const node of nodes) {
    flat.push({
      ...node,
      children: [],
    });
    flat.push(...flattenSavedQueryTree(node.children));
  }

  return flat;
}

export function buildSavedQueriesCatalog(
  raw: unknown,
  options: {
    readonly project: string;
    readonly depth?: number;
    readonly mode?: QueryTreeMode;
    readonly includeWiql?: boolean;
    readonly includeRaw?: boolean;
  },
): SavedQueriesCatalog {
  const depth = normalizeDepth(options.depth);
  const mode = normalizeMode(options.mode);
  const tree = buildSavedQueryTree(getQueryRoots(raw), {
    includeWiql: options.includeWiql,
    includeRaw: options.includeRaw,
  });
  const flat = flattenSavedQueryTree(tree);

  return {
    project: options.project,
    mode,
    depth,
    total: flat.length,
    queries: mode === "flat" ? flat : [...tree],
  };
}

export function extractSavedQueryWorkItemIds(raw: unknown): number[] {
  const record = asRecord(raw);
  const directIds = ensureArray(record.workItems)
    .map((item) => asInteger(asRecord(item).id))
    .filter((id): id is number => id !== null);

  if (directIds.length > 0) {
    return directIds;
  }

  const seen = new Set<number>();
  const ids: number[] = [];

  for (const relation of ensureArray(record.workItemRelations)) {
    const relationRecord = asRecord(relation);
    const sourceId = asInteger(asRecord(relationRecord.source).id);
    const targetId = asInteger(asRecord(relationRecord.target).id);

    for (const id of [sourceId, targetId]) {
      if (id !== null && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }

  return ids;
}

export function resolveSavedQueryFromCatalog(
  catalog: SavedQueriesCatalog,
  path: string,
): SavedQuerySummary | null {
  const targetPath = normalizeText(path);
  return catalog.queries.find((query) => normalizeText(query.path) === targetPath) ?? null;
}

async function loadSavedQueryCatalog(
  client: AzureDevOpsClientLike,
  project: string,
  options: {
    readonly depth?: number;
    readonly mode?: QueryTreeMode;
    readonly includeWiql?: boolean;
    readonly includeRaw?: boolean;
  } = {},
): Promise<SavedQueriesCatalog> {
  const depth = normalizeDepth(options.depth);
  const expand = options.includeWiql ? "wiql" : "minimal";
  const response = await client.get<unknown>(
    `/${encodeProject(project)}/_apis/wit/queries?$depth=${depth}&$expand=${expand}&api-version=7.1`,
  );

  return buildSavedQueriesCatalog(response, {
    project,
    depth,
    mode: options.mode,
    includeWiql: options.includeWiql,
    includeRaw: options.includeRaw,
  });
}

async function loadSavedQueryById(
  client: AzureDevOpsClientLike,
  project: string,
  queryId: string,
  options: {
    readonly includeWiql?: boolean;
    readonly includeRaw?: boolean;
  } = {},
): Promise<SavedQuerySummary> {
  const params = new URLSearchParams();
  params.set("api-version", "7.1");
  params.set("$expand", options.includeWiql ? "wiql" : "minimal");

  const response = await client.get<unknown>(
    `/${encodeProject(project)}/_apis/wit/queries/${encodeURIComponent(queryId)}?${params.toString()}`,
  );

  return mapSavedQuery(response, {
    includeWiql: options.includeWiql,
    includeRaw: options.includeRaw,
    children: buildSavedQueryTree(ensureArray(asRecord(response).children), options),
  });
}

function buildWorkItemExpandOptions(expand: SavedQueryExpand, includeRaw: boolean) {
  return {
    expand,
    includeRaw,
    includeRelations: expand === "relations" || expand === "all",
    includeLinks: expand === "links" || expand === "all",
  } as const;
}

async function loadDatasetScope(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ExportTraceabilityDatasetInput,
): Promise<{
  readonly project: string;
  readonly maxItems: number;
  readonly workItemIds: readonly number[];
  readonly totalMatched: number;
  readonly searchQuery?: unknown;
  readonly savedQuery?: SavedQuerySummary;
}> {
  const project = input.project.trim();
  const maxItems = normalizeExportMaxItems(input.top, input.maxItems);
  const queryId = input.queryId?.trim();
  const path = input.path?.trim();

  if (queryId && path) {
    throw new Error("Provide queryId or path, but not both.");
  }

  if (queryId || path) {
    const savedQuery = await runSavedQuery(client, config, {
      project,
      queryId,
      path,
      top: maxItems,
    });

    return {
      project,
      maxItems,
      workItemIds: savedQuery.workItemIds,
      totalMatched: savedQuery.total,
      savedQuery: savedQuery.query,
    };
  }

  const searchResult = await searchWorkItemsAdvanced(client, config, {
    ...input,
    project,
    top: maxItems,
  });

  return {
    project,
    maxItems,
    workItemIds: searchResult.workItems.map((workItem) => workItem.id),
    totalMatched: searchResult.workItems.length,
    searchQuery: searchResult.query,
  };
}

function mapUpdatesByWorkItemId(
  workItems: readonly WorkItemFull[],
): Record<string, readonly WorkItemUpdateSummary[]> {
  const entries = workItems
    .filter((workItem) => Array.isArray(workItem.updates))
    .map((workItem) => [String(workItem.id), workItem.updates ?? []] as const);

  return Object.fromEntries(entries);
}

function mapRevisionsByWorkItemId(
  workItems: readonly WorkItemFull[],
): Record<string, readonly WorkItemRevisionSummary[]> {
  const entries = workItems
    .filter((workItem) => Array.isArray(workItem.revisions))
    .map((workItem) => [String(workItem.id), workItem.revisions ?? []] as const);

  return Object.fromEntries(entries);
}

export async function listSavedQueries(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ListSavedQueriesInput,
): Promise<SavedQueriesCatalog> {
  const project = input.project.trim();
  assertProjectAllowed(project, config);

  return loadSavedQueryCatalog(client, project, {
    depth: input.depth,
    mode: input.mode,
    includeWiql: input.includeWiql,
    includeRaw: input.includeRaw,
  });
}

export async function runSavedQuery(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: RunSavedQueryInput,
): Promise<SavedQueryExecutionSummary> {
  const normalizedInput = normalizeRunSavedQueryInput(input);
  const project = normalizedInput.project;
  assertProjectAllowed(project, config);

  const query =
    normalizedInput.queryId
      ? await loadSavedQueryById(client, project, normalizedInput.queryId, {
          includeWiql: true,
          includeRaw: normalizedInput.includeRaw,
        })
      : resolveSavedQueryFromCatalog(
          await loadSavedQueryCatalog(client, project, {
            depth: MAX_QUERY_DEPTH,
            mode: "flat",
            includeWiql: false,
            includeRaw: false,
          }),
          normalizedInput.path ?? "",
        );

  if (!query) {
    throw new Error(
      normalizedInput.path
        ? `Saved query "${normalizedInput.path}" was not found in project "${project}".`
        : `Saved query "${normalizedInput.queryId ?? ""}" was not found in project "${project}".`,
    );
  }

  const resolvedQuery =
    query.wiql === undefined
      ? await loadSavedQueryById(client, project, query.id, {
          includeWiql: true,
          includeRaw: normalizedInput.includeRaw,
        })
      : query;

  const executionRaw = await client.get<unknown>(
    `/${encodeProject(project)}/_apis/wit/wiql/${encodeURIComponent(resolvedQuery.id)}?api-version=7.1`,
  );
  const matchedIds = extractSavedQueryWorkItemIds(executionRaw);
  const limitedIds =
    normalizedInput.top === undefined
      ? matchedIds
      : matchedIds.slice(0, clampTop(normalizedInput.top, matchedIds.length || 1));

  const expand = normalizeExpand(normalizedInput.expand);
  const workItems =
    normalizedInput.includeWorkItems === true
      ? await fetchWorkItemFullBaseByIds(
          client,
          limitedIds,
          buildWorkItemExpandOptions(expand, normalizedInput.includeRaw === true),
        )
      : undefined;

  return {
    project,
    query: resolvedQuery,
    wiql: resolvedQuery.wiql ?? null,
    total: matchedIds.length,
    returned: limitedIds.length,
    workItemIds: limitedIds,
    ...(workItems ? { workItems } : {}),
    ...(normalizedInput.includeRaw
      ? {
          raw: {
            query: resolvedQuery.raw,
            execution: executionRaw,
          },
        }
      : {}),
  };
}

export async function exportWorkItemsDelta(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ExportWorkItemsDeltaInput,
): Promise<WorkItemsDeltaExport> {
  const project = input.project.trim();
  assertProjectAllowed(project, config);

  const changedSince = normalizeChangedSince(input);
  const maxItems = normalizeExportMaxItems(input.top, input.maxItems);
  const includeWorkItems = input.includeWorkItems === true;
  const includeUpdates = input.includeUpdates === true;
  const includeRevisions = input.includeRevisions === true;
  const includeRaw = input.includeRaw === true;

  const exportInput: ExportWorkItemsFullInput = {
    ...input,
    project,
    changedDateFrom: changedSince,
    top: maxItems,
    maxItems,
    includeUpdates,
    includeRevisions,
    includeRaw,
    expand: input.expand,
    includeRelations: input.includeRelations,
    includeLinks: input.includeLinks,
  };

  const fullExport =
    includeWorkItems || includeUpdates || includeRevisions
      ? await exportWorkItemsFull(client, config, exportInput)
      : undefined;
  const searchResult =
    fullExport === undefined
      ? await searchWorkItemsAdvanced(client, config, {
          ...input,
          project,
          changedDateFrom: changedSince,
          top: maxItems,
        })
      : undefined;

  const workItems = fullExport?.workItems ?? [];
  const workItemIds =
    workItems.length > 0
      ? workItems.map((workItem) => workItem.id)
      : (searchResult?.workItems.map((workItem) => workItem.id) ?? []);

  return {
    project,
    changedSince,
    total: workItemIds.length,
    returned: workItemIds.length,
    workItemIds,
    ...(includeWorkItems ? { workItems } : {}),
    ...(includeUpdates ? { updatesByWorkItemId: mapUpdatesByWorkItemId(workItems) } : {}),
    ...(includeRevisions ? { revisionsByWorkItemId: mapRevisionsByWorkItemId(workItems) } : {}),
    ...(includeRaw
      ? {
          raw: {
            query: fullExport?.query ?? searchResult?.query,
          },
        }
      : {}),
  };
}

export async function exportTraceabilityDataset(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ExportTraceabilityDatasetInput,
): Promise<TraceabilityDatasetExport> {
  const scope = await loadDatasetScope(client, config, input);
  const includeRaw = input.includeRaw === true;
  const includeWorkItems = input.includeWorkItems !== false;
  const includeTestLinks = input.includeTestLinks === true;
  const includeCoverage = input.includeCoverage === true;
  const includePullRequests = input.includePullRequests === true;
  const includeCommits = input.includeCommits === true;

  if (scope.workItemIds.length === 0) {
    return {
      project: scope.project,
      scope: {
        source: scope.savedQuery ? "saved_query" : "search",
        totalMatched: scope.totalMatched,
        returned: 0,
        maxItems: scope.maxItems,
        ...(scope.searchQuery ? { searchQuery: scope.searchQuery } : {}),
        ...(scope.savedQuery ? { savedQuery: scope.savedQuery } : {}),
      },
      workItemIds: [],
      ...(includeRaw
        ? {
            raw: {
              scope,
            },
          }
        : {}),
    };
  }

  const workItems = includeWorkItems
    ? await fetchWorkItemFullBaseByIds(
        client,
        scope.workItemIds,
        buildWorkItemExpandOptions(normalizeExpand(input.expand), includeRaw),
      )
    : undefined;

  const includeSuites = input.includeSuites !== false;
  const includePlans = input.includePlans !== false;
  const includeRecentRuns = input.includeRecentRuns !== false;

  const testLinksByWorkItemId: Record<string, WorkItemTestLinksSummary> = {};
  if (includeTestLinks) {
    for (const workItemId of scope.workItemIds) {
      testLinksByWorkItemId[String(workItemId)] = await listWorkItemTestLinks(client, config, {
        project: scope.project,
        workItemId,
        includeSuites,
        includePlans,
        includeRecentRuns,
        includeRaw,
      });
    }
  }

  const coverageByWorkItemId: Record<string, RequirementTraceabilityReport> = {};
  if (includeCoverage) {
    for (const workItemId of scope.workItemIds) {
      coverageByWorkItemId[String(workItemId)] = await getRequirementTraceabilityReport(
        client,
        config,
        {
          project: scope.project,
          workItemId,
          includeSuites,
          includePlans,
          includeRecentRuns,
          includeRaw,
        },
      );
    }
  }

  const pullRequestsByWorkItemId: Record<string, PullRequestSearchResultsByWorkItem["pullRequests"]> = {};
  if (includePullRequests) {
    for (const workItemId of scope.workItemIds) {
      const result = await searchPullRequestsByWorkItem(client, config, {
        project: scope.project,
        workItemId,
        includeRaw,
      });
      pullRequestsByWorkItemId[String(workItemId)] = result.pullRequests;
    }
  }

  const commitsByWorkItemId: Record<string, CommitSearchResultsByWorkItem["commits"]> = {};
  if (includeCommits) {
    for (const workItemId of scope.workItemIds) {
      const result = await searchCommitsByWorkItem(client, config, {
        project: scope.project,
        workItemId,
        includeRaw,
      });
      commitsByWorkItemId[String(workItemId)] = result.commits;
    }
  }

  return {
    project: scope.project,
    scope: {
      source: scope.savedQuery ? "saved_query" : "search",
      totalMatched: scope.totalMatched,
      returned: scope.workItemIds.length,
      maxItems: scope.maxItems,
      ...(scope.searchQuery ? { searchQuery: scope.searchQuery } : {}),
      ...(scope.savedQuery ? { savedQuery: scope.savedQuery } : {}),
    },
    workItemIds: scope.workItemIds,
    ...(workItems ? { workItems } : {}),
    ...(includeTestLinks ? { testLinksByWorkItemId } : {}),
    ...(includeCoverage ? { coverageByWorkItemId } : {}),
    ...(includePullRequests ? { pullRequestsByWorkItemId } : {}),
    ...(includeCommits ? { commitsByWorkItemId } : {}),
    ...(includeRaw
      ? {
          raw: {
            scope,
          },
        }
      : {}),
  };
}
