import { MAX_TOP } from "../constants.js";
import type {
  AreaPathNodeSummary,
  CommitFull,
  GitCommitStatsSummary,
  GitCommitSummary,
  IterationPathNodeSummary,
  LinkedCommitSummary,
  PipelineArtifactSummary,
  PipelineRunSummary,
  PipelineSummary,
  PullRequestDiff,
  PullRequestFileChangeSummary,
  PullRequestFull,
  PullRequestRepositoryContext,
  PullRequestReviewerSummary,
  ProjectSummary,
  PullRequestSummary,
  RepositorySummary,
  SavedQuerySummary,
  TestAttachmentSummary,
  TestCaseFullSummary,
  TestCaseParameterDefinitionSummary,
  TestCaseParametersSummary,
  TestCaseSharedStepSummary,
  TestCaseStepSummary,
  TestConfigurationSummary,
  TestEntityReferenceSummary,
  TestManagementPagingSummary,
  TestPlanFull,
  TestPlanSummary,
  TestPlanSuitesTree,
  TestPointHistory,
  TestPointHistoryEntry,
  TestPointSummary,
  TestPointsList,
  TestRunFull,
  TestRunResultStepSummary,
  TestRunResultSummary,
  TestRunSummary,
  TestSuiteChildSummary,
  TestSuiteFull,
  TestSuiteSummary,
  TestSuiteTreeNode,
  ResolvedIdentitySummary,
  WikiPageSummary,
  WorkItemFieldSummary,
  WorkItemFieldSupportedOperationSummary,
  WorkItemAttachmentSummary,
  WorkItemCategorySummary,
  WorkItemCommentSummary,
  WorkItemTagSummary,
  WorkItemFull,
  WorkItemLinksSummary,
  WorkItemRelationSummary,
  WorkItemRevisionSummary,
  WorkItemTypeFieldSummary,
  WorkItemTypeIconSummary,
  WorkItemTypeReferenceSummary,
  WorkItemTypeStateSummary,
  WorkItemTypeSummary,
  WorkItemUpdateSummary,
  WorkItemSummary,
} from "../models.js";

export type UnknownRecord = Record<string, unknown>;

export const WORK_ITEM_FIELDS = [
  "System.TeamProject",
  "System.Title",
  "System.State",
  "System.WorkItemType",
  "System.AssignedTo",
  "System.CreatedBy",
  "System.ChangedBy",
  "System.CreatedDate",
  "System.ChangedDate",
  "System.AreaPath",
  "System.IterationPath",
  "System.Tags",
  "System.CommentCount",
  "System.Reason",
  "Microsoft.VSTS.Common.Priority",
  "Microsoft.VSTS.Common.Severity",
  "Microsoft.VSTS.Common.ClosedDate",
  "System.Description",
] as const;

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

export function asBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

export function getDisplayName(value: unknown): string | null {
  const record = asRecord(value);
  return asString(record.displayName) ?? asString(record.uniqueName);
}

export function getConfigurationName(value: unknown): string | null {
  const record = asRecord(value);
  return asString(record.name) ?? asString(record.displayName);
}

export function getWorkItemProperty(
  value: unknown,
  key: string,
): string | null {
  for (const item of ensureArray<unknown>(value)) {
    const property = asRecord(asRecord(item).workItem);
    if (asString(property.key) === key) {
      return asString(property.value);
    }
  }

  return null;
}

export function stripHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const withoutTags = value.replace(/<[^>]+>/g, " ");
  const normalized = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

export function truncate(value: string | null, length: number): string | null {
  if (!value || value.length <= length) {
    return value;
  }

  return `${value.slice(0, length)}...`;
}

export function truncateContent(
  value: string,
  length: number,
): { content: string; contentLength: number; isTruncated: boolean } {
  if (value.length <= length) {
    return {
      content: value,
      contentLength: value.length,
      isTruncated: false,
    };
  }

  return {
    content: value.slice(0, length),
    contentLength: value.length,
    isTruncated: true,
  };
}

export function clampTop(value: number | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(1, Math.min(MAX_TOP, Math.floor(value)));
}

export function mapProject(raw: unknown): ProjectSummary {
  const record = asRecord(raw);

  return {
    id: asString(record.id) ?? "",
    name: asString(record.name) ?? "",
    state: asString(record.state),
    visibility: asString(record.visibility),
    url: asString(record.url),
  };
}

export function mapRepository(raw: unknown): RepositorySummary {
  const record = asRecord(raw);

  return {
    id: asString(record.id) ?? "",
    name: asString(record.name) ?? "",
    defaultBranch: asString(record.defaultBranch),
    remoteUrl: asString(record.remoteUrl),
    webUrl: asString(record.webUrl),
  };
}

export function mapPullRequest(raw: unknown): PullRequestSummary {
  const record = asRecord(raw);

  return {
    id: asNumber(record.pullRequestId) ?? 0,
    title: asString(record.title) ?? "",
    status: asString(record.status),
    createdBy: getDisplayName(record.createdBy),
    sourceBranch: asString(record.sourceRefName),
    targetBranch: asString(record.targetRefName),
    createdDate: asString(record.creationDate),
    url: asString(record.url),
  };
}

export function mapPullRequestRepositoryContext(raw: unknown): PullRequestRepositoryContext {
  const record = asRecord(raw);
  const project = asRecord(record.project);

  return {
    id: asString(record.id),
    name: asString(record.name),
    project: asString(project.name) ?? asString(project.id),
    defaultBranch: asString(record.defaultBranch),
    remoteUrl: asString(record.remoteUrl),
    webUrl: asString(record.webUrl),
    url: asString(record.url),
  };
}

export function mapPullRequestReviewer(
  raw: unknown,
  includeRaw = false,
): PullRequestReviewerSummary {
  const record = asRecord(raw);

  return {
    id: asString(record.id),
    displayName: getDisplayName(record),
    uniqueName: asString(record.uniqueName),
    vote: asInteger(record.vote),
    isRequired: asBoolean(record.isRequired),
    hasDeclined: asBoolean(record.hasDeclined),
    url: asString(record.url),
    ...(includeRaw ? { raw } : {}),
  };
}

