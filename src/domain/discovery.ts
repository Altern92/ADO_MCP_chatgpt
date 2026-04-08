import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import { AzureDevOpsApiError } from "../errors.js";
import type {
  AreaPathNodeSummary,
  AreaPathsCatalog,
  IterationPathNodeSummary,
  IterationPathsCatalog,
  ResolvedIdentityCatalog,
  ResolvedIdentitySummary,
  WorkItemFieldsCatalog,
  WorkItemTagsCatalog,
} from "../models.js";
import {
  asRecord,
  asString,
  clampTop,
  ensureArray,
  mapAreaPathNode,
  mapIterationPathNode,
  mapResolvedIdentity,
  mapWorkItemField,
  mapWorkItemTag,
} from "./shared.js";
import { listProjects } from "./projects.js";

type ProjectScopedConfig = Pick<AppConfig, "azdoProjectAllowlist">;
type DiscoveryMode = "tree" | "flat";

const DEFAULT_DISCOVERY_DEPTH = 10;
const MAX_DISCOVERY_DEPTH = 20;
const DEFAULT_DISCOVERY_TOP = 100;
const IDENTITY_WORK_ITEM_SAMPLE_SIZE = 50;
const IDENTITY_PULL_REQUEST_STATUS = "active";
const IDENTITY_WORK_ITEM_FIELDS = [
  "System.AssignedTo",
  "System.CreatedBy",
  "System.ChangedBy",
] as const;

export interface ListWorkItemFieldsInput {
  readonly project: string;
  readonly includeRaw?: boolean;
  readonly search?: string;
  readonly referenceNames?: readonly string[];
  readonly names?: readonly string[];
}

export interface ListAreaPathsInput {
  readonly project: string;
  readonly depth?: number;
  readonly mode?: DiscoveryMode;
  readonly includeRaw?: boolean;
}

export interface ListIterationPathsInput {
  readonly project: string;
  readonly depth?: number;
  readonly mode?: DiscoveryMode;
  readonly includeRaw?: boolean;
}

export interface ListTagsInput {
  readonly project: string;
  readonly includeRaw?: boolean;
  readonly search?: string;
  readonly top?: number;
}

export interface ResolveIdentityInput {
  readonly query: string;
  readonly project?: string;
  readonly top?: number;
  readonly includeRaw?: boolean;
}

function encodeProject(project: string): string {
  return encodeURIComponent(project);
}

function normalizeMode(mode: DiscoveryMode | undefined): DiscoveryMode {
  return mode === "flat" ? "flat" : "tree";
}

function normalizeDepth(depth: number | undefined): number {
  if (depth === undefined) {
    return DEFAULT_DISCOVERY_DEPTH;
  }

  return Math.max(0, Math.min(MAX_DISCOVERY_DEPTH, Math.floor(depth)));
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeTextSet(values: readonly string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => normalizeText(value)).filter(Boolean));
}

function getResponseCollection(
  raw: unknown,
  preferredKeys: readonly string[] = ["value"],
): unknown[] {
  const record = asRecord(raw);

  for (const key of preferredKeys) {
    const collection = ensureArray(record[key]);
    if (collection.length > 0 || Array.isArray(record[key])) {
      return collection;
    }
  }

  return Array.isArray(raw) ? raw : [];
}

function hasDiscoveryNodeShape(raw: unknown): boolean {
  const record = asRecord(raw);
  return asString(record.name) !== null || asString(record.path) !== null;
}

function getClassificationRoots(raw: unknown): unknown[] {
  const collection = getResponseCollection(raw);
  if (collection.length > 0) {
    return collection;
  }

  return hasDiscoveryNodeShape(raw) ? [raw] : [];
}

function buildAreaPathTreeNodes(
  rawNodes: readonly unknown[],
  maxDepth: number,
  includeRaw = false,
  parentPath?: string,
  depth = 0,
): readonly AreaPathNodeSummary[] {
  return rawNodes.map((rawNode) => {
    const record = asRecord(rawNode);
    const name = asString(record.name) ?? "";
    const path = asString(record.path) ?? (parentPath ? `${parentPath}\\${name}` : name);
    const children =
      depth >= maxDepth
        ? []
        : buildAreaPathTreeNodes(
            ensureArray(record.children),
            maxDepth,
            includeRaw,
            path,
            depth + 1,
          );

    return mapAreaPathNode(rawNode, {
      includeRaw,
      pathOverride: path,
      children,
    });
  });
}

