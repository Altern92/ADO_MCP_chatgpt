import { assertProjectAllowed, isProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type {
  CommitFull,
  CommitSearchResultsByWorkItem,
  GitCommitSummary,
  LinkedCommitSummary,
  LinkedPullRequestSummary,
  PullRequestCommitsList,
  PullRequestDiff,
  PullRequestFileChangeSummary,
  PullRequestFull,
  PullRequestRepositoryContext,
  PullRequestSearchResultsByWorkItem,
  WorkItemRelationSummary,
  WorkItemSummary,
} from "../models.js";
import {
  asInteger,
  asRecord,
  asString,
  ensureArray,
  mapCommitFull,
  mapGitCommit,
  mapPullRequestDiffFile,
  mapPullRequestFull,
  mapPullRequestRepositoryContext,
} from "./shared.js";
import { getPullRequestWorkItems } from "./pullRequests.js";
import { getWorkItemFull } from "./workItems.js";

export interface SearchPullRequestsByWorkItemInput {
  readonly project: string;
  readonly workItemId: number;
  readonly includeRaw?: boolean;
}

export interface GetPullRequestFullInput {
  readonly project: string;
  readonly repository: string;
  readonly pullRequestId: number;
  readonly includeWorkItems?: boolean;
  readonly includeReviewers?: boolean;
  readonly includeRaw?: boolean;
}

export interface ListPullRequestCommitsInput {
  readonly project: string;
  readonly repository: string;
  readonly pullRequestId: number;
  readonly includeRaw?: boolean;
}

export interface GetPullRequestDiffInput {
  readonly project: string;
  readonly repository: string;
  readonly pullRequestId: number;
  readonly includePatch?: boolean;
  readonly includeRaw?: boolean;
}

export interface GetCommitFullInput {
  readonly project: string;
  readonly repository: string;
  readonly commitId: string;
  readonly includePatch?: boolean;
  readonly includeRaw?: boolean;
}

export interface SearchCommitsByWorkItemInput {
  readonly project: string;
  readonly workItemId: number;
  readonly includePatch?: boolean;
  readonly includeRaw?: boolean;
}

interface NormalizedPullRequestScopedInput {
  readonly project: string;
  readonly repository: string;
  readonly pullRequestId: number;
}

interface NormalizedCommitScopedInput {
  readonly project: string;
  readonly repository: string;
  readonly commitId: string;
}

interface PullRequestArtifactReference {
  readonly project: string;
  readonly repository: string;
  readonly pullRequestId: number;
}

interface CommitArtifactReference {
  readonly project: string;
  readonly repository: string;
  readonly commitId: string;
}

interface PullRequestRecordLoad {
  readonly summary: PullRequestFull;
  readonly raw: unknown;
}

interface CommitRecordLoad {
  readonly summary: GitCommitSummary;
  readonly repository: PullRequestRepositoryContext;
  readonly raw: unknown;
}

interface CommitAggregationState {
  readonly project: string;
  readonly repositoryInput: string;
  readonly commitId: string;
  repositoryName: string | null;
  repositoryId: string | null;
  summary: GitCommitSummary | null;
  changedFiles?: readonly PullRequestFileChangeSummary[];
  readonly pullRequestIds: Set<number>;
  readonly rawFragments: unknown[];
}

const DEFAULT_PULL_REQUEST_DIFF_PAGE_SIZE = 200;

function normalizeProject(value: string): string {
  return value.trim();
}

function normalizeRepository(value: string): string {
  return value.trim();
}

function normalizePullRequestScopedInput(
  input: GetPullRequestFullInput | ListPullRequestCommitsInput | GetPullRequestDiffInput,
): NormalizedPullRequestScopedInput {
  return {
    project: normalizeProject(input.project),
    repository: normalizeRepository(input.repository),
    pullRequestId: input.pullRequestId,
  };
}

function normalizeCommitScopedInput(input: GetCommitFullInput): NormalizedCommitScopedInput {
  return {
    project: normalizeProject(input.project),
    repository: normalizeRepository(input.repository),
    commitId: input.commitId.trim(),
  };
}

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function looksLikeGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

function matchesRepository(
  requestedRepository: string,
  repository: PullRequestRepositoryContext,
): boolean {
  if (!requestedRepository.trim()) {
    return true;
  }

  return sameText(requestedRepository, repository.id) || sameText(requestedRepository, repository.name);
}

function filterAllowedWorkItems(
  workItems: readonly WorkItemSummary[],
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): WorkItemSummary[] {
  if (config.azdoProjectAllowlist.length === 0) {
    return [...workItems];
  }

  return workItems.filter((workItem) => isProjectAllowed(workItem.project ?? undefined, config));
}

function buildPullRequestPath(project: string, repository: string, pullRequestId: number): string {
  return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    repository,
  )}/pullRequests/${pullRequestId}?api-version=7.1`;
}

function buildPullRequestCommitsPath(
  project: string,
  repository: string,
  pullRequestId: number,
): string {
  return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    repository,
  )}/pullRequests/${pullRequestId}/commits?api-version=7.1`;
}