export function mapPullRequestFull(
  raw: unknown,
  options: {
    readonly includeReviewers?: boolean;
    readonly includeRaw?: boolean;
  } = {},
): PullRequestFull {
  const record = asRecord(raw);
  const repository = mapPullRequestRepositoryContext(record.repository);
  const status = asString(record.status);

  return {
    pullRequestId: asInteger(record.pullRequestId) ?? 0,
    title: asString(record.title) ?? "",
    description: asString(record.description),
    status,
    createdBy: getDisplayName(record.createdBy),
    createdDate: asString(record.creationDate),
    closedDate: asString(record.closedDate),
    sourceBranch: asString(record.sourceRefName),
    targetBranch: asString(record.targetRefName),
    mergeStatus: asString(record.mergeStatus),
    completionStatus: status,
    isDraft: asBoolean(record.isDraft),
    repository,
    url: asString(record.url),
    ...(options.includeReviewers
      ? {
          reviewers: ensureArray(record.reviewers).map((reviewer) =>
            mapPullRequestReviewer(reviewer, options.includeRaw),
          ),
        }
      : {}),
    ...(options.includeRaw ? { raw } : {}),
  };
}

export function mapGitCommit(
  raw: unknown,
  includeRaw = false,
): GitCommitSummary {
  const record = asRecord(raw);
  const author = asRecord(record.author);
  const committer = asRecord(record.committer);

  return {
    commitId: asString(record.commitId) ?? "",
    author: asString(author.name) ?? asString(author.email),
    authorDate: asString(author.date),
    committer: asString(committer.name) ?? asString(committer.email),
    commitDate: asString(committer.date) ?? asString(author.date),
    comment: asString(record.comment),
    commentTruncated: asString(record.commentTruncated),
    url: asString(record.url) ?? asString(record.remoteUrl),
    ...(includeRaw ? { raw } : {}),
  };
}

export function mapGitCommitStats(
  changedFiles: readonly PullRequestFileChangeSummary[],
): GitCommitStatsSummary | null {
  if (changedFiles.length === 0) {
    return {
      changedFiles: 0,
      additions: 0,
      deletions: 0,
    };
  }

  const additions = changedFiles
    .map((file) => file.additions)
    .filter((value): value is number => value !== null);
  const deletions = changedFiles
    .map((file) => file.deletions)
    .filter((value): value is number => value !== null);

  return {
    changedFiles: changedFiles.length,
    additions: additions.length === changedFiles.length ? additions.reduce((sum, value) => sum + value, 0) : null,
    deletions: deletions.length === changedFiles.length ? deletions.reduce((sum, value) => sum + value, 0) : null,
  };
}

export function mapCommitFull(
  raw: unknown,
  repository: PullRequestRepositoryContext,
  changedFiles: readonly PullRequestFileChangeSummary[],
  options: {
    readonly includeRaw?: boolean;
  } = {},
): CommitFull {
  const commit = mapGitCommit(raw, options.includeRaw);

  return {
    commitId: commit.commitId,
    comment: commit.comment,
    author: commit.author,
    authorDate: commit.authorDate,
    committer: commit.committer,
    commitDate: commit.commitDate,
    url: commit.url,
    repository,
    changedFiles,
    stats: mapGitCommitStats(changedFiles),
    ...(options.includeRaw ? { raw } : {}),
  };
}

export function mapPullRequestDiffFile(
  raw: unknown,
  options: {
    readonly includePatch?: boolean;
    readonly includeRaw?: boolean;
  } = {},
): PullRequestFileChangeSummary {
  const record = asRecord(raw);
  const item = asRecord(record.item);
  const counts = asRecord(record.changeCounts);
  const itemType = asString(item.gitObjectType) ?? asString(item.objectType);
  const patch =
    asString(record.patch) ??
    asString(record.diff) ??
    asString(asRecord(record.newContent).content) ??
    asString(asRecord(record.diffHunk).content) ??
    null;

  return {
    path: asString(item.path) ?? asString(record.path),
    originalPath: asString(record.originalPath) ?? asString(asRecord(record.originalItem).path),
    changeType: asString(record.changeType),
    itemType,
    objectId: asString(item.objectId) ?? asString(record.objectId),
    additions: asInteger(record.additions) ?? asInteger(counts.additions),
    deletions: asInteger(record.deletions) ?? asInteger(counts.deletions),
    ...(options.includePatch ? { patch } : {}),
    ...(options.includeRaw ? { raw } : {}),
  };
}

export function mapWorkItem(raw: unknown): WorkItemSummary {
  const record = asRecord(raw);
  const fields = asRecord(record.fields);
  const changedDate = asString(fields["System.ChangedDate"]);

  return {
    id: asNumber(record.id) ?? 0,
    project: asString(fields["System.TeamProject"]),
    title: asString(fields["System.Title"]),
    state: asString(fields["System.State"]),
    workItemType: asString(fields["System.WorkItemType"]),
    assignedTo: getDisplayName(fields["System.AssignedTo"]),
    createdBy: getDisplayName(fields["System.CreatedBy"]),
    changedBy: getDisplayName(fields["System.ChangedBy"]),
    createdDate: asString(fields["System.CreatedDate"]),
    changedDate,
    closedDate:
      asString(fields["Microsoft.VSTS.Common.ClosedDate"]) ??
      asString(fields["System.ClosedDate"]),
    areaPath: asString(fields["System.AreaPath"]),
    iterationPath: asString(fields["System.IterationPath"]),
    tags: asString(fields["System.Tags"]),
    reason: asString(fields["System.Reason"]),
    priority: asNumber(fields["Microsoft.VSTS.Common.Priority"]),
    severity: asString(fields["Microsoft.VSTS.Common.Severity"]),
    commentCount: asInteger(fields["System.CommentCount"]),
    activityDate: changedDate,
    description: truncate(stripHtml(asString(fields["System.Description"])), 1_000),
    url: asString(record.url),
  };
}