function buildIterationPathTreeNodes(
  rawNodes: readonly unknown[],
  maxDepth: number,
  includeRaw = false,
  parentPath?: string,
  depth = 0,
): readonly IterationPathNodeSummary[] {
  return rawNodes.map((rawNode) => {
    const record = asRecord(rawNode);
    const name = asString(record.name) ?? "";
    const path = asString(record.path) ?? (parentPath ? `${parentPath}\\${name}` : name);
    const children =
      depth >= maxDepth
        ? []
        : buildIterationPathTreeNodes(
            ensureArray(record.children),
            maxDepth,
            includeRaw,
            path,
            depth + 1,
          );

    return mapIterationPathNode(rawNode, {
      includeRaw,
      pathOverride: path,
      children,
    });
  });
}

function flattenAreaPathTree(
  nodes: readonly AreaPathNodeSummary[],
): AreaPathNodeSummary[] {
  const flat: AreaPathNodeSummary[] = [];

  for (const node of nodes) {
    flat.push({
      ...node,
      children: [],
    });
    flat.push(...flattenAreaPathTree(node.children));
  }

  return flat;
}

function flattenIterationPathTree(
  nodes: readonly IterationPathNodeSummary[],
): IterationPathNodeSummary[] {
  const flat: IterationPathNodeSummary[] = [];

  for (const node of nodes) {
    flat.push({
      ...node,
      children: [],
    });
    flat.push(...flattenIterationPathTree(node.children));
  }

  return flat;
}

function sortByName<T extends { readonly name: string; readonly referenceName?: string | null }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) => {
    const leftKey = normalizeText(left.referenceName ?? left.name);
    const rightKey = normalizeText(right.referenceName ?? right.name);
    return leftKey.localeCompare(rightKey);
  });
}

function matchesSearch(value: string | undefined, ...candidates: Array<string | null | undefined>): boolean {
  const normalizedSearch = normalizeText(value);
  if (!normalizedSearch) {
    return true;
  }

  return candidates.some((candidate) => normalizeText(candidate).includes(normalizedSearch));
}

function getIdentityMatchScore(identity: ResolvedIdentitySummary, query: string): number {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const candidates = [
    identity.displayName,
    identity.uniqueName,
    identity.id,
    identity.descriptor,
  ].map((candidate) => normalizeText(candidate));

  let bestScore = 0;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const emailLocalPart = candidate.includes("@") ? candidate.slice(0, candidate.indexOf("@")) : candidate;

    if (candidate === normalizedQuery || emailLocalPart === normalizedQuery) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    if (candidate.startsWith(normalizedQuery) || emailLocalPart.startsWith(normalizedQuery)) {
      bestScore = Math.max(bestScore, 75);
      continue;
    }

    if (candidate.includes(normalizedQuery) || emailLocalPart.includes(normalizedQuery)) {
      bestScore = Math.max(bestScore, 50);
    }
  }

  return bestScore;
}

export function rankResolvedIdentities(
  query: string,
  identities: readonly ResolvedIdentitySummary[],
): ResolvedIdentitySummary[] {
  return [...identities]
    .map((identity) => ({
      identity,
      score: getIdentityMatchScore(identity, query),
    }))
    .filter((entry) => entry.score > 0 || identities.length === 1)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftKey = normalizeText(left.identity.displayName ?? left.identity.uniqueName);
      const rightKey = normalizeText(right.identity.displayName ?? right.identity.uniqueName);
      return leftKey.localeCompare(rightKey);
    })
    .map((entry) => entry.identity);
}

function escapeWiqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildRecentIdentityWiql(project: string): string {
  return `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${escapeWiqlLiteral(project)}' ORDER BY [System.ChangedDate] DESC`;
}

function mergeResolvedIdentity(
  existing: ResolvedIdentitySummary | undefined,
  candidate: ResolvedIdentitySummary,
): ResolvedIdentitySummary {
  if (!existing) {
    return candidate;
  }

  return {
    displayName: existing.displayName ?? candidate.displayName,
    uniqueName: existing.uniqueName ?? candidate.uniqueName,
    descriptor: existing.descriptor ?? candidate.descriptor,
    id: existing.id ?? candidate.id,
    url: existing.url ?? candidate.url,
    raw: existing.raw ?? candidate.raw,
  };
}

function getResolvedIdentityKey(identity: ResolvedIdentitySummary): string | null {
  return (
    normalizeText(identity.id) ||
    normalizeText(identity.uniqueName) ||
    normalizeText(identity.descriptor) ||
    normalizeText(identity.displayName)
  );
}