function buildPullRequestIterationsPath(
  project: string,
  repository: string,
  pullRequestId: number,
): string {
  return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    repository,
  )}/pullRequests/${pullRequestId}/iterations?api-version=7.1`;
}

function buildCommitPath(project: string, repository: string, commitId: string): string {
  return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    repository,
  )}/commits/${encodeURIComponent(commitId)}?api-version=7.1`;
}

function buildCommitChangesPath(
  project: string,
  repository: string,
  commitId: string,
  skip: number,
  top: number,
): string {
  return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    repository,
  )}/commits/${encodeURIComponent(commitId)}/changes?$skip=${skip}&$top=${top}&api-version=7.1`;
}

function buildPullRequestIterationChangesPath(
  project: string,
  repository: string,
  pullRequestId: number,
  iterationId: number,
  skip: number,
  top: number,
): string {
  return `/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(
    repository,
  )}/pullRequests/${pullRequestId}/iterations/${iterationId}/changes?$skip=${skip}&$top=${top}&api-version=7.1`;
}

function selectLatestIteration(rawIterations: readonly unknown[]): {
  readonly id: number | null;
  readonly sourceCommitId: string | null;
  readonly targetCommitId: string | null;
  readonly raw: unknown | null;
} {
  const iterations = rawIterations
    .map((rawIteration) => {
      const record = asRecord(rawIteration);
      return {
        id: asInteger(record.id),
        sourceCommitId: asString(asRecord(record.sourceRefCommit).commitId),
        targetCommitId: asString(asRecord(record.targetRefCommit).commitId),
        raw: rawIteration,
      };
    })
    .filter((iteration): iteration is { readonly id: number; readonly sourceCommitId: string | null; readonly targetCommitId: string | null; readonly raw: unknown } => iteration.id !== null)
    .sort((left, right) => right.id - left.id);

  const latest = iterations[0];
  if (!latest) {
    return {
      id: null,
      sourceCommitId: null,
      targetCommitId: null,
      raw: null,
    };
  }

  return latest;
}

function mapLinkedPullRequest(
  pullRequest: PullRequestFull,
  raw: unknown,
  includeRaw: boolean,
): LinkedPullRequestSummary {
  return {
    pullRequestId: pullRequest.pullRequestId,
    title: pullRequest.title,
    repository: pullRequest.repository.name,
    repositoryId: pullRequest.repository.id,
    project: pullRequest.repository.project,
    status: pullRequest.status,
    createdBy: pullRequest.createdBy,
    createdDate: pullRequest.createdDate,
    sourceBranch: pullRequest.sourceBranch,
    targetBranch: pullRequest.targetBranch,
    url: pullRequest.url,
    ...(includeRaw ? { raw } : {}),
  };
}

function buildProjectMismatchError(
  pullRequestId: number,
  actualProject: string,
  requestedProject: string,
): Error {
  return new Error(
    `Pull request ${pullRequestId} belongs to project "${actualProject}" instead of "${requestedProject}".`,
  );
}

function buildRepositoryMismatchError(
  pullRequestId: number,
  repository: PullRequestRepositoryContext,
  requestedRepository: string,
): Error {
  return new Error(
    `Pull request ${pullRequestId} belongs to repository "${repository.name ?? repository.id ?? "unknown"}" instead of "${requestedRepository}".`,
  );
}

function validatePullRequestContext(
  pullRequest: PullRequestFull,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  options: {
    readonly requestedProject?: string;
    readonly requestedRepository?: string;
    readonly enforceRequestedProject?: boolean;
    readonly enforceRequestedRepository?: boolean;
  } = {},
): void {
  const actualProject = pullRequest.repository.project;
  if (actualProject && !isProjectAllowed(actualProject, config)) {
    throw new Error(
      `Pull request ${pullRequest.pullRequestId} belongs to project "${actualProject}" which is not permitted by this connector.`,
    );
  }

  if (
    options.enforceRequestedProject &&
    options.requestedProject &&
    actualProject &&
    !sameText(actualProject, options.requestedProject)
  ) {
    throw buildProjectMismatchError(
      pullRequest.pullRequestId,
      actualProject,
      options.requestedProject,
    );
  }

  if (
    options.enforceRequestedRepository &&
    options.requestedRepository &&
    !matchesRepository(options.requestedRepository, pullRequest.repository)
  ) {
    throw buildRepositoryMismatchError(
      pullRequest.pullRequestId,
      pullRequest.repository,
      options.requestedRepository,
    );
  }
}

async function loadPullRequestRecord(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: NormalizedPullRequestScopedInput,
  options: {
    readonly includeReviewers?: boolean;
    readonly includeRaw?: boolean;
    readonly enforceRequestedProject?: boolean;
    readonly enforceRequestedRepository?: boolean;
  } = {},
): Promise<PullRequestRecordLoad> {
  assertProjectAllowed(input.project, config);

  const raw = await client.get<unknown>(
    buildPullRequestPath(input.project, input.repository, input.pullRequestId),
  );
  const summary = mapPullRequestFull(raw, {
    includeReviewers: options.includeReviewers,
    includeRaw: options.includeRaw,
  });

  validatePullRequestContext(summary, config, {
    requestedProject: input.project,
    requestedRepository: input.repository,
    enforceRequestedProject: options.enforceRequestedProject ?? true,
    enforceRequestedRepository: options.enforceRequestedRepository ?? true,
  });

  return {
    summary,
    raw,
  };
}

function buildCommitProjectMismatchError(
  commitId: string,
  actualProject: string,
  requestedProject: string,
): Error {
  return new Error(
    `Commit ${commitId} belongs to project "${actualProject}" instead of "${requestedProject}".`,
  );
}

function buildCommitRepositoryMismatchError(
  commitId: string,
  repository: PullRequestRepositoryContext,
  requestedRepository: string,
): Error {
  return new Error(
    `Commit ${commitId} belongs to repository "${repository.name ?? repository.id ?? "unknown"}" instead of "${requestedRepository}".`,
  );
}

function deriveCommitRepositoryContext(
  raw: unknown,
  input: NormalizedCommitScopedInput,
): PullRequestRepositoryContext {
  const repository = mapPullRequestRepositoryContext(asRecord(raw).repository);

  return {
    ...repository,
    id: repository.id ?? (looksLikeGuid(input.repository) ? input.repository : null),
    name: repository.name ?? input.repository,
    project: repository.project ?? input.project,
  };
}

function validateCommitContext(
  commitId: string,
  repository: PullRequestRepositoryContext,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  options: {
    readonly requestedProject?: string;
    readonly requestedRepository?: string;
    readonly enforceRequestedProject?: boolean;
    readonly enforceRequestedRepository?: boolean;
  } = {},
): void {
  const actualProject = repository.project;
  if (actualProject && !isProjectAllowed(actualProject, config)) {
    throw new Error(
      `Commit ${commitId} belongs to project "${actualProject}" which is not permitted by this connector.`,
    );
  }

  if (
    options.enforceRequestedProject &&
    options.requestedProject &&
    actualProject &&
    !sameText(actualProject, options.requestedProject)
  ) {
    throw buildCommitProjectMismatchError(commitId, actualProject, options.requestedProject);
  }

  if (
    options.enforceRequestedRepository &&
    options.requestedRepository &&
    !matchesRepository(options.requestedRepository, repository)
  ) {
    throw buildCommitRepositoryMismatchError(commitId, repository, options.requestedRepository);
  }
}

async function loadCommitRecord(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: NormalizedCommitScopedInput,
  options: {
    readonly includeRaw?: boolean;
    readonly enforceRequestedProject?: boolean;
    readonly enforceRequestedRepository?: boolean;
  } = {},
): Promise<CommitRecordLoad> {
  assertProjectAllowed(input.project, config);

  const raw = await client.get<unknown>(buildCommitPath(input.project, input.repository, input.commitId));
  const summary = mapGitCommit(raw, options.includeRaw);
  const repository = deriveCommitRepositoryContext(raw, input);

  validateCommitContext(summary.commitId || input.commitId, repository, config, {
    requestedProject: input.project,
    requestedRepository: input.repository,
    enforceRequestedProject: options.enforceRequestedProject ?? true,
    enforceRequestedRepository: options.enforceRequestedRepository ?? true,
  });

  return {
    summary,
    repository,
    raw,
  };
}

function parsePullRequestReferenceFromApiUrl(url: string): PullRequestArtifactReference | null {
  try {
    const parsedUrl = new URL(url, "https://example.invalid");
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const apisIndex = segments.findIndex((segment) => segment.toLowerCase() === "_apis");

    if (
      apisIndex < 1 ||
      segments[apisIndex + 1]?.toLowerCase() !== "git" ||
      segments[apisIndex + 2]?.toLowerCase() !== "repositories" ||
      segments[apisIndex + 4]?.toLowerCase() !== "pullrequests"
    ) {
      return null;
    }

    const project = decodeURIComponent(segments[apisIndex - 1] ?? "");
    const repository = decodeURIComponent(segments[apisIndex + 3] ?? "");
    const pullRequestId = asInteger(segments[apisIndex + 5]);

    if (!project || !repository || pullRequestId === null) {
      return null;
    }

    return {
      project,
      repository,
      pullRequestId,
    };
  } catch {
    return null;
  }
}

function parsePullRequestReferenceFromArtifactUrl(
  url: string,
  fallbackProject: string,
): PullRequestArtifactReference | null {
  const marker = "PullRequestId/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const encodedIdentity = url.slice(markerIndex + marker.length);
  const decodedIdentity = decodeURIComponent(encodedIdentity);
  const parts = decodedIdentity.split("/").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const pullRequestId = asInteger(parts[parts.length - 1]);
  const repository = parts[parts.length - 2];
  const rawProject = parts[parts.length - 3];

  if (pullRequestId === null || !repository) {
    return null;
  }

  return {
    project: !rawProject || looksLikeGuid(rawProject) ? fallbackProject : rawProject,
    repository,
    pullRequestId,
  };
}

export function parsePullRequestArtifactReference(
  relation: Pick<WorkItemRelationSummary, "rel" | "url" | "attributes">,
  fallbackProject: string,
): PullRequestArtifactReference | null {
  const relationName = asString(relation.attributes.name)?.toLowerCase();
  const relationType = relation.rel?.toLowerCase();
  const url = relation.url;

  if (!url) {
    return null;
  }

  const looksLikePullRequest =
    url.toLowerCase().includes("pullrequest") || relationName?.includes("pull request") === true;

  if (!looksLikePullRequest && relationType !== "artifactlink") {
    return null;
  }

  return (
    parsePullRequestReferenceFromApiUrl(url) ??
    parsePullRequestReferenceFromArtifactUrl(url, fallbackProject)
  );
}

function parseCommitReferenceFromApiUrl(url: string): CommitArtifactReference | null {
  try {
    const parsedUrl = new URL(url, "https://example.invalid");
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    const apisIndex = segments.findIndex((segment) => segment.toLowerCase() === "_apis");

    if (
      apisIndex < 1 ||
      segments[apisIndex + 1]?.toLowerCase() !== "git" ||
      segments[apisIndex + 2]?.toLowerCase() !== "repositories" ||
      segments[apisIndex + 4]?.toLowerCase() !== "commits"
    ) {
      return null;
    }

    const project = decodeURIComponent(segments[apisIndex - 1] ?? "");
    const repository = decodeURIComponent(segments[apisIndex + 3] ?? "");
    const commitId = decodeURIComponent(segments[apisIndex + 5] ?? "");

    if (!project || !repository || !commitId) {
      return null;
    }

    return {
      project,
      repository,
      commitId,
    };
  } catch {
    return null;
  }
}

function parseCommitReferenceFromArtifactUrl(
  url: string,
  fallbackProject: string,
): CommitArtifactReference | null {
  const marker = "Commit/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const encodedIdentity = url.slice(markerIndex + marker.length);
  const decodedIdentity = decodeURIComponent(encodedIdentity);
  const parts = decodedIdentity.split("/").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const commitId = parts[parts.length - 1];
  const repository = parts[parts.length - 2];
  const rawProject = parts[parts.length - 3];

  if (!commitId || !repository) {
    return null;
  }

  return {
    project: !rawProject || looksLikeGuid(rawProject) ? fallbackProject : rawProject,
    repository,
    commitId,
  };
}

export function parseCommitArtifactReference(
  relation: Pick<WorkItemRelationSummary, "rel" | "url" | "attributes">,
  fallbackProject: string,
): CommitArtifactReference | null {
  const relationName = asString(relation.attributes.name)?.toLowerCase();
  const relationType = relation.rel?.toLowerCase();
  const url = relation.url;

  if (!url) {
    return null;
  }

  const looksLikeCommit =
    url.toLowerCase().includes("/commits/") ||
    url.toLowerCase().includes("git/commit/") ||
    relationName?.includes("commit") === true;

  if (!looksLikeCommit && relationType !== "artifactlink") {
    return null;
  }

  return parseCommitReferenceFromApiUrl(url) ?? parseCommitReferenceFromArtifactUrl(url, fallbackProject);
}

async function loadDiffFiles(
  client: AzureDevOpsClientLike,
  input: NormalizedPullRequestScopedInput,
  iterationId: number,
  options: {
    readonly includePatch: boolean;
    readonly includeRaw: boolean;
  },
): Promise<{ readonly files: PullRequestFileChangeSummary[]; readonly rawPages?: unknown[] }> {
  const files: PullRequestFileChangeSummary[] = [];
  const rawPages: unknown[] = [];
  let skip = 0;

  while (true) {
    const rawPage = await client.get<{ changeEntries?: unknown[] }>(
      buildPullRequestIterationChangesPath(
        input.project,
        input.repository,
        input.pullRequestId,
        iterationId,
        skip,
        DEFAULT_PULL_REQUEST_DIFF_PAGE_SIZE,
      ),
    );
    const pageItems = ensureArray(rawPage.changeEntries);
    if (pageItems.length === 0) {
      break;
    }

    files.push(
      ...pageItems.map((change) =>
        mapPullRequestDiffFile(change, {
          includePatch: options.includePatch,
          includeRaw: options.includeRaw,
        }),
      ),
    );

    if (options.includeRaw) {
      rawPages.push(rawPage);
    }

    if (pageItems.length < DEFAULT_PULL_REQUEST_DIFF_PAGE_SIZE) {
      break;
    }

    skip += pageItems.length;
  }

  return options.includeRaw ? { files, rawPages } : { files };
}

async function loadCommitChanges(
  client: AzureDevOpsClientLike,
  input: NormalizedCommitScopedInput,
  options: {
    readonly includePatch: boolean;
    readonly includeRaw: boolean;
  },
): Promise<{ readonly files: PullRequestFileChangeSummary[]; readonly rawPages?: unknown[] }> {
  const files: PullRequestFileChangeSummary[] = [];
  const rawPages: unknown[] = [];
  let skip = 0;

  while (true) {
    const rawPage = await client.get<{
      changes?: unknown[];
      value?: unknown[];
      changeEntries?: unknown[];
    }>(buildCommitChangesPath(input.project, input.repository, input.commitId, skip, DEFAULT_PULL_REQUEST_DIFF_PAGE_SIZE));
    const pageItems = ensureArray(rawPage.changes ?? rawPage.value ?? rawPage.changeEntries);
    if (pageItems.length === 0) {
      break;
    }

    files.push(
      ...pageItems.map((change) =>
        mapPullRequestDiffFile(change, {
          includePatch: options.includePatch,
          includeRaw: options.includeRaw,
        }),
      ),
    );

    if (options.includeRaw) {
      rawPages.push(rawPage);
    }

    if (pageItems.length < DEFAULT_PULL_REQUEST_DIFF_PAGE_SIZE) {
      break;
    }

    skip += pageItems.length;
  }

  return options.includeRaw ? { files, rawPages } : { files };
}

export async function searchPullRequestsByWorkItem(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: SearchPullRequestsByWorkItemInput,
): Promise<PullRequestSearchResultsByWorkItem> {
  const project = normalizeProject(input.project);
  assertProjectAllowed(project, config);

  const workItem = await getWorkItemFull(client, config, {
    id: input.workItemId,
    project,
    includeRelations: true,
    includeRaw: input.includeRaw,
  });

  const relations = ensureArray<WorkItemRelationSummary>(workItem.relations);
  const rawRelations = ensureArray(asRecord(workItem.raw).relations);
  const uniqueReferences = new Map<string, { readonly reference: PullRequestArtifactReference; readonly rawRelation: unknown }>();

  relations.forEach((relation, index) => {
    const reference = parsePullRequestArtifactReference(relation, project);
    if (!reference) {
      return;
    }

    if (!isProjectAllowed(reference.project, config)) {
      return;
    }

    const key = `${reference.project}\u0000${reference.repository}\u0000${reference.pullRequestId}`;
    if (!uniqueReferences.has(key)) {
      uniqueReferences.set(key, {
        reference,
        rawRelation: rawRelations[index],
      });
    }
  });

  const pullRequests: LinkedPullRequestSummary[] = [];

  for (const { reference, rawRelation } of uniqueReferences.values()) {
    const result = await loadPullRequestRecord(
      client,
      config,
      {
        project: reference.project,
        repository: reference.repository,
        pullRequestId: reference.pullRequestId,
      },
      {
        includeRaw: input.includeRaw,
        includeReviewers: false,
        enforceRequestedProject: false,
        enforceRequestedRepository: false,
      },
    );

    pullRequests.push(
      mapLinkedPullRequest(
        result.summary,
        input.includeRaw ? { relation: rawRelation, pullRequest: result.raw } : result.raw,
        input.includeRaw ?? false,
      ),
    );
  }

  return {
    project,
    workItemId: input.workItemId,
    total: pullRequests.length,
    pullRequests,
  };
}

export async function getPullRequestFull(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetPullRequestFullInput,
): Promise<PullRequestFull> {
  const normalizedInput = normalizePullRequestScopedInput(input);
  const includeWorkItems = input.includeWorkItems ?? true;
  const includeReviewers = input.includeReviewers ?? true;
  const includeRaw = input.includeRaw ?? false;

  const result = await loadPullRequestRecord(client, config, normalizedInput, {
    includeReviewers,
    includeRaw,
  });

  const linkedWorkItems = includeWorkItems
    ? filterAllowedWorkItems(
        await getPullRequestWorkItems(
          client,
          config,
          normalizedInput.project,
          normalizedInput.repository,
          normalizedInput.pullRequestId,
        ),
        config,
      )
    : undefined;

  return {
    ...result.summary,
    ...(includeWorkItems ? { workItems: linkedWorkItems } : {}),
  };
}

export async function listPullRequestCommits(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: ListPullRequestCommitsInput,
): Promise<PullRequestCommitsList> {
  const normalizedInput = normalizePullRequestScopedInput(input);
  const includeRaw = input.includeRaw ?? false;

  await loadPullRequestRecord(client, config, normalizedInput);

  const response = await client.get<{ value?: unknown[] }>(
    buildPullRequestCommitsPath(
      normalizedInput.project,
      normalizedInput.repository,
      normalizedInput.pullRequestId,
    ),
  );
  const commits = ensureArray(response.value).map((commit) => mapGitCommit(commit, includeRaw));

  return {
    project: normalizedInput.project,
    repository: normalizedInput.repository,
    pullRequestId: normalizedInput.pullRequestId,
    total: commits.length,
    commits,
  };
}

export async function getCommitFull(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetCommitFullInput,
): Promise<CommitFull> {
  const normalizedInput = normalizeCommitScopedInput(input);
  const includePatch = input.includePatch ?? false;
  const includeRaw = input.includeRaw ?? false;

  const commitRecord = await loadCommitRecord(client, config, normalizedInput, {
    includeRaw,
  });
  const changeResult = await loadCommitChanges(client, normalizedInput, {
    includePatch,
    includeRaw,
  });

  const summary = mapCommitFull(commitRecord.raw, commitRecord.repository, changeResult.files, {
    includeRaw,
  });

  return includeRaw
    ? {
        ...summary,
        raw: {
          commit: commitRecord.raw,
          changes: changeResult.rawPages ?? [],
        },
      }
    : summary;
}

function buildCommitAggregationKey(
  project: string,
  repository: string,
  commitId: string,
): string {
  return `${project}\u0000${repository}\u0000${commitId}`;
}

function mapLinkedCommit(state: CommitAggregationState, includeRaw: boolean): LinkedCommitSummary {
  return {
    commitId: state.summary?.commitId ?? state.commitId,
    comment: state.summary?.comment ?? null,
    author: state.summary?.author ?? null,
    authorDate: state.summary?.authorDate ?? null,
    committer: state.summary?.committer ?? null,
    commitDate: state.summary?.commitDate ?? null,
    repository: state.repositoryName,
    repositoryId: state.repositoryId,
    project: state.project,
    pullRequestIds: [...state.pullRequestIds].sort((left, right) => left - right),
    url: state.summary?.url ?? null,
    ...(state.changedFiles ? { changedFiles: state.changedFiles } : {}),
    ...(includeRaw
      ? {
          raw:
            state.rawFragments.length <= 1
              ? state.rawFragments[0]
              : {
                  fragments: state.rawFragments,
                },
        }
      : {}),
  };
}

async function enrichCommitAggregationState(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  state: CommitAggregationState,
  options: {
    readonly includePatch: boolean;
    readonly includeRaw: boolean;
  },
): Promise<void> {
  if (state.summary && !options.includePatch) {
    return;
  }

  const commitFull = await getCommitFull(client, config, {
    project: state.project,
    repository: state.repositoryInput,
    commitId: state.summary?.commitId ?? state.commitId,
    includePatch: options.includePatch,
    includeRaw: options.includeRaw,
  });

  state.summary = {
    commitId: commitFull.commitId,
    author: commitFull.author,
    authorDate: commitFull.authorDate,
    committer: commitFull.committer,
    commitDate: commitFull.commitDate,
    comment: commitFull.comment,
    commentTruncated: commitFull.comment,
    url: commitFull.url,
    ...(options.includeRaw ? { raw: commitFull.raw } : {}),
  };
  state.repositoryName = commitFull.repository.name;
  state.repositoryId = commitFull.repository.id;
  if (options.includePatch) {
    state.changedFiles = commitFull.changedFiles;
  }
  if (options.includeRaw && commitFull.raw !== undefined) {
    state.rawFragments.push({
      commit: commitFull.raw,
    });
  }
}

export async function getPullRequestDiff(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetPullRequestDiffInput,
): Promise<PullRequestDiff> {
  const normalizedInput = normalizePullRequestScopedInput(input);
  const includePatch = input.includePatch ?? false;
  const includeRaw = input.includeRaw ?? false;

  const pullRequest = await loadPullRequestRecord(client, config, normalizedInput);
  const iterationsResponse = await client.get<{ value?: unknown[] }>(
    buildPullRequestIterationsPath(
      normalizedInput.project,
      normalizedInput.repository,
      normalizedInput.pullRequestId,
    ),
  );
  const rawIterations = ensureArray(iterationsResponse.value);
  const latestIteration = selectLatestIteration(rawIterations);

  if (latestIteration.id === null) {
    return {
      project: normalizedInput.project,
      repository: normalizedInput.repository,
      pullRequestId: normalizedInput.pullRequestId,
      iterationId: null,
      sourceCommitId: asString(asRecord(asRecord(pullRequest.raw).lastMergeSourceCommit).commitId),
      targetCommitId: asString(asRecord(asRecord(pullRequest.raw).lastMergeTargetCommit).commitId),
      totalFiles: 0,
      files: [],
      ...(includeRaw ? { raw: { pullRequest: pullRequest.raw, iterations: rawIterations, changes: [] } } : {}),
    };
  }

  const diffFiles = await loadDiffFiles(client, normalizedInput, latestIteration.id, {
    includePatch,
    includeRaw,
  });

  return {
    project: normalizedInput.project,
    repository: normalizedInput.repository,
    pullRequestId: normalizedInput.pullRequestId,
    iterationId: latestIteration.id,
    sourceCommitId:
      latestIteration.sourceCommitId ??
      asString(asRecord(asRecord(pullRequest.raw).lastMergeSourceCommit).commitId),
    targetCommitId:
      latestIteration.targetCommitId ??
      asString(asRecord(asRecord(pullRequest.raw).lastMergeTargetCommit).commitId),
    totalFiles: diffFiles.files.length,
    files: diffFiles.files,
    ...(includeRaw
      ? {
          raw: {
            pullRequest: pullRequest.raw,
            iterations: rawIterations,
            changes: diffFiles.rawPages ?? [],
          },
        }
      : {}),
  };
}

export async function searchCommitsByWorkItem(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: SearchCommitsByWorkItemInput,
): Promise<CommitSearchResultsByWorkItem> {
  const project = normalizeProject(input.project);
  assertProjectAllowed(project, config);

  const includePatch = input.includePatch ?? false;
  const includeRaw = input.includeRaw ?? false;
  const workItem = await getWorkItemFull(client, config, {
    id: input.workItemId,
    project,
    includeRelations: true,
    includeRaw,
  });
  const relations = ensureArray<WorkItemRelationSummary>(workItem.relations);
  const rawRelations = ensureArray(asRecord(workItem.raw).relations);
  const pullRequests = await searchPullRequestsByWorkItem(client, config, {
    project,
    workItemId: input.workItemId,
    includeRaw,
  });

  const aggregatedCommits = new Map<string, CommitAggregationState>();

  const getOrCreateCommitState = (
    candidateProject: string,
    repositoryInput: string,
    commitId: string,
  ): CommitAggregationState => {
    const key = buildCommitAggregationKey(candidateProject, repositoryInput, commitId);
    const existing = aggregatedCommits.get(key);
    if (existing) {
      return existing;
    }

    const created: CommitAggregationState = {
      project: candidateProject,
      repositoryInput,
      commitId,
      repositoryName: looksLikeGuid(repositoryInput) ? null : repositoryInput,
      repositoryId: looksLikeGuid(repositoryInput) ? repositoryInput : null,
      summary: null,
      pullRequestIds: new Set<number>(),
      rawFragments: [],
    };
    aggregatedCommits.set(key, created);
    return created;
  };

  relations.forEach((relation, index) => {
    const reference = parseCommitArtifactReference(relation, project);
    if (!reference || !isProjectAllowed(reference.project, config)) {
      return;
    }

    const state = getOrCreateCommitState(reference.project, reference.repository, reference.commitId);
    if (includeRaw) {
      state.rawFragments.push({
        relation: rawRelations[index] ?? relation,
        source: "direct_relation",
      });
    }
  });

  for (const pullRequest of pullRequests.pullRequests) {
    const pullRequestProject = pullRequest.project ?? project;
    const repositoryInput = pullRequest.repositoryId ?? pullRequest.repository;
    if (!repositoryInput || !isProjectAllowed(pullRequestProject, config)) {
      continue;
    }

    const commits = await listPullRequestCommits(client, config, {
      project: pullRequestProject,
      repository: repositoryInput,
      pullRequestId: pullRequest.pullRequestId,
      includeRaw,
    });

    for (const commit of commits.commits) {
      const state = getOrCreateCommitState(pullRequestProject, repositoryInput, commit.commitId);
      state.pullRequestIds.add(pullRequest.pullRequestId);
      state.repositoryName = pullRequest.repository ?? state.repositoryName;
      state.repositoryId = pullRequest.repositoryId ?? state.repositoryId;
      state.summary = state.summary ?? commit;
      if (includeRaw && commit.raw !== undefined) {
        state.rawFragments.push({
          commit: commit.raw,
          source: "pull_request",
          pullRequestId: pullRequest.pullRequestId,
        });
      }
    }
  }

  for (const state of aggregatedCommits.values()) {
    await enrichCommitAggregationState(client, config, state, {
      includePatch,
      includeRaw,
    });
  }

  const commits = [...aggregatedCommits.values()]
    .map((state) => mapLinkedCommit(state, includeRaw))
    .sort((left, right) => {
      const leftDate = Date.parse(left.commitDate ?? left.authorDate ?? "");
      const rightDate = Date.parse(right.commitDate ?? right.authorDate ?? "");
      if (Number.isFinite(rightDate) || Number.isFinite(leftDate)) {
        const delta = (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
        if (delta !== 0) {
          return delta;
        }
      }

      return left.commitId.localeCompare(right.commitId);
    });

  return {
    project,
    workItemId: input.workItemId,
    total: commits.length,
    commits,
  };
}