function extractWorkItemIdFromRelationUrl(url: string | null): number | null {
  if (!url) {
    return null;
  }

  const match = /workitems?\/(\d+)/i.exec(url);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

export function mapWorkItemLinks(raw: unknown): WorkItemLinksSummary {
  return Object.fromEntries(
    Object.entries(asRecord(raw)).map(([name, value]) => [name, asString(asRecord(value).href)]),
  );
}

export function mapWorkItemRelation(raw: unknown): WorkItemRelationSummary {
  const record = asRecord(raw);
  const url = asString(record.url);

  return {
    rel: asString(record.rel),
    url,
    linkedWorkItemId: extractWorkItemIdFromRelationUrl(url),
    attributes: { ...asRecord(record.attributes) },
  };
}

function extractAttachmentId(url: string | null): string | null {
  if (!url) {
    return null;
  }

  const match = /\/attachments\/([^/?]+)/i.exec(url);
  return match?.[1] ?? null;
}

export function mapWorkItemComment(raw: unknown, includeRaw = false): WorkItemCommentSummary {
  const record = asRecord(raw);
  const commentId = asInteger(record.commentId ?? record.id);

  return {
    id: commentId,
    commentId,
    workItemId: asInteger(record.workItemId),
    text: asString(record.text),
    renderedText: asString(record.renderedText),
    format: asString(record.format),
    createdBy: getDisplayName(record.createdBy),
    modifiedBy: getDisplayName(record.modifiedBy),
    createdDate: asString(record.createdDate),
    modifiedDate: asString(record.modifiedDate),
    isDeleted: asBoolean(record.isDeleted),
    version: asInteger(record.version),
    url: asString(record.url),
    raw: includeRaw ? raw : undefined,
  };
}

function mapWorkItemUpdateRelations(raw: unknown): Record<string, readonly WorkItemRelationSummary[]> {
  return Object.fromEntries(
    Object.entries(asRecord(raw)).map(([name, value]) => [
      name,
      ensureArray(value).map(mapWorkItemRelation),
    ]),
  );
}

export function mapWorkItemUpdate(raw: unknown, includeRaw = false): WorkItemUpdateSummary {
  const record = asRecord(raw);
  const fields = { ...asRecord(record.fields) };
  const updateId = asInteger(record.updateId ?? record.id);

  return {
    id: updateId,
    updateId,
    workItemId: asInteger(record.workItemId),
    rev: asInteger(record.rev),
    revisedBy: getDisplayName(record.revisedBy),
    revisedDate: asString(record.revisedDate),
    changedFields: Object.keys(fields),
    fields,
    relations: mapWorkItemUpdateRelations(record.relations),
    url: asString(record.url),
    raw: includeRaw ? raw : undefined,
  };
}

export function mapWorkItemRevision(raw: unknown, includeRaw = false): WorkItemRevisionSummary {
  const record = asRecord(raw);
  const fields = { ...asRecord(record.fields) };

  return {
    id: asInteger(record.id),
    workItemId: asInteger(record.workItemId ?? record.id),
    rev: asInteger(record.rev),
    changedBy: getDisplayName(fields["System.ChangedBy"]),
    changedDate: asString(fields["System.ChangedDate"]),
    createdDate: asString(fields["System.CreatedDate"]),
    state: asString(fields["System.State"]),
    title: asString(fields["System.Title"]),
    workItemType: asString(fields["System.WorkItemType"]),
    fields,
    relations: ensureArray(record.relations).map(mapWorkItemRelation),
    url: asString(record.url),
    raw: includeRaw ? raw : undefined,
  };
}

export function mapWorkItemAttachment(raw: unknown): WorkItemAttachmentSummary {
  const record = asRecord(raw);
  const url = asString(record.url);
  const attributes = { ...asRecord(record.attributes) };

  return {
    id: extractAttachmentId(url),
    rel: asString(record.rel),
    url,
    name: asString(attributes.name),
    authorizedDate: asString(attributes.authorizedDate),
    resourceSize: asNumber(attributes.resourceSize),
    comment: asString(attributes.comment),
    attributes,
  };
}

export function mapWorkItemFull(
  raw: unknown,
  options: {
    readonly includeRaw?: boolean;
    readonly includeRelations?: boolean;
    readonly includeLinks?: boolean;
  } = {},
): WorkItemFull {
  const record = asRecord(raw);
  const commentVersionRef = asRecord(record.commentVersionRef);
  const includeRelations = options.includeRelations === true;
  const includeLinks = options.includeLinks === true;
  const links = { ...asRecord(record._links) };
  const baseWorkItem: WorkItemFull = {
    ...mapWorkItem(raw),
    rev: asInteger(record.rev),
    fields: { ...asRecord(record.fields) },
    commentVersionRef: Object.keys(commentVersionRef).length > 0 ? commentVersionRef : null,
    raw: options.includeRaw === true ? raw : undefined,
  };

  return {
    ...baseWorkItem,
    ...(includeRelations
      ? {
          relations: ensureArray(record.relations).map(mapWorkItemRelation),
        }
      : {}),
    ...(includeLinks
      ? {
          links: mapWorkItemLinks(links),
          _links: links,
        }
      : {}),
  };
}

export function mapWorkItemTypeReference(raw: unknown): WorkItemTypeReferenceSummary {
  const record = asRecord(raw);

  return {
    name: asString(record.name) ?? "",
    url: asString(record.url),
  };
}

export function mapWorkItemCategory(raw: unknown): WorkItemCategorySummary {
  const record = asRecord(raw);

  return {
    name: asString(record.name) ?? "",
    referenceName: asString(record.referenceName),
    defaultWorkItemType:
      record.defaultWorkItemType === undefined || record.defaultWorkItemType === null
        ? null
        : mapWorkItemTypeReference(record.defaultWorkItemType),
    workItemTypes: ensureArray(record.workItemTypes).map(mapWorkItemTypeReference),
    url: asString(record.url),
  };
}

export function mapWorkItemTypeIcon(raw: unknown): WorkItemTypeIconSummary | null {
  const record = asRecord(raw);
  const id = asString(record.id);
  const url = asString(record.url);

  if (!id && !url) {
    return null;
  }

  return {
    id,
    url,
  };
}

export function mapWorkItemTypeState(raw: unknown): WorkItemTypeStateSummary {
  const record = asRecord(raw);

  return {
    name: asString(record.name) ?? "",
    color: asString(record.color),
    category: asString(record.category),
  };
}

export function mapWorkItemTypeField(raw: unknown): WorkItemTypeFieldSummary {
  const record = asRecord(raw);

  return {
    name: asString(record.name) ?? "",
    referenceName: asString(record.referenceName),
    alwaysRequired: asBoolean(record.alwaysRequired),
    url: asString(record.url),
  };
}

export function mapWorkItemType(raw: unknown, includeRaw = false): WorkItemTypeSummary {
  const record = asRecord(raw);
  const rawFields = Array.isArray(record.fieldInstances) ? record.fieldInstances : record.fields;

  return {
    name: asString(record.name) ?? "",
    referenceName: asString(record.referenceName),
    description: asString(record.description),
    color: asString(record.color),
    icon: mapWorkItemTypeIcon(record.icon),
    isDisabled: asBoolean(record.isDisabled),
    states: ensureArray(record.states).map(mapWorkItemTypeState),
    fields: ensureArray(rawFields).map(mapWorkItemTypeField),
    url: asString(record.url),
    categoryReferenceName: null,
    categoryName: null,
    raw: includeRaw ? raw : undefined,
  };
}

export function mapWorkItemFieldSupportedOperation(
  raw: unknown,
): WorkItemFieldSupportedOperationSummary {
  const record = asRecord(raw);

  return {
    name: asString(record.name) ?? "",
    referenceName: asString(record.referenceName),
  };
}

export function mapWorkItemField(
  raw: unknown,
  includeRaw = false,
): WorkItemFieldSummary {
  const record = asRecord(raw);

  return {
    name: asString(record.name) ?? "",
    referenceName: asString(record.referenceName) ?? "",
    type: asString(record.type),
    readOnly: asBoolean(record.readOnly),
    isIdentity: asBoolean(record.isIdentity),
    isPicklist: asBoolean(record.isPicklist),
    supportedOperations: ensureArray(record.supportedOperations).map(
      mapWorkItemFieldSupportedOperation,
    ),
    url: asString(record.url),
    ...(includeRaw ? { raw } : {}),
  };
}

function mapClassificationPathBase(raw: unknown): {
  readonly path: string | null;
  readonly name: string | null;
  readonly hasChildren: boolean;
} {
  const record = asRecord(raw);
  const children = ensureArray(record.children);

  return {
    path: asString(record.path),
    name: asString(record.name),
    hasChildren: children.length > 0 || asBoolean(record.hasChildren),
  };
}

export function mapAreaPathNode(
  raw: unknown,
  options: {
    readonly includeRaw?: boolean;
    readonly pathOverride?: string;
    readonly children?: readonly AreaPathNodeSummary[];
  } = {},
): AreaPathNodeSummary {
  const base = mapClassificationPathBase(raw);

  return {
    path: options.pathOverride ?? base.path ?? base.name ?? "",
    name: base.name ?? "",
    hasChildren: base.hasChildren,
    children: options.children ?? [],
    ...(options.includeRaw ? { raw } : {}),
  };
}

export function mapIterationPathNode(
  raw: unknown,
  options: {
    readonly includeRaw?: boolean;
    readonly pathOverride?: string;
    readonly children?: readonly IterationPathNodeSummary[];
  } = {},
): IterationPathNodeSummary {
  const base = mapClassificationPathBase(raw);
  const attributes = asRecord(asRecord(raw).attributes);

  return {
    path: options.pathOverride ?? base.path ?? base.name ?? "",
    name: base.name ?? "",
    startDate: asString(attributes.startDate),
    finishDate: asString(attributes.finishDate),
    hasChildren: base.hasChildren,
    children: options.children ?? [],
    ...(options.includeRaw ? { raw } : {}),
  };
}

export function mapWorkItemTag(
  raw: unknown,
  includeRaw = false,
): WorkItemTagSummary {
  const record = asRecord(raw);

  return {
    name: asString(record.name) ?? "",
    url: asString(record.url),
    ...(includeRaw ? { raw } : {}),
  };
}

function getIdentityPropertyValue(properties: unknown, key: string): string | null {
  const record = asRecord(asRecord(properties)[key]);
  return asString(record.$value) ?? asString(record.value);
}

export function mapResolvedIdentity(
  raw: unknown,
  includeRaw = false,
): ResolvedIdentitySummary {
  const record = asRecord(raw);
  const properties = asRecord(record.properties);
  const descriptor = asString(record.descriptor) ?? asString(record.subjectDescriptor);

  return {
    displayName:
      asString(record.providerDisplayName) ??
      asString(record.customDisplayName) ??
      asString(record.displayName) ??
      asString(record.name) ??
      getIdentityPropertyValue(properties, "DisplayName") ??
      asString(record.uniqueName),
    uniqueName:
      asString(record.uniqueName) ??
      getIdentityPropertyValue(properties, "Account") ??
      getIdentityPropertyValue(properties, "Mail"),
    descriptor,
    id:
      asString(record.id) ??
      asString(record.originId) ??
      asString(record.localId) ??
      descriptor,
    url: asString(record.url) ?? asString(asRecord(asRecord(record._links).web).href),
    ...(includeRaw ? { raw } : {}),
  };
}

export function mapSavedQuery(
  raw: unknown,
  options: {
    readonly includeWiql?: boolean;
    readonly includeRaw?: boolean;
    readonly children?: readonly SavedQuerySummary[];
  } = {},
): SavedQuerySummary {
  const record = asRecord(raw);

  return {
    id: asString(record.id) ?? "",
    name: asString(record.name) ?? "",
    path: asString(record.path) ?? asString(record.name) ?? "",
    isFolder: asBoolean(record.isFolder),
    hasChildren: asBoolean(record.hasChildren) || ensureArray(record.children).length > 0,
    queryType: asString(record.queryType),
    ...(options.includeWiql ? { wiql: asString(record.wiql) } : {}),
    url: asString(record.url) ?? asString(asRecord(asRecord(record._links).self).href),
    children: options.children ?? [],
    ...(options.includeRaw ? { raw } : {}),
  };
}

export function mapTestPlan(raw: unknown): TestPlanSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    state: asString(record.state),
    startDate: asString(record.startDate),
    endDate: asString(record.endDate),
    iteration: asString(record.iteration),
    areaPath: asString(record.areaPath),
  };
}