function collectMappedIdentities(
  bucket: Map<string, ResolvedIdentitySummary>,
  rawIdentities: readonly unknown[],
  includeRaw: boolean | undefined,
): void {
  for (const rawIdentity of rawIdentities) {
    const mapped = mapResolvedIdentity(rawIdentity, includeRaw);
    if (!mapped.displayName && !mapped.uniqueName && !mapped.id) {
      continue;
    }

    const key = getResolvedIdentityKey(mapped);
    if (!key) {
      continue;
    }

    bucket.set(key, mergeResolvedIdentity(bucket.get(key), mapped));
  }
}

async function tryResolveIdentityViaApi(
  client: AzureDevOpsClientLike,
  input: ResolveIdentityInput,
): Promise<ResolvedIdentitySummary[] | null> {
  const pathPrefix = input.project ? `/${encodeProject(input.project)}` : "";

  try {
    const response = await client.get<unknown>(
      `${pathPrefix}/_apis/Identities?searchFilter=General&filterValue=${encodeURIComponent(input.query)}&queryMembership=None&api-version=7.1`,
    );

    return getResponseCollection(response, ["value", "identities", "members"])
      .map((rawIdentity) => mapResolvedIdentity(rawIdentity, input.includeRaw))
      .filter(
        (identity) =>
          identity.displayName !== null ||
          identity.uniqueName !== null ||
          identity.id !== null,
      );
  } catch (error) {
    if (
      error instanceof AzureDevOpsApiError &&
      [401, 403, 404].includes(error.azureStatus)
    ) {
      return null;
    }

    throw error;
  }
}

async function listIdentityProjects(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  project: string | undefined,
): Promise<string[]> {
  if (project) {
    return [project];
  }

  const projects = await listProjects(client, config);
  return projects.map((item) => item.name).filter((name): name is string => Boolean(name));
}

async function collectProjectIdentityCandidates(
  client: AzureDevOpsClientLike,
  project: string,
  includeRaw: boolean | undefined,
): Promise<ResolvedIdentitySummary[]> {
  const candidates = new Map<string, ResolvedIdentitySummary>();

  const pullRequests = await client.get<{ value?: unknown[] }>(
    `/${encodeProject(project)}/_apis/git/pullrequests?${new URLSearchParams({
      "searchCriteria.status": IDENTITY_PULL_REQUEST_STATUS,
      "api-version": "7.1",
    }).toString()}`,
  );

  for (const pullRequest of ensureArray(pullRequests.value)) {
    const record = asRecord(pullRequest);
    collectMappedIdentities(candidates, [record.createdBy, ...ensureArray(record.reviewers)], includeRaw);
  }

  const wiqlResponse = await client.post<{ workItems?: Array<{ id?: number }> }>(
    `/${encodeProject(project)}/_apis/wit/wiql?api-version=7.1&$top=${IDENTITY_WORK_ITEM_SAMPLE_SIZE}`,
    { query: buildRecentIdentityWiql(project) },
  );
  const ids = ensureArray<{ id?: number }>(wiqlResponse.workItems)
    .map((item) => item.id)
    .filter((id): id is number => Number.isInteger(id))
    .slice(0, IDENTITY_WORK_ITEM_SAMPLE_SIZE);

  if (ids.length > 0) {
    const fields = IDENTITY_WORK_ITEM_FIELDS.map(encodeURIComponent).join(",");
    const workItems = await client.get<{ value?: unknown[] }>(
      `/_apis/wit/workitems?ids=${ids.join(",")}&fields=${fields}&api-version=7.1`,
    );

    for (const workItem of ensureArray(workItems.value)) {
      const fieldsRecord = asRecord(asRecord(workItem).fields);
      collectMappedIdentities(
        candidates,
        [
          fieldsRecord["System.AssignedTo"],
          fieldsRecord["System.CreatedBy"],
          fieldsRecord["System.ChangedBy"],
        ],
        includeRaw,
      );
    }
  }

  return [...candidates.values()];
}

export function buildAreaPathCatalog(
  raw: unknown,
  options: {
    readonly project: string;
    readonly depth?: number;
    readonly mode?: DiscoveryMode;
    readonly includeRaw?: boolean;
  },
): AreaPathsCatalog {
  const depth = normalizeDepth(options.depth);
  const mode = normalizeMode(options.mode);
  const tree = buildAreaPathTreeNodes(
    getClassificationRoots(raw),
    depth,
    options.includeRaw === true,
  );
  const paths = mode === "flat" ? flattenAreaPathTree(tree) : [...tree];

  return {
    project: options.project,
    mode,
    depth,
    total: flattenAreaPathTree(tree).length,
    paths,
  };
}