export function mapTestSuite(raw: unknown): TestSuiteSummary {
  const record = asRecord(raw);
  const parentSuite = asRecord(record.parentSuite);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    suiteType: asString(record.suiteType),
    parentSuiteId: asInteger(parentSuite.id),
    testCaseCount: asInteger(record.testCaseCount) ?? asInteger(record.testCasesCount),
  };
}

export function mapTestRun(raw: unknown): TestRunSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    state: asString(record.state),
    totalTests: asInteger(record.totalTests),
    passedTests: asInteger(record.passedTests),
    failedTests: asInteger(record.failedTests),
    startedDate: asString(record.startedDate),
    completedDate: asString(record.completedDate),
  };
}

export function mapTestEntityReference(raw: unknown): TestEntityReferenceSummary | null {
  const record = asRecord(raw);
  const id =
    asInteger(record.id) ??
    asInteger(record.planId) ??
    asInteger(record.suiteId) ??
    asInteger(record.testCaseId) ??
    asInteger(record.runId) ??
    asInteger(record.configurationId);
  const name =
    asString(record.name) ??
    asString(record.title) ??
    asString(record.displayName);
  const url = asString(record.url);

  if (id === null && !name && !url) {
    return null;
  }

  return {
    id,
    name,
    url,
  };
}

export function mapTestConfiguration(raw: unknown): TestConfigurationSummary | null {
  const reference = mapTestEntityReference(raw);
  const record = asRecord(raw);

  if (!reference) {
    return null;
  }

  return {
    ...reference,
    isDefault: asBoolean(record.isDefault),
    state: asString(record.state),
  };
}

function getTestSuiteRequirementId(raw: unknown): number | null {
  const record = asRecord(raw);
  return (
    asInteger(record.requirementId) ??
    asInteger(asRecord(record.requirement).id) ??
    asInteger(asRecord(record.requirementTestCase).id)
  );
}

function extractLinks(raw: unknown): Record<string, unknown> | undefined {
  const links = { ...asRecord(raw) };
  return Object.keys(links).length > 0 ? links : undefined;
}

function getTestPointTitle(record: UnknownRecord): string | null {
  return (
    asString(record.title) ??
    asString(asRecord(record.testCase).name) ??
    getWorkItemProperty(record.workItemProperties, "System.Title")
  );
}

function getTestPointSuiteTitle(record: UnknownRecord): string | null {
  return (
    asString(asRecord(record.testSuite).name) ??
    asString(asRecord(record.suite).name) ??
    asString(record.testSuiteTitle)
  );
}

function getTestPointRunBy(record: UnknownRecord): string | null {
  return (
    getDisplayName(record.runBy) ??
    getDisplayName(record.lastUpdatedBy) ??
    getDisplayName(record.lastResultDetails) ??
    getDisplayName(record.lastTestRunBy)
  );
}

function mapAssociatedWorkItemIds(raw: unknown): number[] {
  const ids = ensureArray<unknown>(raw)
    .map((item) => {
      const record = asRecord(item);
      return asInteger(record.id) ?? asInteger(record.workItemId);
    })
    .filter((id): id is number => id !== null);

  return [...new Set(ids)];
}

export function mapTestPlanFull(raw: unknown, includeRaw = false): TestPlanFull {
  const record = asRecord(raw);
  const rootSuite = asRecord(record.rootSuite);

  return {
    ...mapTestPlan(raw),
    rootSuiteId: asInteger(record.rootSuiteId) ?? asInteger(rootSuite.id),
    owner: getDisplayName(record.owner),
    createdBy: getDisplayName(record.createdBy),
    createdDate: asString(record.createdDate),
    updatedBy: getDisplayName(record.updatedBy),
    updatedDate: asString(record.updatedDate),
    revision: asInteger(record.revision),
    url: asString(record.url),
    _links: extractLinks(record._links),
    raw: includeRaw ? raw : undefined,
  };
}

export function mapTestSuiteChildSummary(raw: unknown): TestSuiteChildSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    suiteType: asString(record.suiteType),
    testCaseCount: asInteger(record.testCaseCount) ?? asInteger(record.testCasesCount),
    url: asString(record.url),
  };
}

export function mapTestSuiteTreeNode(
  raw: unknown,
  planId: number,
  children: readonly TestSuiteTreeNode[],
  includeRaw = false,
): TestSuiteTreeNode {
  const record = asRecord(raw);
  const parentSuite = asRecord(record.parentSuite);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    planId,
    parentSuiteId: asInteger(parentSuite.id) ?? asInteger(record.parentSuiteId),
    suiteType: asString(record.suiteType),
    testCaseCount: asInteger(record.testCaseCount) ?? asInteger(record.testCasesCount),
    requirementId: getTestSuiteRequirementId(raw),
    queryString: asString(record.queryString),
    inheritDefaultConfigurations: asBoolean(record.inheritDefaultConfigurations),
    defaultConfigurations: ensureArray(record.defaultConfigurations)
      .map((configuration) => mapTestConfiguration(configuration))
      .filter((configuration): configuration is TestConfigurationSummary => configuration !== null),
    state: asString(record.state),
    url: asString(record.url),
    children,
    raw: includeRaw ? raw : undefined,
  };
}

export function mapTestPlanSuitesTree(
  project: string,
  planId: number,
  rootSuiteId: number | null,
  suiteTree: readonly TestSuiteTreeNode[],
): TestPlanSuitesTree {
  return {
    project,
    planId,
    rootSuiteId,
    totalSuites: countTestSuiteTreeNodes(suiteTree),
    suiteTree,
  };
}

function countTestSuiteTreeNodes(suiteTree: readonly TestSuiteTreeNode[]): number {
  return suiteTree.reduce((total, suite) => total + 1 + countTestSuiteTreeNodes(suite.children), 0);
}