export function buildIterationPathCatalog(
  raw: unknown,
  options: {
    readonly project: string;
    readonly depth?: number;
    readonly mode?: DiscoveryMode;
    readonly includeRaw?: boolean;
  },
): IterationPathsCatalog {
  const depth = normalizeDepth(options.depth);
  const mode = normalizeMode(options.mode);
  const tree = buildIterationPathTreeNodes(
    getClassificationRoots(raw),
    depth,
    options.includeRaw === true,
  );
  const paths = mode === "flat" ? flattenIterationPathTree(tree) : [...tree];

  return {
    project: options.project,
    mode,
    depth,
    total: flattenIterationPathTree(tree).length,
    paths,
  };
}

export async function listWorkItemFields(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ListWorkItemFieldsInput,
): Promise<WorkItemFieldsCatalog> {
  assertProjectAllowed(input.project, config);

  const response = await client.get<unknown>(
    `/${encodeProject(input.project)}/_apis/wit/fields?api-version=7.1`,
  );
  const fields = getResponseCollection(response)
    .map((rawField) => mapWorkItemField(rawField, input.includeRaw))
    .filter((field) => field.referenceName);

  const names = normalizeTextSet(input.names);
  const referenceNames = normalizeTextSet(input.referenceNames);
  const hasExplicitSelector = names.size > 0 || referenceNames.size > 0;

  const filteredFields = sortByName(fields).filter((field) => {
    const matchesExplicit =
      !hasExplicitSelector ||
      names.has(normalizeText(field.name)) ||
      referenceNames.has(normalizeText(field.referenceName));

    return (
      matchesExplicit &&
      matchesSearch(input.search, field.name, field.referenceName, field.type)
    );
  });

  return {
    project: input.project,
    total: filteredFields.length,
    fields: filteredFields,
  };
}

export async function listAreaPaths(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ListAreaPathsInput,
): Promise<AreaPathsCatalog> {
  assertProjectAllowed(input.project, config);

  const depth = normalizeDepth(input.depth);
  const response = await client.get<unknown>(
    `/${encodeProject(input.project)}/_apis/wit/classificationnodes/areas?$depth=${depth}&api-version=7.1`,
  );

  return buildAreaPathCatalog(response, {
    project: input.project,
    depth,
    mode: input.mode,
    includeRaw: input.includeRaw,
  });
}

export async function listIterationPaths(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ListIterationPathsInput,
): Promise<IterationPathsCatalog> {
  assertProjectAllowed(input.project, config);

  const depth = normalizeDepth(input.depth);
  const response = await client.get<unknown>(
    `/${encodeProject(input.project)}/_apis/wit/classificationnodes/iterations?$depth=${depth}&api-version=7.1`,
  );

  return buildIterationPathCatalog(response, {
    project: input.project,
    depth,
    mode: input.mode,
    includeRaw: input.includeRaw,
  });
}

export async function listTags(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ListTagsInput,
): Promise<WorkItemTagsCatalog> {
  assertProjectAllowed(input.project, config);

  const response = await client.get<unknown>(
    `/${encodeProject(input.project)}/_apis/wit/tags?api-version=7.1`,
  );
  const top = clampTop(input.top, DEFAULT_DISCOVERY_TOP);
  const tags = sortByName(
    getResponseCollection(response)
      .map((rawTag) => mapWorkItemTag(rawTag, input.includeRaw))
      .filter((tag) => tag.name),
  )
    .filter((tag) => matchesSearch(input.search, tag.name))
    .slice(0, top);

  return {
    project: input.project,
    total: tags.length,
    tags,
  };
}

export async function resolveIdentity(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ResolveIdentityInput,
): Promise<ResolvedIdentityCatalog> {
  if (input.project) {
    assertProjectAllowed(input.project, config);
  }

  const top = clampTop(input.top, 20);
  const directMatches = await tryResolveIdentityViaApi(client, input);
  const mapped =
    directMatches ??
    (
      await Promise.all(
        (
          await listIdentityProjects(client, config, input.project)
        ).map((project) =>
          collectProjectIdentityCandidates(client, project, input.includeRaw),
        ),
      )
    ).flat();
  const deduped = new Map<string, ResolvedIdentitySummary>();

  for (const identity of mapped) {
    const key = getResolvedIdentityKey(identity);
    if (!key) {
      continue;
    }

    deduped.set(key, mergeResolvedIdentity(deduped.get(key), identity));
  }

  const resolved = [...deduped.values()];
  const ranked = rankResolvedIdentities(input.query, resolved);
  const identities = (ranked.length > 0 ? ranked : resolved).slice(0, top);

  return {
    query: input.query,
    project: input.project ?? null,
    total: identities.length,
    identities,
  };
}