export function mapTestSuiteFull(
  raw: unknown,
  options: {
    readonly planId: number;
    readonly planName?: string | null;
    readonly parent?: TestSuiteChildSummary | null;
    readonly children?: readonly TestSuiteChildSummary[];
    readonly includeRaw?: boolean;
  },
): TestSuiteFull {
  const record = asRecord(raw);
  const defaultConfigurations = ensureArray(record.defaultConfigurations)
    .map((configuration) => mapTestConfiguration(configuration))
    .filter((configuration): configuration is TestConfigurationSummary => configuration !== null);

  return {
    ...mapTestSuite(raw),
    planId: options.planId,
    planName: options.planName ?? null,
    requirementId: getTestSuiteRequirementId(raw),
    queryString: asString(record.queryString),
    inheritDefaultConfigurations: asBoolean(record.inheritDefaultConfigurations),
    defaultConfigurations,
    state: asString(record.state),
    parent: options.parent ?? null,
    children: options.children ?? [],
    configurationCount:
      defaultConfigurations.length > 0
        ? defaultConfigurations.length
        : asInteger(record.configurationCount),
    url: asString(record.url),
    _links: extractLinks(record._links),
    raw: options.includeRaw === true ? raw : undefined,
  };
}

export function mapTestPoint(raw: unknown, includeRaw = false): TestPointSummary {
  const record = asRecord(raw);
  const lastResultDetails = asRecord(record.lastResultDetails);
  const testCase = asRecord(record.testCase);
  const testSuite = asRecord(record.testSuite);
  const configuration = mapTestConfiguration(record.configuration);

  return {
    pointId: asInteger(record.id) ?? 0,
    title: getTestPointTitle(record),
    outcome: asString(record.outcome) ?? asString(lastResultDetails.outcome),
    order: asInteger(record.order),
    state: asString(record.state),
    isActive: asBoolean(record.isActive),
    lastUpdatedDate: asString(record.lastUpdatedDate),
    testCaseId: asInteger(testCase.id) ?? asInteger(record.testCaseId),
    testCaseTitle: asString(testCase.name) ?? getWorkItemProperty(record.workItemProperties, "System.Title"),
    testSuiteId: asInteger(testSuite.id) ?? asInteger(record.suiteId),
    testSuiteTitle: getTestPointSuiteTitle(record),
    configuration: configuration?.name ?? null,
    configurationId: configuration?.id ?? null,
    tester: getDisplayName(record.assignedTo),
    lastRunId: asInteger(record.lastRunId) ?? asInteger(asRecord(record.lastTestRun).id),
    lastResultId: asInteger(record.lastResultId) ?? asInteger(lastResultDetails.id),
    runBy: getTestPointRunBy(record),
    timeCompleted: asString(record.lastResultStateChangedDate) ?? asString(lastResultDetails.completedDate),
    failureType: asString(record.failureType),
    resolutionState: asString(record.resolutionState),
    workItemProperties: { ...asRecord(record.workItemProperties) },
    testCase: Object.keys(testCase).length > 0 ? { ...testCase } : null,
    url: asString(record.url),
    _links: extractLinks(record._links),
    raw: includeRaw ? raw : undefined,
  };
}

export function mapTestPointsList(
  project: string,
  planId: number,
  suiteId: number,
  paging: TestManagementPagingSummary,
  points: readonly TestPointSummary[],
  totalCount?: number,
): TestPointsList {
  return {
    project,
    planId,
    suiteId,
    totalCount: totalCount ?? points.length,
    returned: points.length,
    paging,
    points,
  };
}

function decodeXmlText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const decoded = withoutCdata
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");

  return stripHtml(decoded);
}

function parseXmlAttributes(fragment: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of fragment.matchAll(/([A-Za-z_][\w.:-]*)="([^"]*)"/g)) {
    attributes[match[1]] = match[2];
  }

  return attributes;
}

export function parseTestCaseStepsField(
  stepsXml: string | null,
  sharedStepTitlesById: ReadonlyMap<number, TestCaseSharedStepSummary> = new Map(),
): TestCaseStepSummary[] {
  if (!stepsXml) {
    return [];
  }

  const steps: TestCaseStepSummary[] = [];
  const tokenRegex = /<(step|compref)\b([^>]*?)(?:>([\s\S]*?)<\/\1>|\/>)/gi;

  for (const match of stepsXml.matchAll(tokenRegex)) {
    const tag = match[1]?.toLowerCase() ?? "";
    const attributes = parseXmlAttributes(match[2] ?? "");
    const body = match[3] ?? "";
    const type = (attributes.type ?? "").toLowerCase();
    const index = asInteger(attributes.id) ?? steps.length + 1;
    const sharedStepId = asInteger(attributes.ref);

    if (tag === "compref" || type.includes("sharedstep")) {
      const sharedStep = sharedStepId !== null ? sharedStepTitlesById.get(sharedStepId) : undefined;
      steps.push({
        index,
        kind: "sharedStep",
        actionText: null,
        expectedResult: null,
        sharedStepId,
        sharedStepTitle: sharedStep?.title ?? null,
      });
      continue;
    }

    const parameterizedStrings = [...body.matchAll(/<parameterizedString\b[^>]*>([\s\S]*?)<\/parameterizedString>/gi)]
      .map((entry) => decodeXmlText(entry[1] ?? null));

    steps.push({
      index,
      kind: "action",
      actionText: parameterizedStrings[0] ?? null,
      expectedResult: parameterizedStrings[1] ?? null,
      sharedStepId: null,
      sharedStepTitle: null,
    });
  }

  return steps;
}

function parseTestCaseParameterDefinitions(
  parametersXml: string | null,
): TestCaseParameterDefinitionSummary[] {
  if (!parametersXml) {
    return [];
  }

  const definitions: TestCaseParameterDefinitionSummary[] = [];

  for (const match of parametersXml.matchAll(/<param\b([^>]*)\/?>/gi)) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const name = decodeXmlText(attributes.name ?? null);
    if (!name) {
      continue;
    }

    definitions.push({
      name,
      bind: decodeXmlText(attributes.bind ?? null),
    });
  }

  return definitions;
}

function parseTestCaseParameterRows(
  localDataSourceXml: string | null,
): Record<string, string | null>[] {
  if (!localDataSourceXml) {
    return [];
  }

  const withoutDeclaration = localDataSourceXml.replace(/<\?xml[\s\S]*?\?>/gi, "").trim();
  const rootMatch = withoutDeclaration.match(/^<([A-Za-z_][\w.:-]*)[^>]*>([\s\S]*)<\/\1>\s*$/i);
  const innerXml = rootMatch?.[2]?.trim() ?? withoutDeclaration;
  const rowTagMatch = innerXml.match(/<([A-Za-z_][\w.:-]*)[^>]*>/i);
  if (!rowTagMatch) {
    return [];
  }

  const rowTag = rowTagMatch[1];
  const rowRegex = new RegExp(`<${rowTag}[^>]*>([\\s\\S]*?)<\\/${rowTag}>`, "gi");
  const rows: Record<string, string | null>[] = [];

  for (const match of innerXml.matchAll(rowRegex)) {
    const rowBody = match[1] ?? "";
    const row: Record<string, string | null> = {};

    for (const fieldMatch of rowBody.matchAll(/<([A-Za-z_][\w.:-]*)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      row[fieldMatch[1]] = decodeXmlText(fieldMatch[2] ?? null);
    }

    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

export function parseTestCaseParameters(
  parametersXml: string | null,
  localDataSourceXml: string | null,
): TestCaseParametersSummary | null {
  const definitions = parseTestCaseParameterDefinitions(parametersXml);
  const rows = parseTestCaseParameterRows(localDataSourceXml);

  if (definitions.length === 0 && rows.length === 0) {
    return null;
  }

  return {
    definitions,
    rows,
  };
}

export function mapTestCaseFull(
  raw: unknown,
  options: {
    readonly points: readonly TestPointSummary[];
    readonly sharedStepsById?: ReadonlyMap<number, TestCaseSharedStepSummary>;
    readonly includeRaw?: boolean;
  },
): TestCaseFullSummary {
  const fields = asRecord(asRecord(raw).fields);
  const workItem = mapWorkItem(raw);
  const sharedStepsById = options.sharedStepsById ?? new Map<number, TestCaseSharedStepSummary>();
  const steps = parseTestCaseStepsField(
    asString(fields["Microsoft.VSTS.TCM.Steps"]),
    sharedStepsById,
  );
  const sharedSteps = [
    ...new Set(
      steps
        .map((step) => step.sharedStepId)
        .filter((sharedStepId): sharedStepId is number => sharedStepId !== null),
    ),
  ].map((sharedStepId) => {
    const sharedStep = sharedStepsById.get(sharedStepId);
    return {
      workItemId: sharedStepId,
      title: sharedStep?.title ?? null,
      url: sharedStep?.url ?? null,
    };
  });

  return {
    workItemId: workItem.id,
    title: workItem.title,
    state: workItem.state,
    priority: workItem.priority,
    assignedTo: workItem.assignedTo,
    automationStatus: asString(fields["Microsoft.VSTS.TCM.AutomationStatus"]),
    areaPath: workItem.areaPath,
    iterationPath: workItem.iterationPath,
    steps,
    parameters: parseTestCaseParameters(
      asString(fields["Microsoft.VSTS.TCM.Parameters"]),
      asString(fields["Microsoft.VSTS.TCM.LocalDataSource"]),
    ),
    sharedSteps,
    points: options.points,
    raw: options.includeRaw === true ? raw : undefined,
  };
}

export function mapTestPointHistoryEntry(
  raw: unknown,
  includeRaw = false,
): TestPointHistoryEntry {
  const record = asRecord(raw);

  return {
    resultId: asInteger(record.id) ?? asInteger(record.resultId),
    testRunId: asInteger(record.runId) ?? asInteger(asRecord(record.testRun).id),
    outcome: asString(record.outcome),
    state: asString(record.state),
    comment: asString(record.comment),
    runBy: getDisplayName(record.runBy) ?? getDisplayName(record.completedBy),
    timeCompleted: asString(record.completedDate) ?? asString(record.timeCompleted),
    durationInMs:
      asInteger(record.durationInMs) ??
      asInteger(record.durationMs) ??
      asInteger(record.duration),
    lastUpdatedDate: asString(record.lastUpdatedDate),
    testCase:
      mapTestEntityReference(
        Object.keys(asRecord(record.testCase)).length > 0
          ? record.testCase
          : {
              id: record.testCaseId,
              name: record.testCaseTitle,
            },
      ) ?? null,
    testSuite:
      mapTestEntityReference(
        Object.keys(asRecord(record.testSuite)).length > 0
          ? record.testSuite
          : {
              id: record.suiteId,
              name: record.testSuiteTitle,
            },
      ) ?? null,
    configuration:
      mapTestConfiguration(
        Object.keys(asRecord(record.configuration)).length > 0
          ? record.configuration
          : {
              id: record.configurationId,
              name: record.configurationName,
            },
      ) ?? null,
    _links: extractLinks(record._links),
    raw: includeRaw ? raw : undefined,
  };
}

export function mapTestPointHistory(
  project: string,
  planId: number,
  suiteId: number,
  pointId: number,
  point: TestPointSummary | null,
  history: readonly TestPointHistoryEntry[],
  paging: TestManagementPagingSummary,
): TestPointHistory {
  return {
    project,
    planId,
    suiteId,
    pointId,
    currentTester: point?.tester ?? null,
    testCaseId: point?.testCaseId ?? null,
    testCaseTitle: point?.testCaseTitle ?? null,
    testSuiteId: point?.testSuiteId ?? suiteId,
    testSuiteTitle: point?.testSuiteTitle ?? null,
    configurationId: point?.configurationId ?? null,
    configurationName: point?.configuration ?? null,
    totalHistoryEntries: history.length,
    paging,
    history,
  };
}

export function mapTestAttachment(raw: unknown, includeRaw = false): TestAttachmentSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? asInteger(record.attachmentId),
    name: asString(record.fileName) ?? asString(record.name),
    comment: asString(record.comment),
    url: asString(record.url),
    attachmentType: asString(record.attachmentType) ?? asString(record.type),
    size: asInteger(record.size),
    raw: includeRaw ? raw : undefined,
  };
}

function mapTestRunResultSteps(raw: unknown, includeRaw = false): TestRunResultStepSummary[] {
  const steps: TestRunResultStepSummary[] = [];

  for (const iteration of ensureArray<unknown>(asRecord(raw).iterations)) {
    const iterationRecord = asRecord(iteration);
    const actionResults = ensureArray<unknown>(iterationRecord.actionResults);

    for (const actionResult of actionResults) {
      const actionRecord = asRecord(actionResult);
      steps.push({
        actionPath: asString(actionRecord.actionPath),
        actionText:
          asString(actionRecord.actionTitle) ??
          asString(actionRecord.actionText) ??
          asString(actionRecord.stepIdentifier),
        expectedResult: asString(actionRecord.expectedResult),
        outcome: asString(actionRecord.outcome),
        comment: asString(actionRecord.comment),
        durationInMs:
          asInteger(actionRecord.durationInMs) ??
          asInteger(actionRecord.durationMs) ??
          asInteger(actionRecord.duration),
        attachments: ensureArray(actionRecord.attachments).map((attachment) =>
          mapTestAttachment(attachment, includeRaw),
        ),
        raw: includeRaw ? actionResult : undefined,
      });
    }
  }

  return steps;
}

export function mapTestRunResult(raw: unknown, includeRaw = false): TestRunResultSummary {
  const record = asRecord(raw);
  const configuration =
    mapTestConfiguration(record.configuration) ??
    mapTestConfiguration({
      id: record.configurationId,
      name: record.configurationName,
    });

  return {
    id: asInteger(record.id) ?? 0,
    outcome: asString(record.outcome),
    state: asString(record.state),
    priority: asInteger(record.priority),
    startedDate: asString(record.startedDate),
    completedDate: asString(record.completedDate),
    durationInMs:
      asInteger(record.durationInMs) ??
      asInteger(record.durationMs) ??
      asInteger(record.duration),
    runBy: getDisplayName(record.runBy) ?? getDisplayName(record.completedBy),
    errorMessage: asString(record.errorMessage),
    stackTrace: asString(record.stackTrace),
    comment: asString(record.comment),
    testCase:
      mapTestEntityReference(
        Object.keys(asRecord(record.testCase)).length > 0
          ? record.testCase
          : {
              id: record.testCaseId,
              name: record.testCaseTitle,
            },
      ) ?? null,
    testSuite:
      mapTestEntityReference(
        Object.keys(asRecord(record.testSuite)).length > 0
          ? record.testSuite
          : {
              id: record.testSuiteId ?? record.suiteId,
              name: record.testSuiteTitle,
            },
      ) ?? null,
    testPlan:
      mapTestEntityReference(
        Object.keys(asRecord(record.testPlan)).length > 0
          ? record.testPlan
          : {
              id: record.planId,
              name: record.testPlanName,
            },
      ) ?? null,
    configuration,
    linkedWorkItemIds: [
      ...new Set([
        ...mapAssociatedWorkItemIds(record.associatedWorkItems),
        ...mapAssociatedWorkItemIds(record.workItems),
      ]),
    ],
    attachments: ensureArray(record.attachments).map((attachment) =>
      mapTestAttachment(attachment, includeRaw),
    ),
    steps: mapTestRunResultSteps(raw, includeRaw),
    url: asString(record.url),
    _links: extractLinks(record._links),
    raw: includeRaw ? raw : undefined,
  };
}

export function mapTestRunFull(
  raw: unknown,
  options: {
    readonly results: readonly TestRunResultSummary[];
    readonly attachments: readonly TestAttachmentSummary[];
    readonly paging: TestManagementPagingSummary;
    readonly includeRaw?: boolean;
  },
): TestRunFull {
  const record = asRecord(raw);
  const build =
    mapTestEntityReference(record.build) ??
    mapTestEntityReference(record.pipelineReference) ??
    mapTestEntityReference({
      id: record.buildId,
      name: record.buildNumber,
    });

  const linkedWorkItemIds = [
    ...new Set(
      options.results.flatMap((result) => result.linkedWorkItemIds).filter((id) => id > 0),
    ),
  ];

  return {
    ...mapTestRun(raw),
    runId: asInteger(record.id) ?? 0,
    outcome: asString(record.outcome) ?? asString(record.result),
    result: asString(record.result),
    runBy: getDisplayName(record.runBy) ?? getDisplayName(record.owner),
    createdDate: asString(record.createdDate),
    completedDate: asString(record.completedDate),
    durationInMs:
      asInteger(record.durationInMs) ??
      asInteger(record.durationMs) ??
      asInteger(record.duration),
    comment: asString(record.comment),
    analysisOwner: getDisplayName(record.analysisOwner),
    analysisComment: asString(record.analysisComment),
    pipelineRunTested: asString(record.pipelineRunTested),
    build,
    testPlan:
      mapTestEntityReference(record.plan) ??
      mapTestEntityReference({
        id: record.planId,
        name: asRecord(record.plan).name,
      }) ??
      null,
    attachments: options.attachments,
    linkedWorkItemIds,
    results: options.results,
    paging: options.paging,
    url: asString(record.url),
    _links: extractLinks(record._links),
    raw: options.includeRaw === true ? raw : undefined,
  };
}

export function mapPipeline(raw: unknown): PipelineSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    path: asString(record.path),
    type: asString(record.type),
    queueStatus: asString(record.queueStatus),
  };
}

export function mapPipelineRun(raw: unknown): PipelineRunSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    buildNumber: asString(record.buildNumber) ?? "",
    status: asString(record.status),
    result: asString(record.result),
    startTime: asString(record.startTime),
    finishTime: asString(record.finishTime),
    definitionName: asString(asRecord(record.definition).name),
    requestedBy: getDisplayName(record.requestedBy),
  };
}

export function mapPipelineArtifact(raw: unknown): PipelineArtifactSummary {
  const record = asRecord(raw);
  const resource = asRecord(record.resource);

  return {
    id: asInteger(record.id),
    name: asString(record.name) ?? "",
    resourceType: asString(resource.type),
    downloadUrl: asString(resource.downloadUrl),
    source: asString(record.source),
  };
}

export function mapWikiPage(raw: unknown, maxLength: number): WikiPageSummary {
  const record = asRecord(raw);
  const rawContent = typeof record.content === "string" ? record.content : "";
  const truncated = truncateContent(rawContent, maxLength);

  return {
    path: asString(record.path) ?? "/",
    content: truncated.content,
    gitItemPath: asString(record.gitItemPath),
    isParentPage: asBoolean(record.isParentPage),
    contentLength: truncated.contentLength,
    isTruncated: truncated.isTruncated,
  };
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function extractCollection<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  return ensureArray<T>(asRecord(value).value);
}
