import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  APP_NAME,
  APP_VERSION,
  DEFAULT_RUN_TOP,
  MAX_TOP,
} from "../constants.js";
import type { AzureDevOpsServices } from "../domain/index.js";
import { clampTop } from "../domain/shared.js";
import type {
  AreaPathNodeSummary,
  AreaPathsCatalog,
  BlockedItemSummary,
  CommitFull,
  CommitSearchResultsByWorkItem,
  CrossProjectDependenciesSummary,
  DashboardWidgetDataSummary,
  DailyDigestSummary,
  DependencyWorkItemSummary,
  ExportedTestPlanFull,
  GitCommitSummary,
  GitCommitStatsSummary,
  IterationPathNodeSummary,
  IterationPathsCatalog,
  LinkedCommitSummary,
  LinkedPullRequestSummary,
  LinkedWorkItemsSummary,
  PipelineFailureAnalysis,
  PipelineArtifactSummary,
  PipelineRunSummary,
  PipelineSummary,
  ProjectSummary,
  PullRequestSummary,
  PullRequestCommitsList,
  PullRequestDiff,
  PullRequestFileChangeSummary,
  PullRequestFull,
  PullRequestRepositoryContext,
  PullRequestReviewerSummary,
  PullRequestSearchResultsByWorkItem,
  RepositorySummary,
  SavedQueriesCatalog,
  SavedQueryExecutionSummary,
  SavedQuerySummary,
  SimilarityClustersResult,
  SimilarityReasonSummary,
  SimilarWorkItemsResult,
  DuplicateCandidatesResult,
  TraceabilityDatasetExport,
  TraceabilityChainSummary,
  TraceabilityRelationDirection,
  TestAttachmentSummary,
  TestConfigurationSummary,
  ExportedWorkItemsFullSummary,
  TestEntityReferenceSummary,
  WorkItemLinkTypeSummary,
  WorkItemRelationsGraph,
  TestCaseFullSummary,
  TestCaseParameterDefinitionSummary,
  TestCaseParametersSummary,
  TestCaseSharedStepSummary,
  TestCaseStepSummary,
  TestCasesFullList,
  TestCaseSummary,
  TestManagementPagingSummary,
  TestPlanFull,
  TestPlanSuitesTree,
  TestPointHistory,
  TestPointHistoryEntry,
  TestPointSummary,
  TestPointsList,
  TestPlanSummary,
  RequirementTraceabilityGaps,
  RequirementTraceabilityReport,
  RequirementTraceabilityStatus,
  ResolvedIdentityCatalog,
  ResolvedIdentitySummary,
  TestRunFull,
  TestRunResultStepSummary,
  TestRunResultSummary,
  TestRunSummary,
  TestSuiteChildSummary,
  TestSuiteFull,
  TestSuiteSummary,
  TestSuiteTreeNode,
  UserStoryLinkedTestCaseCoverage,
  UserStoryPlanCoverageSummary,
  UserStoryRecentRunCoverageSummary,
  UserStorySuiteCoverageSummary,
  UserStoryTestCoverage,
  UserStoryTestCoverageStatus,
  UserStoryTestCoverageSummary,
  WorkItemTestLinksSummary,
  WikiPageSummary,
  WorkItemFieldSummary,
  WorkItemFieldsCatalog,
  WorkItemFull,
  WorkItemCategorySummary,
  WorkItemTagSummary,
  WorkItemTagsCatalog,
  WorkItemTypeSummary,
  WorkItemsDeltaExport,
  WorkItemSummary,
  SprintSummary,
  SprintCapacitySummary,
  TestFailureImpactSummary,
  WorkItemCommentsList,
  WorkItemRevisionsList,
  WorkItemAuditPagingSummary,
  WorkItemUpdatesList,
} from "../models.js";
import type { Logger } from "../logging.js";
import { createStructuredToolResult, createToolErrorResult } from "./results.js";

const readOnlyAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

const trimmedStringSchema = z.string().trim().min(1);
const trimmedStringArraySchema = z.array(trimmedStringSchema);
const isoDateOrDateTimeRegex =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
const isoDateInputSchema = trimmedStringSchema.refine(
  (value) => isoDateOrDateTimeRegex.test(value),
  "Expected an ISO 8601 date or date-time string.",
);

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string().nullable(),
  visibility: z.string().nullable(),
  url: z.string().nullable(),
});

const repositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultBranch: z.string().nullable(),
  remoteUrl: z.string().nullable(),
  webUrl: z.string().nullable(),
});

const pullRequestSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  status: z.string().nullable(),
  createdBy: z.string().nullable(),
  sourceBranch: z.string().nullable(),
  targetBranch: z.string().nullable(),
  createdDate: z.string().nullable(),
  url: z.string().nullable(),
});

const pullRequestRepositoryContextSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  project: z.string().nullable(),
  defaultBranch: z.string().nullable(),
  remoteUrl: z.string().nullable(),
  webUrl: z.string().nullable(),
  url: z.string().nullable(),
});

const pullRequestReviewerSchema = z.object({
  id: z.string().nullable(),
  displayName: z.string().nullable(),
  uniqueName: z.string().nullable(),
  vote: z.number().int().nullable(),
  isRequired: z.boolean(),
  hasDeclined: z.boolean(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const linkedPullRequestSchema = z.object({
  pullRequestId: z.number().int(),
  title: z.string(),
  repository: z.string().nullable(),
  repositoryId: z.string().nullable(),
  project: z.string().nullable(),
  status: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdDate: z.string().nullable(),
  sourceBranch: z.string().nullable(),
  targetBranch: z.string().nullable(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const pullRequestFullSchema = z.object({
  pullRequestId: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdDate: z.string().nullable(),
  closedDate: z.string().nullable(),
  sourceBranch: z.string().nullable(),
  targetBranch: z.string().nullable(),
  mergeStatus: z.string().nullable(),
  completionStatus: z.string().nullable(),
  isDraft: z.boolean(),
  repository: pullRequestRepositoryContextSchema,
  url: z.string().nullable(),
  workItems: z.array(z.lazy(() => workItemSchema)).optional(),
  reviewers: z.array(pullRequestReviewerSchema).optional(),
  raw: z.unknown().optional(),
});

const gitCommitSchema = z.object({
  commitId: z.string(),
  author: z.string().nullable(),
  authorDate: z.string().nullable(),
  committer: z.string().nullable(),
  commitDate: z.string().nullable(),
  comment: z.string().nullable(),
  commentTruncated: z.string().nullable(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const gitCommitStatsSchema = z.object({
  changedFiles: z.number().int().nonnegative(),
  additions: z.number().int().nullable(),
  deletions: z.number().int().nullable(),
});

const linkedCommitSchema = z.object({
  commitId: z.string(),
  comment: z.string().nullable(),
  author: z.string().nullable(),
  authorDate: z.string().nullable(),
  committer: z.string().nullable(),
  commitDate: z.string().nullable(),
  repository: z.string().nullable(),
  repositoryId: z.string().nullable(),
  project: z.string().nullable(),
  pullRequestIds: z.array(z.number().int()),
  url: z.string().nullable(),
  changedFiles: z.array(z.lazy(() => pullRequestFileChangeSchema)).optional(),
  raw: z.unknown().optional(),
});

const pullRequestFileChangeSchema = z.object({
  path: z.string().nullable(),
  originalPath: z.string().nullable(),
  changeType: z.string().nullable(),
  itemType: z.string().nullable(),
  objectId: z.string().nullable(),
  additions: z.number().int().nullable(),
  deletions: z.number().int().nullable(),
  patch: z.string().nullable().optional(),
  raw: z.unknown().optional(),
});

const commitFullSchema = z.object({
  commitId: z.string(),
  comment: z.string().nullable(),
  author: z.string().nullable(),
  authorDate: z.string().nullable(),
  committer: z.string().nullable(),
  commitDate: z.string().nullable(),
  url: z.string().nullable(),
  repository: pullRequestRepositoryContextSchema,
  changedFiles: z.array(pullRequestFileChangeSchema),
  stats: gitCommitStatsSchema.nullable(),
  raw: z.unknown().optional(),
});

const workItemSchema = z.object({
  id: z.number().int(),
  project: z.string().nullable(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  workItemType: z.string().nullable(),
  assignedTo: z.string().nullable(),
  createdBy: z.string().nullable(),
  changedBy: z.string().nullable(),
  createdDate: z.string().nullable(),
  changedDate: z.string().nullable(),
  closedDate: z.string().nullable(),
  areaPath: z.string().nullable(),
  iterationPath: z.string().nullable(),
  tags: z.string().nullable(),
  reason: z.string().nullable(),
  priority: z.number().nullable(),
  severity: z.string().nullable(),
  commentCount: z.number().int().nullable(),
  activityDate: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string().nullable(),
});

const workItemRelationSchema = z.object({
  rel: z.string().nullable(),
  url: z.string().nullable(),
  linkedWorkItemId: z.number().int().nullable(),
  attributes: z.record(z.string(), z.unknown()),
});

const workItemCommentSchema = z.object({
  id: z.number().int().nullable(),
  commentId: z.number().int().nullable(),
  workItemId: z.number().int().nullable(),
  text: z.string().nullable(),
  renderedText: z.string().nullable(),
  format: z.string().nullable(),
  createdBy: z.string().nullable(),
  modifiedBy: z.string().nullable(),
  createdDate: z.string().nullable(),
  modifiedDate: z.string().nullable(),
  isDeleted: z.boolean(),
  version: z.number().int().nullable(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const workItemUpdateSchema = z.object({
  id: z.number().int().nullable(),
  updateId: z.number().int().nullable(),
  workItemId: z.number().int().nullable(),
  rev: z.number().int().nullable(),
  revisedBy: z.string().nullable(),
  revisedDate: z.string().nullable(),
  changedFields: z.array(z.string()),
  fields: z.record(z.string(), z.unknown()),
  relations: z.record(z.string(), z.array(workItemRelationSchema)),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const workItemRevisionSchema = z.object({
  id: z.number().int().nullable(),
  workItemId: z.number().int().nullable(),
  rev: z.number().int().nullable(),
  changedBy: z.string().nullable(),
  changedDate: z.string().nullable(),
  createdDate: z.string().nullable(),
  state: z.string().nullable(),
  title: z.string().nullable(),
  workItemType: z.string().nullable(),
  fields: z.record(z.string(), z.unknown()),
  relations: z.array(workItemRelationSchema),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const workItemAttachmentSchema = z.object({
  id: z.string().nullable(),
  rel: z.string().nullable(),
  url: z.string().nullable(),
  name: z.string().nullable(),
  authorizedDate: z.string().nullable(),
  resourceSize: z.number().nullable(),
  comment: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
});

const workItemFullSchema = workItemSchema.extend({
  rev: z.number().int().nullable(),
  fields: z.record(z.string(), z.unknown()),
  relations: z.array(workItemRelationSchema).optional(),
  links: z.record(z.string(), z.string().nullable()).optional(),
  _links: z.record(z.string(), z.unknown()).optional(),
  commentVersionRef: z.record(z.string(), z.unknown()).nullable().optional(),
  comments: z.array(workItemCommentSchema).optional(),
  updates: z.array(workItemUpdateSchema).optional(),
  revisions: z.array(workItemRevisionSchema).optional(),
  attachments: z.array(workItemAttachmentSchema).optional(),
  raw: z.unknown().optional(),
});

const workItemExpandSchema = z.enum(["none", "fields", "relations", "links", "all"]);
const workItemAuditPagingSchema = z.object({
  strategy: z.enum(["none", "continuation", "skip"]),
  pageSize: z.number().int().positive(),
  pagesFetched: z.number().int().nonnegative(),
});

const workItemCommentsListSchema = z.object({
  workItemId: z.number().int().positive(),
  project: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  paging: workItemAuditPagingSchema,
  comments: z.array(workItemCommentSchema),
});

const workItemUpdatesListSchema = z.object({
  workItemId: z.number().int().positive(),
  project: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  paging: workItemAuditPagingSchema,
  updates: z.array(workItemUpdateSchema),
});

const workItemRevisionsListSchema = z.object({
  workItemId: z.number().int().positive(),
  project: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  paging: workItemAuditPagingSchema,
  revisions: z.array(workItemRevisionSchema),
});

const workItemSearchOrderFieldSchema = z.enum([
  "id",
  "title",
  "state",
  "workItemType",
  "assignedTo",
  "createdDate",
  "changedDate",
  "closedDate",
  "resolvedDate",
  "priority",
  "severity",
  "areaPath",
  "iterationPath",
]);

const workItemSearchOrderBySchema = z.object({
  field: workItemSearchOrderFieldSchema,
  direction: z.enum(["asc", "desc"]).default("desc"),
});

const advancedWorkItemQuerySchema = z.object({
  project: z.string(),
  workItemTypes: z.array(z.string()),
  categoryReferenceNames: z.array(z.string()),
  categoryNames: z.array(z.string()),
  resolvedWorkItemTypes: z.array(z.string()),
  states: z.array(z.string()),
  assignedTo: z.string().nullable(),
  createdBy: z.string().nullable(),
  changedBy: z.string().nullable(),
  tagsAny: z.array(z.string()),
  tagsAll: z.array(z.string()),
  areaPaths: z.array(z.string()),
  iterationPaths: z.array(z.string()),
  text: z.string().nullable(),
  ids: z.array(z.number().int()),
  priority: z.array(z.number().int()),
  severity: z.array(z.string()),
  reason: z.array(z.string()),
  createdDateFrom: z.string().nullable(),
  createdDateTo: z.string().nullable(),
  changedDateFrom: z.string().nullable(),
  changedDateTo: z.string().nullable(),
  closedDateFrom: z.string().nullable(),
  closedDateTo: z.string().nullable(),
  resolvedDateFrom: z.string().nullable(),
  resolvedDateTo: z.string().nullable(),
  top: z.number().int().positive(),
  orderBy: z.array(workItemSearchOrderBySchema),
});

const workItemAuditInputSchema = z.object({
  id: z.number().int().positive().describe("Azure DevOps work item ID."),
  project: trimmedStringSchema
    .optional()
    .describe("Optional Azure DevOps project name or ID used for allowlist and mismatch validation."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Optional internal page size for paging through history endpoints."),
  includeRaw: z
    .boolean()
    .optional()
    .describe("When true, include the raw Azure DevOps payload on each returned history item."),
});

const exportWorkItemsFullSchema = z.object({
  query: advancedWorkItemQuerySchema,
  totalMatched: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  workItems: z.array(workItemFullSchema),
});

const exportWorkItemsFullInputSchema = z.object({
  project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
  workItemTypes: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional work item type filters such as Bug, Incident, or Issue."),
  categoryReferenceNames: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional work item category reference names such as Microsoft.BugCategory."),
  categoryNames: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional work item category display names such as Bug Category."),
  states: z.array(trimmedStringSchema).optional().describe("Optional work item state filters."),
  assignedTo: trimmedStringSchema.optional().describe("Optional assignee filter."),
  createdBy: trimmedStringSchema.optional().describe("Optional creator filter."),
  changedBy: trimmedStringSchema.optional().describe("Optional last changed by filter."),
  tags: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional tag filters using any-match semantics."),
  tagsAny: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional tag filters where any supplied tag may match."),
  tagsAll: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional tag filters where every supplied tag must match."),
  areaPaths: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional area path filters. Matches descendant paths using WIQL UNDER."),
  iterationPaths: z
    .array(trimmedStringSchema)
    .optional()
    .describe("Optional iteration path filters. Matches descendant paths using WIQL UNDER."),
  text: trimmedStringSchema
    .optional()
    .describe("Optional free-text filter applied to title and description."),
  ids: z
    .array(z.number().int().positive())
    .optional()
    .describe("Optional explicit work item IDs to constrain the query."),
  priority: z.array(z.number().int()).optional().describe("Optional priority filters."),
  severity: z.array(trimmedStringSchema).optional().describe("Optional severity filters."),
  reason: z.array(trimmedStringSchema).optional().describe("Optional reason filters."),
  createdDateFrom: isoDateInputSchema.optional().describe("Optional lower bound for System.CreatedDate."),
  createdDateTo: isoDateInputSchema.optional().describe("Optional upper bound for System.CreatedDate."),
  changedDateFrom: isoDateInputSchema.optional().describe("Optional lower bound for System.ChangedDate."),
  changedDateTo: isoDateInputSchema.optional().describe("Optional upper bound for System.ChangedDate."),
  closedDateFrom: isoDateInputSchema.optional().describe("Optional lower bound for ClosedDate."),
  closedDateTo: isoDateInputSchema.optional().describe("Optional upper bound for ClosedDate."),
  resolvedDateFrom: isoDateInputSchema.optional().describe("Optional lower bound for ResolvedDate."),
  resolvedDateTo: isoDateInputSchema.optional().describe("Optional upper bound for ResolvedDate."),
  orderBy: z
    .array(workItemSearchOrderBySchema)
    .optional()
    .describe("Optional sort order definitions. Defaults to changedDate desc."),
  top: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Optional alias for maxItems when reusing search_work_items_advanced style inputs."),
  maxItems: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Maximum number of work items to export in one call."),
  expand: workItemExpandSchema
    .optional()
    .describe("Optional Azure DevOps base expansion mode. Include flags may widen it."),
  includeRelations: z.boolean().optional().describe("When true, include normalized work item relations."),
  includeLinks: z.boolean().optional().describe("When true, include normalized _links and links maps."),
  includeComments: z.boolean().optional().describe("When true, include work item comments."),
  includeUpdates: z.boolean().optional().describe("When true, include work item updates."),
  includeRevisions: z.boolean().optional().describe("When true, include work item revisions."),
  includeAttachments: z
    .boolean()
    .optional()
    .describe("When true, include attached file relations as normalized attachments."),
  includeRaw: z
    .boolean()
    .optional()
    .describe("When true, include raw Azure DevOps payloads on exported items and nested history sections."),
});

const traceabilityRelationDirectionSchema = z.enum([
  "forward",
  "reverse",
  "bidirectional",
  "unknown",
]);

const workItemLinkTypeSchema = z.object({
  referenceName: z.string(),
  name: z.string(),
  oppositeReferenceName: z.string().nullable(),
  topology: z.string().nullable(),
  category: z.string(),
  direction: traceabilityRelationDirectionSchema,
  enabled: z.boolean(),
  editable: z.boolean(),
  acyclic: z.boolean(),
  directional: z.boolean(),
  singleTarget: z.boolean(),
  usage: z.string().nullable(),
  url: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
});

const traceabilityGraphNodeSchema = workItemSchema.extend({
  depth: z.number().int().nonnegative(),
  isRoot: z.boolean(),
});

const traceabilityGraphEdgeSchema = z.object({
  sourceId: z.number().int(),
  targetId: z.number().int(),
  sourceProject: z.string().nullable(),
  targetProject: z.string().nullable(),
  referenceName: z.string(),
  name: z.string().nullable(),
  oppositeReferenceName: z.string().nullable(),
  topology: z.string().nullable(),
  category: z.string(),
  direction: traceabilityRelationDirectionSchema,
  isCrossProject: z.boolean(),
  attributes: z.record(z.string(), z.unknown()),
});

const traceabilitySkippedRelationSchema = z.object({
  sourceId: z.number().int(),
  sourceProject: z.string().nullable(),
  referenceName: z.string().nullable(),
  targetId: z.number().int().nullable(),
  reason: z.enum(["filtered_out", "non_work_item_relation", "not_allowed", "not_found"]),
});

const traceabilityTraversalSchema = z.object({
  visitedNodeCount: z.number().int().nonnegative(),
  exploredEdgeCount: z.number().int().nonnegative(),
  skippedRelationCount: z.number().int().nonnegative(),
  truncatedAtDepth: z.boolean(),
});

const workItemRelationsGraphSchema = z.object({
  rootId: z.number().int(),
  rootProject: z.string().nullable(),
  maxDepth: z.number().int().nonnegative(),
  relationTypeFilter: z.array(z.string()),
  nodes: z.array(traceabilityGraphNodeSchema),
  edges: z.array(traceabilityGraphEdgeSchema),
  skippedRelations: z.array(traceabilitySkippedRelationSchema),
  relationTypesEncountered: z.array(z.string()),
  crossProjectNodeCount: z.number().int().nonnegative(),
  crossProjectEdgeCount: z.number().int().nonnegative(),
  traversal: traceabilityTraversalSchema,
});

const traceabilityChainStepSchema = z.object({
  fromId: z.number().int(),
  toId: z.number().int(),
  referenceName: z.string(),
  category: z.string(),
  direction: traceabilityRelationDirectionSchema,
});

const traceabilityChainSchema = z.object({
  chainId: z.string(),
  nodeIds: z.array(z.number().int()),
  steps: z.array(traceabilityChainStepSchema),
  terminalNodeId: z.number().int(),
  terminalNodeProject: z.string().nullable(),
  terminalWorkItemType: z.string().nullable(),
  containsCrossProjectItems: z.boolean(),
  cycleDetected: z.boolean(),
  endsAtMaxDepth: z.boolean(),
});

const traceabilityChainSummarySchema = workItemRelationsGraphSchema.extend({
  chains: z.array(traceabilityChainSchema),
  totalChains: z.number().int().nonnegative(),
});

const linkedWorkItemSummarySchema = traceabilityGraphNodeSchema.extend({
  isCrossProject: z.boolean(),
  pathCount: z.number().int().nonnegative(),
  relationTypes: z.array(z.string()),
  relationCategories: z.array(z.string()),
  incomingRelations: z.array(traceabilityGraphEdgeSchema),
  outgoingRelations: z.array(traceabilityGraphEdgeSchema),
  pathsFromRoot: z.array(traceabilityChainSchema),
});

const linkedWorkItemsSummarySchema = z.object({
  rootId: z.number().int(),
  rootProject: z.string().nullable(),
  root: traceabilityGraphNodeSchema,
  maxDepth: z.number().int().nonnegative(),
  relationTypeFilter: z.array(z.string()),
  linkedWorkItems: z.array(linkedWorkItemSummarySchema),
  totalLinkedWorkItems: z.number().int().nonnegative(),
  edges: z.array(traceabilityGraphEdgeSchema),
  skippedRelations: z.array(traceabilitySkippedRelationSchema),
  relationTypesEncountered: z.array(z.string()),
  crossProjectNodeCount: z.number().int().nonnegative(),
  crossProjectEdgeCount: z.number().int().nonnegative(),
  traversal: traceabilityTraversalSchema,
});

const workItemTestLinkSuiteSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  planId: z.number().int().nullable(),
  planName: z.string().nullable(),
  project: z.string().nullable(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const workItemTestLinkPlanSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable(),
  project: z.string().nullable(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

const workItemTestLinkRecentRunSchema = z.lazy(() =>
  testRunSchema.extend({
    project: z.string(),
    pointIds: z.array(z.number().int().positive()),
    suiteIds: z.array(z.number().int().positive()),
    planIds: z.array(z.number().int().positive()),
    url: z.string().nullable(),
    raw: z.unknown().optional(),
  }),
);

const workItemTestLinkSchema = z.object({
  relationType: z.string(),
  relationName: z.string().nullable(),
  relationCategory: z.string(),
  relationDirection: traceabilityRelationDirectionSchema,
  testCaseId: z.number().int().positive(),
  testCaseTitle: z.string().nullable(),
  testCaseState: z.string().nullable(),
  testCaseProject: z.string().nullable(),
  isCrossProject: z.boolean(),
  suiteIds: z.array(z.number().int().positive()),
  planIds: z.array(z.number().int().positive()),
  recentRuns: z.array(workItemTestLinkRecentRunSchema),
  testCase: workItemSchema.optional(),
  suites: z.array(workItemTestLinkSuiteSchema).optional(),
  plans: z.array(workItemTestLinkPlanSchema).optional(),
  raw: z.unknown().optional(),
});

const workItemTestLinksSummarySchema = z.object({
  project: z.string(),
  workItemId: z.number().int().positive(),
  workItem: workItemSchema,
  testLinks: z.array(workItemTestLinkSchema),
  totalTestLinks: z.number().int().nonnegative(),
  totalTestCases: z.number().int().nonnegative(),
  totalSuites: z.number().int().nonnegative(),
  totalPlans: z.number().int().nonnegative(),
  totalRecentRuns: z.number().int().nonnegative(),
  relationTypesEncountered: z.array(z.string()),
  skippedRelations: z.array(traceabilitySkippedRelationSchema),
});

const coverageOutcomeSchema = z.enum(["passed", "failed", "not_executed", "unknown"]);
const userStoryCoverageStatusSchema = z.enum([
  "no_tests",
  "passed",
  "failed",
  "not_executed",
  "unknown",
  "partial",
]);

const userStoryCoverageSummarySchema = z.object({
  totalLinkedTestCases: z.number().int().nonnegative(),
  withSuites: z.number().int().nonnegative(),
  withPlans: z.number().int().nonnegative(),
  withRecentRuns: z.number().int().nonnegative(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  notExecutedCount: z.number().int().nonnegative(),
  unknownCount: z.number().int().nonnegative(),
});

const userStoryLinkedTestCaseCoverageSchema = z.object({
  testCaseId: z.number().int().positive(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  relationType: z.string(),
  suiteIds: z.array(z.number().int().positive()),
  planIds: z.array(z.number().int().positive()),
  recentRuns: z.array(workItemTestLinkRecentRunSchema),
  latestOutcome: coverageOutcomeSchema,
  raw: z.unknown().optional(),
});

const userStorySuiteCoverageSchema = z.object({
  suiteId: z.number().int().positive(),
  suiteName: z.string().nullable(),
  planId: z.number().int().nullable(),
  planName: z.string().nullable(),
  project: z.string().nullable(),
  linkedTestCaseIds: z.array(z.number().int().positive()),
  recentRunIds: z.array(z.number().int().positive()),
  summary: userStoryCoverageSummarySchema,
  coverageStatus: userStoryCoverageStatusSchema,
});

const userStoryPlanCoverageSchema = z.object({
  planId: z.number().int().positive(),
  planName: z.string().nullable(),
  project: z.string().nullable(),
  linkedTestCaseIds: z.array(z.number().int().positive()),
  recentRunIds: z.array(z.number().int().positive()),
  summary: userStoryCoverageSummarySchema,
  coverageStatus: userStoryCoverageStatusSchema,
});

const userStoryRecentRunCoverageSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  state: z.string().nullable(),
  totalTests: z.number().int().nullable(),
  passedTests: z.number().int().nullable(),
  failedTests: z.number().int().nullable(),
  startedDate: z.string().nullable(),
  completedDate: z.string().nullable(),
  project: z.string(),
  pointIds: z.array(z.number().int().positive()),
  suiteIds: z.array(z.number().int().positive()),
  planIds: z.array(z.number().int().positive()),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
  linkedTestCaseIds: z.array(z.number().int().positive()),
  summary: userStoryCoverageSummarySchema,
  coverageStatus: userStoryCoverageStatusSchema,
});

const userStoryTestCoverageSchema = z.object({
  project: z.string(),
  workItemId: z.number().int().positive(),
  workItem: workItemSchema,
  summary: userStoryCoverageSummarySchema,
  linkedTestCases: z.array(userStoryLinkedTestCaseCoverageSchema),
  suiteCoverage: z.array(userStorySuiteCoverageSchema),
  planCoverage: z.array(userStoryPlanCoverageSchema),
  recentRuns: z.array(userStoryRecentRunCoverageSchema),
  coverageStatus: userStoryCoverageStatusSchema,
  raw: z.unknown().optional(),
});

const requirementTraceabilityStatusSchema = z.enum([
  "complete",
  "partial",
  "missing_tests",
  "missing_execution",
  "at_risk",
]);

const requirementTraceabilityGapsSchema = z.object({
  hasNoLinkedTestCases: z.boolean(),
  hasTestCaseWithoutSuite: z.boolean(),
  hasTestCaseWithoutPlan: z.boolean(),
  hasTestCaseWithoutRecentRun: z.boolean(),
  hasFailedTests: z.boolean(),
  hasUnknownOutcomes: z.boolean(),
  missingSuiteTestCaseIds: z.array(z.number().int().positive()),
  missingPlanTestCaseIds: z.array(z.number().int().positive()),
  missingRecentRunTestCaseIds: z.array(z.number().int().positive()),
  failedTestCaseIds: z.array(z.number().int().positive()),
  unknownOutcomeTestCaseIds: z.array(z.number().int().positive()),
});

const requirementTraceabilityReportSchema = z.object({
  project: z.string(),
  workItemId: z.number().int().positive(),
  workItem: workItemSchema,
  summary: userStoryCoverageSummarySchema,
  linkedTestCases: z.array(userStoryLinkedTestCaseCoverageSchema),
  suiteCoverage: z.array(userStorySuiteCoverageSchema),
  planCoverage: z.array(userStoryPlanCoverageSchema),
  recentRuns: z.array(userStoryRecentRunCoverageSchema),
  coverageStatus: userStoryCoverageStatusSchema,
  gaps: requirementTraceabilityGapsSchema,
  traceabilityStatus: requirementTraceabilityStatusSchema,
  raw: z.unknown().optional(),
});

const workItemTypeReferenceSchema = z.object({
  name: z.string(),
  url: z.string().nullable(),
});

const workItemCategorySchema = z.object({
  name: z.string(),
  referenceName: z.string().nullable(),
  defaultWorkItemType: workItemTypeReferenceSchema.nullable(),
  workItemTypes: z.array(workItemTypeReferenceSchema),
  url: z.string().nullable(),
});

const workItemTypeIconSchema = z.object({
  id: z.string().nullable(),
  url: z.string().nullable(),
});

const workItemTypeStateSchema = z.object({
  name: z.string(),
  color: z.string().nullable(),
  category: z.string().nullable(),
});

const workItemTypeFieldSchema = z.object({
  name: z.string(),
  referenceName: z.string().nullable(),
  alwaysRequired: z.boolean(),
  url: z.string().nullable(),
});

const workItemTypeSchema = z.object({
  name: z.string(),
  referenceName: z.string().nullable(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  icon: workItemTypeIconSchema.nullable(),
  isDisabled: z.boolean(),
  states: z.array(workItemTypeStateSchema),
  fields: z.array(workItemTypeFieldSchema),
  url: z.string().nullable(),
  categoryReferenceName: z.string().nullable(),
  categoryName: z.string().nullable(),
  raw: z.unknown().optional(),
});

const workItemFieldSupportedOperationSchema = z.object({
  name: z.string(),
  referenceName: z.string().nullable(),
});

type WorkItemFieldSchema = z.ZodType<WorkItemFieldSummary>;
const workItemFieldSchema: WorkItemFieldSchema = z.object({
  name: z.string(),
  referenceName: z.string(),
  type: z.string().nullable(),
  readOnly: z.boolean(),
  isIdentity: z.boolean(),
  isPicklist: z.boolean(),
  supportedOperations: z.array(workItemFieldSupportedOperationSchema),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

type AreaPathNodeSchema = z.ZodType<AreaPathNodeSummary>;
const areaPathNodeSchema: AreaPathNodeSchema = z.lazy(() =>
  z.object({
    path: z.string(),
    name: z.string(),
    hasChildren: z.boolean(),
    children: z.array(areaPathNodeSchema),
    raw: z.unknown().optional(),
  }),
);

type IterationPathNodeSchema = z.ZodType<IterationPathNodeSummary>;
const iterationPathNodeSchema: IterationPathNodeSchema = z.lazy(() =>
  z.object({
    path: z.string(),
    name: z.string(),
    startDate: z.string().nullable(),
    finishDate: z.string().nullable(),
    hasChildren: z.boolean(),
    children: z.array(iterationPathNodeSchema),
    raw: z.unknown().optional(),
  }),
);

type WorkItemTagSchema = z.ZodType<WorkItemTagSummary>;
const workItemTagSchema: WorkItemTagSchema = z.object({
  name: z.string(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

type ResolvedIdentitySchema = z.ZodType<ResolvedIdentitySummary>;
const resolvedIdentitySchema: ResolvedIdentitySchema = z.object({
  displayName: z.string().nullable(),
  uniqueName: z.string().nullable(),
  descriptor: z.string().nullable(),
  id: z.string().nullable(),
  url: z.string().nullable(),
  raw: z.unknown().optional(),
});

type SavedQuerySchema = z.ZodType<SavedQuerySummary>;
const savedQuerySchema: SavedQuerySchema = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    isFolder: z.boolean(),
    hasChildren: z.boolean(),
    queryType: z.string().nullable(),
    wiql: z.string().nullable().optional(),
    url: z.string().nullable(),
    children: z.array(savedQuerySchema),
    raw: z.unknown().optional(),
  }),
);

const workItemsDeltaExportSchema = z.object({
  project: z.string(),
  changedSince: z.string(),
  total: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  workItemIds: z.array(z.number().int().positive()),
  workItems: z.array(workItemFullSchema).optional(),
  updatesByWorkItemId: z.record(z.string(), z.array(workItemUpdateSchema)).optional(),
  revisionsByWorkItemId: z.record(z.string(), z.array(workItemRevisionSchema)).optional(),
  raw: z.unknown().optional(),
});

const traceabilityDatasetScopeSchema = z.object({
  source: z.enum(["search", "saved_query"]),
  totalMatched: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  maxItems: z.number().int().positive(),
  searchQuery: z.unknown().optional(),
  savedQuery: savedQuerySchema.optional(),
});

const traceabilityDatasetExportSchema = z.object({
  project: z.string(),
  scope: traceabilityDatasetScopeSchema,
  workItemIds: z.array(z.number().int().positive()),
  workItems: z.array(workItemFullSchema).optional(),
  testLinksByWorkItemId: z.record(z.string(), z.lazy(() => workItemTestLinksSummarySchema)).optional(),
  coverageByWorkItemId: z.record(z.string(), z.lazy(() => requirementTraceabilityReportSchema)).optional(),
  pullRequestsByWorkItemId: z.record(z.string(), z.array(linkedPullRequestSchema)).optional(),
  commitsByWorkItemId: z.record(z.string(), z.array(linkedCommitSchema)).optional(),
  raw: z.unknown().optional(),
});

const similarityReasonSchema = z.object({
  kind: z.enum([
    "title",
    "description",
    "tags",
    "areaPath",
    "iterationPath",
    "workItemType",
    "assignedTo",
    "createdBy",
    "customField",
    "linkedArtifact",
  ] satisfies readonly SimilarityReasonSummary["kind"][]),
  score: z.number().min(0).max(1),
  description: z.string(),
});

const similarWorkItemCandidateSchema = z.object({
  candidateId: z.number().int().positive(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  project: z.string().nullable(),
  workItemType: z.string().nullable(),
  url: z.string().nullable(),
  similarityScore: z.number().min(0).max(1),
  reasons: z.array(similarityReasonSchema),
  raw: z.unknown().optional(),
});

const similarWorkItemsResultSchema = z.object({
  project: z.string(),
  workItemId: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  candidates: z.array(similarWorkItemCandidateSchema),
});

const duplicateCandidateSchema = z.object({
  sourceWorkItemId: z.number().int().positive(),
  candidateId: z.number().int().positive(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  project: z.string().nullable(),
  workItemType: z.string().nullable(),
  url: z.string().nullable(),
  duplicateScore: z.number().min(0).max(1),
  reasons: z.array(similarityReasonSchema),
  signals: z.record(z.string(), z.unknown()),
  raw: z.unknown().optional(),
});

const duplicateCandidatesResultSchema = z.object({
  project: z.string(),
  sourceWorkItemId: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  candidates: z.array(duplicateCandidateSchema),
});

const similarityClusterSchema = z.object({
  clusterId: z.string(),
  memberIds: z.array(z.number().int().positive()),
  summary: z.string(),
  commonSignals: z.array(z.string()),
  raw: z.unknown().optional(),
});

const similarityClustersResultSchema = z.object({
  project: z.string(),
  totalClusters: z.number().int().nonnegative(),
  clusters: z.array(similarityClusterSchema),
});

const testPlanSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  state: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  iteration: z.string().nullable(),
  areaPath: z.string().nullable(),
});

const testSuiteSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  suiteType: z.string().nullable(),
  parentSuiteId: z.number().int().nullable(),
  testCaseCount: z.number().int().nullable(),
});

const testPointAssignmentSchema = z.object({
  tester: z.string().nullable(),
  configuration: z.string().nullable(),
});

const testCaseSchema = z.object({
  workItemId: z.number().int(),
  workItemName: z.string().nullable(),
  pointAssignments: z.array(testPointAssignmentSchema),
});

const testCaseStepSchema = z.object({
  index: z.number().int(),
  kind: z.enum(["action", "sharedStep"]),
  actionText: z.string().nullable(),
  expectedResult: z.string().nullable(),
  sharedStepId: z.number().int().nullable(),
  sharedStepTitle: z.string().nullable(),
});

const testCaseParameterDefinitionSchema = z.object({
  name: z.string(),
  bind: z.string().nullable(),
});

const testCaseParametersSchema = z.object({
  definitions: z.array(testCaseParameterDefinitionSchema),
  rows: z.array(z.record(z.string(), z.string().nullable())),
});

const testCaseSharedStepSchema = z.object({
  workItemId: z.number().int(),
  title: z.string().nullable(),
  url: z.string().nullable(),
});

const testRunSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  state: z.string().nullable(),
  totalTests: z.number().int().nullable(),
  passedTests: z.number().int().nullable(),
  failedTests: z.number().int().nullable(),
  startedDate: z.string().nullable(),
  completedDate: z.string().nullable(),
});

const testManagementPagingSchema = z.object({
  strategy: z.enum(["none", "continuation", "skip"]),
  pageSize: z.number().int().positive(),
  pagesFetched: z.number().int().nonnegative(),
});

const testEntityReferenceSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable(),
  url: z.string().nullable(),
});

const testConfigurationSchema = testEntityReferenceSchema.extend({
  isDefault: z.boolean(),
  state: z.string().nullable(),
});

const testPlanFullSchema = testPlanSchema.extend({
  rootSuiteId: z.number().int().nullable(),
  owner: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdDate: z.string().nullable(),
  updatedBy: z.string().nullable(),
  updatedDate: z.string().nullable(),
  revision: z.number().int().nullable(),
  url: z.string().nullable(),
  _links: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown().optional(),
});

const testSuiteChildSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  suiteType: z.string().nullable(),
  testCaseCount: z.number().int().nullable(),
  url: z.string().nullable(),
});

const testSuiteTreeNodeSchema: z.ZodType<TestSuiteTreeNode> = z.lazy(() =>
  z.object({
    id: z.number().int(),
    name: z.string(),
    planId: z.number().int(),
    parentSuiteId: z.number().int().nullable(),
    suiteType: z.string().nullable(),
    testCaseCount: z.number().int().nullable(),
    requirementId: z.number().int().nullable(),
    queryString: z.string().nullable(),
    inheritDefaultConfigurations: z.boolean(),
    defaultConfigurations: z.array(testConfigurationSchema),
    state: z.string().nullable(),
    url: z.string().nullable(),
    children: z.array(testSuiteTreeNodeSchema),
    raw: z.unknown().optional(),
  }),
);

const testPlanSuitesTreeSchema = z.object({
  project: z.string(),
  planId: z.number().int(),
  rootSuiteId: z.number().int().nullable(),
  totalSuites: z.number().int().nonnegative(),
  suiteTree: z.array(testSuiteTreeNodeSchema),
});

const testSuiteFullSchema = testSuiteSchema.extend({
  planId: z.number().int(),
  planName: z.string().nullable(),
  requirementId: z.number().int().nullable(),
  queryString: z.string().nullable(),
  inheritDefaultConfigurations: z.boolean(),
  defaultConfigurations: z.array(testConfigurationSchema),
  state: z.string().nullable(),
  parent: testSuiteChildSchema.nullable(),
  children: z.array(testSuiteChildSchema),
  configurationCount: z.number().int().nullable(),
  url: z.string().nullable(),
  _links: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown().optional(),
});

const testPointSchema = z.object({
  pointId: z.number().int(),
  title: z.string().nullable(),
  outcome: z.string().nullable(),
  order: z.number().int().nullable(),
  state: z.string().nullable(),
  isActive: z.boolean(),
  lastUpdatedDate: z.string().nullable(),
  testCaseId: z.number().int().nullable(),
  testCaseTitle: z.string().nullable(),
  testSuiteId: z.number().int().nullable(),
  testSuiteTitle: z.string().nullable(),
  configuration: z.string().nullable(),
  configurationId: z.number().int().nullable(),
  tester: z.string().nullable(),
  lastRunId: z.number().int().nullable(),
  lastResultId: z.number().int().nullable(),
  runBy: z.string().nullable(),
  timeCompleted: z.string().nullable(),
  failureType: z.string().nullable(),
  resolutionState: z.string().nullable(),
  workItemProperties: z.record(z.string(), z.unknown()),
  testCase: z.record(z.string(), z.unknown()).nullable(),
  url: z.string().nullable(),
  _links: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown().optional(),
});

const testPointsListSchema = z.object({
  project: z.string(),
  planId: z.number().int(),
  suiteId: z.number().int(),
  totalCount: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  paging: testManagementPagingSchema,
  points: z.array(testPointSchema),
});

const testCaseFullSchema = z.object({
  workItemId: z.number().int(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  priority: z.number().int().nullable(),
  assignedTo: z.string().nullable(),
  automationStatus: z.string().nullable(),
  areaPath: z.string().nullable(),
  iterationPath: z.string().nullable(),
  steps: z.array(testCaseStepSchema),
  parameters: testCaseParametersSchema.nullable(),
  sharedSteps: z.array(testCaseSharedStepSchema),
  points: z.array(testPointSchema),
  raw: z.unknown().optional(),
});

const testCasesFullListSchema = z.object({
  project: z.string(),
  planId: z.number().int(),
  suiteId: z.number().int(),
  totalCount: z.number().int().nonnegative(),
  testCases: z.array(testCaseFullSchema),
});

const testPointHistoryEntrySchema = z.object({
  resultId: z.number().int().nullable(),
  testRunId: z.number().int().nullable(),
  outcome: z.string().nullable(),
  state: z.string().nullable(),
  comment: z.string().nullable(),
  runBy: z.string().nullable(),
  timeCompleted: z.string().nullable(),
  durationInMs: z.number().int().nullable(),
  lastUpdatedDate: z.string().nullable(),
  testCase: testEntityReferenceSchema.nullable(),
  testSuite: testEntityReferenceSchema.nullable(),
  configuration: testConfigurationSchema.nullable(),
  _links: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown().optional(),
});

const testPointHistorySchema = z.object({
  project: z.string(),
  planId: z.number().int(),
  suiteId: z.number().int(),
  pointId: z.number().int(),
  currentTester: z.string().nullable(),
  testCaseId: z.number().int().nullable(),
  testCaseTitle: z.string().nullable(),
  testSuiteId: z.number().int().nullable(),
  testSuiteTitle: z.string().nullable(),
  configurationId: z.number().int().nullable(),
  configurationName: z.string().nullable(),
  totalHistoryEntries: z.number().int().nonnegative(),
  paging: testManagementPagingSchema,
  history: z.array(testPointHistoryEntrySchema),
});

const testAttachmentSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable(),
  comment: z.string().nullable(),
  url: z.string().nullable(),
  attachmentType: z.string().nullable(),
  size: z.number().int().nullable(),
  raw: z.unknown().optional(),
});

const testRunResultStepSchema = z.object({
  actionPath: z.string().nullable(),
  actionText: z.string().nullable(),
  expectedResult: z.string().nullable(),
  outcome: z.string().nullable(),
  comment: z.string().nullable(),
  durationInMs: z.number().int().nullable(),
  attachments: z.array(testAttachmentSchema),
  raw: z.unknown().optional(),
});

const testRunResultSchema = z.object({
  id: z.number().int(),
  outcome: z.string().nullable(),
  state: z.string().nullable(),
  priority: z.number().int().nullable(),
  startedDate: z.string().nullable(),
  completedDate: z.string().nullable(),
  durationInMs: z.number().int().nullable(),
  runBy: z.string().nullable(),
  errorMessage: z.string().nullable(),
  stackTrace: z.string().nullable(),
  comment: z.string().nullable(),
  testCase: testEntityReferenceSchema.nullable(),
  testSuite: testEntityReferenceSchema.nullable(),
  testPlan: testEntityReferenceSchema.nullable(),
  configuration: testConfigurationSchema.nullable(),
  linkedWorkItemIds: z.array(z.number().int()),
  attachments: z.array(testAttachmentSchema),
  steps: z.array(testRunResultStepSchema),
  url: z.string().nullable(),
  _links: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown().optional(),
});

const testRunFullSchema = testRunSchema.extend({
  runId: z.number().int(),
  outcome: z.string().nullable(),
  result: z.string().nullable(),
  runBy: z.string().nullable(),
  createdDate: z.string().nullable(),
  durationInMs: z.number().int().nullable(),
  comment: z.string().nullable(),
  analysisOwner: z.string().nullable(),
  analysisComment: z.string().nullable(),
  pipelineRunTested: z.string().nullable(),
  build: testEntityReferenceSchema.nullable(),
  testPlan: testEntityReferenceSchema.nullable(),
  attachments: z.array(testAttachmentSchema),
  linkedWorkItemIds: z.array(z.number().int()),
  results: z.array(testRunResultSchema),
  paging: testManagementPagingSchema,
  url: z.string().nullable(),
  _links: z.record(z.string(), z.unknown()).optional(),
  raw: z.unknown().optional(),
});

const exportTestPlanFullSchema = z.object({
  project: z.string(),
  planId: z.number().int(),
  plan: testPlanFullSchema,
  suiteTree: z.array(testSuiteTreeNodeSchema),
  suitesById: z.record(z.string(), testSuiteFullSchema),
  pointsBySuiteId: z.record(z.string(), z.array(testPointSchema)),
  pointHistoryByPointId: z.record(z.string(), testPointHistorySchema).optional(),
  runsById: z.record(z.string(), testRunFullSchema).optional(),
  testCasesById: z.record(z.string(), testCaseSchema).optional(),
});

const pipelineSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  path: z.string().nullable(),
  type: z.string().nullable(),
  queueStatus: z.string().nullable(),
});

const pipelineRunSchema = z.object({
  id: z.number().int(),
  buildNumber: z.string(),
  status: z.string().nullable(),
  result: z.string().nullable(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable(),
  definitionName: z.string().nullable(),
  requestedBy: z.string().nullable(),
});

const pipelineArtifactSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string(),
  resourceType: z.string().nullable(),
  downloadUrl: z.string().nullable(),
  source: z.string().nullable(),
});

const wikiPageSchema = z.object({
  path: z.string(),
  content: z.string(),
  gitItemPath: z.string().nullable(),
  isParentPage: z.boolean(),
  contentLength: z.number().int().nonnegative(),
  isTruncated: z.boolean(),
});

const dailyDigestWorkItemSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  priority: z.number().nullable(),
});

const dailyDigestPullRequestSchema = z.object({
  pullRequestId: z.number().int(),
  title: z.string(),
  repository: z.string().nullable(),
  createdBy: z.string().nullable(),
});

const dailyDigestFailedPipelineSchema = z.object({
  id: z.number().int(),
  buildNumber: z.string(),
  definition: z.object({
    name: z.string().nullable(),
  }),
  finishTime: z.string().nullable(),
});

const blockedItemSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  assignedTo: z.string().nullable(),
  tags: z.string().nullable(),
  daysSinceUpdate: z.number().int().nonnegative(),
});

const sprintAtRiskItemSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  assignedTo: z.string().nullable(),
  daysSinceUpdate: z.number().int().nonnegative(),
});

const sprintSummarySchema = z.object({
  sprint: z.object({
    name: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    daysRemaining: z.number().int().nonnegative(),
  }),
  totalItems: z.number().int().nonnegative(),
  byState: z.object({
    new: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    closed: z.number().int().nonnegative(),
  }),
  completionPercentage: z.number().min(0).max(100),
  atRiskItems: z.array(sprintAtRiskItemSchema),
});

const dateRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const sprintCapacityMemberSchema = z.object({
  displayName: z.string(),
  capacityPerDay: z.number(),
  daysOff: z.number().int().nonnegative(),
  availableHours: z.number().nonnegative(),
});

const sprintCapacitySchema = z.object({
  sprint: z.object({
    name: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
  }),
  totalAvailableHours: z.number().nonnegative(),
  members: z.array(sprintCapacityMemberSchema),
  teamDaysOff: z.array(dateRangeSchema),
});

const dependencyWorkItemSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable(),
  project: z.string().nullable(),
  state: z.string().nullable(),
  url: z.string().nullable(),
});

const crossProjectDependenciesSchema = z.object({
  workItem: z.object({
    id: z.number().int(),
    title: z.string().nullable(),
    project: z.string().nullable(),
    state: z.string().nullable(),
  }),
  blockedBy: z.array(dependencyWorkItemSchema),
  blocking: z.array(dependencyWorkItemSchema),
  crossProjectCount: z.number().int().nonnegative(),
});

const dashboardWidgetQueryResultSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  assignedTo: z.string().nullable(),
});

const dashboardWidgetDataSchema = z.object({
  widgetName: z.string(),
  widgetType: z.string(),
  queryId: z.string().optional(),
  queryResults: z.array(dashboardWidgetQueryResultSchema).optional(),
  rawSettings: z.record(z.string(), z.unknown()),
});

const pipelineFailedTaskSchema = z.object({
  name: z.string(),
  log: z.string(),
});

const pipelineFailureAnalysisSchema = z.object({
  buildNumber: z.string(),
  definition: z.string().nullable(),
  requestedBy: z.string().nullable(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable(),
  failedTasks: z.array(pipelineFailedTaskSchema),
  summary: z.string(),
});

const testFailureImpactLinkedWorkItemSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  project: z.string().nullable(),
});

const testFailureImpactFailedTestSchema = z.object({
  testName: z.string(),
  errorMessage: z.string(),
  linkedWorkItems: z.array(testFailureImpactLinkedWorkItemSchema),
});

const testFailureImpactSchema = z.object({
  testRun: z.object({
    id: z.number().int(),
    name: z.string(),
    totalTests: z.number().int().nullable(),
    failedTests: z.number().int().nullable(),
  }),
  failedTests: z.array(testFailureImpactFailedTestSchema),
  impactSummary: z.string(),
});

function summarizeCount(label: string, items: readonly unknown[]): string {
  return items.length === 1 ? `Found 1 ${label}.` : `Found ${items.length} ${label}s.`;
}

function listProjectsOutput(projects: readonly ProjectSummary[]) {
  return {
    total: projects.length,
    projects,
  };
}

function listRepositoriesOutput(project: string, repositories: readonly RepositorySummary[]) {
  return {
    project,
    total: repositories.length,
    repositories,
  };
}

function listPullRequestsOutput(
  project: string,
  repository: string,
  status: string,
  pullRequests: readonly PullRequestSummary[],
) {
  return {
    project,
    repository,
    status,
    total: pullRequests.length,
    pullRequests,
  };
}

function linkedWorkItemsOutput(
  project: string,
  repository: string,
  pullRequestId: number,
  workItems: readonly WorkItemSummary[],
) {
  return {
    project,
    repository,
    pullRequestId,
    total: workItems.length,
    workItems,
  };
}

function searchPullRequestsByWorkItemOutput(summary: PullRequestSearchResultsByWorkItem) {
  return {
    workItemId: summary.workItemId,
    project: summary.project,
    total: summary.total,
    pullRequests: summary.pullRequests,
  };
}

function getPullRequestFullOutput(summary: PullRequestFull) {
  return summary;
}

function listPullRequestCommitsOutput(summary: PullRequestCommitsList) {
  return {
    project: summary.project,
    repository: summary.repository,
    pullRequestId: summary.pullRequestId,
    total: summary.total,
    commits: summary.commits,
  };
}

function getPullRequestDiffOutput(summary: PullRequestDiff) {
  return {
    project: summary.project,
    repository: summary.repository,
    pullRequestId: summary.pullRequestId,
    iterationId: summary.iterationId,
    sourceCommitId: summary.sourceCommitId,
    targetCommitId: summary.targetCommitId,
    totalFiles: summary.totalFiles,
    files: summary.files,
    ...(summary.raw !== undefined ? { raw: summary.raw } : {}),
  };
}

function getCommitFullOutput(summary: CommitFull) {
  return summary;
}

function searchCommitsByWorkItemOutput(summary: CommitSearchResultsByWorkItem) {
  return {
    workItemId: summary.workItemId,
    project: summary.project,
    total: summary.total,
    commits: summary.commits,
  };
}

function listWorkItemCategoriesOutput(
  project: string,
  categories: readonly WorkItemCategorySummary[],
) {
  return {
    project,
    total: categories.length,
    categories,
  };
}

function listWorkItemTypesOutput(project: string, types: readonly WorkItemTypeSummary[]) {
  return {
    project,
    total: types.length,
    workItemTypes: types,
  };
}

function listWorkItemFieldsOutput(summary: WorkItemFieldsCatalog) {
  return {
    project: summary.project,
    total: summary.total,
    fields: summary.fields,
  };
}

function listAreaPathsOutput(summary: AreaPathsCatalog) {
  return {
    project: summary.project,
    mode: summary.mode,
    depth: summary.depth,
    total: summary.total,
    paths: summary.paths,
  };
}

function listIterationPathsOutput(summary: IterationPathsCatalog) {
  return {
    project: summary.project,
    mode: summary.mode,
    depth: summary.depth,
    total: summary.total,
    paths: summary.paths,
  };
}

function listTagsOutput(summary: WorkItemTagsCatalog) {
  return {
    project: summary.project,
    total: summary.total,
    tags: summary.tags,
  };
}

function resolveIdentityOutput(summary: ResolvedIdentityCatalog) {
  return {
    query: summary.query,
    project: summary.project,
    total: summary.total,
    identities: summary.identities,
  };
}

function listSavedQueriesOutput(summary: SavedQueriesCatalog) {
  return {
    project: summary.project,
    mode: summary.mode,
    depth: summary.depth,
    total: summary.total,
    queries: summary.queries,
  };
}

function runSavedQueryOutput(summary: SavedQueryExecutionSummary) {
  return {
    project: summary.project,
    query: summary.query,
    wiql: summary.wiql,
    total: summary.total,
    returned: summary.returned,
    workItemIds: summary.workItemIds,
    ...(summary.workItems ? { workItems: summary.workItems } : {}),
    ...(summary.raw !== undefined ? { raw: summary.raw } : {}),
  };
}

function exportWorkItemsDeltaOutput(summary: WorkItemsDeltaExport) {
  return summary;
}

function exportTraceabilityDatasetOutput(summary: TraceabilityDatasetExport) {
  return summary;
}

function findSimilarWorkItemsOutput(summary: SimilarWorkItemsResult) {
  return summary;
}

function findDuplicateCandidatesOutput(summary: DuplicateCandidatesResult) {
  return summary;
}

function clusterWorkItemsBySimilarityOutput(summary: SimilarityClustersResult) {
  return summary;
}

function workItemCommentsOutput(summary: WorkItemCommentsList) {
  return {
    workItemId: summary.workItemId,
    project: summary.project,
    totalCount: summary.totalCount,
    returned: summary.returned,
    paging: summary.paging,
    comments: summary.comments,
  };
}

function workItemUpdatesOutput(summary: WorkItemUpdatesList) {
  return {
    workItemId: summary.workItemId,
    project: summary.project,
    totalCount: summary.totalCount,
    returned: summary.returned,
    paging: summary.paging,
    updates: summary.updates,
  };
}

function workItemRevisionsOutput(summary: WorkItemRevisionsList) {
  return {
    workItemId: summary.workItemId,
    project: summary.project,
    totalCount: summary.totalCount,
    returned: summary.returned,
    paging: summary.paging,
    revisions: summary.revisions,
  };
}

function exportWorkItemsFullOutput(summary: ExportedWorkItemsFullSummary) {
  return {
    query: summary.query,
    totalMatched: summary.totalMatched,
    returned: summary.returned,
    workItems: summary.workItems,
  };
}

function listTestPlansOutput(project: string, testPlans: readonly TestPlanSummary[]) {
  return {
    project,
    total: testPlans.length,
    testPlans,
  };
}

function listTestSuitesOutput(
  project: string,
  planId: number,
  testSuites: readonly TestSuiteSummary[],
) {
  return {
    project,
    planId,
    total: testSuites.length,
    testSuites,
  };
}

function listTestCasesOutput(
  project: string,
  planId: number,
  suiteId: number,
  testCases: readonly TestCaseSummary[],
) {
  return {
    project,
    planId,
    suiteId,
    total: testCases.length,
    testCases,
  };
}

function listTestCasesFullOutput(summary: TestCasesFullList) {
  return summary;
}

function listWorkItemTestLinksOutput(summary: WorkItemTestLinksSummary) {
  return summary;
}

function getUserStoryTestCoverageOutput(summary: UserStoryTestCoverage) {
  return summary;
}

function getRequirementTraceabilityReportOutput(summary: RequirementTraceabilityReport) {
  return summary;
}

function listTestRunsOutput(
  project: string,
  top: number,
  testRuns: readonly TestRunSummary[],
) {
  return {
    project,
    top,
    total: testRuns.length,
    testRuns,
  };
}

function getTestPlanOutput(testPlan: TestPlanFull) {
  return testPlan;
}

function getTestPlanSuitesTreeOutput(summary: TestPlanSuitesTree) {
  return summary;
}

function getTestSuiteOutput(testSuite: TestSuiteFull) {
  return testSuite;
}

function listTestPointsOutput(summary: TestPointsList) {
  return summary;
}

function getTestPointHistoryOutput(summary: TestPointHistory) {
  return summary;
}

function getTestRunFullOutput(summary: TestRunFull) {
  return summary;
}

function exportTestPlanFullOutput(summary: ExportedTestPlanFull) {
  return summary;
}

function listPipelinesOutput(project: string, pipelines: readonly PipelineSummary[]) {
  return {
    project,
    total: pipelines.length,
    pipelines,
  };
}

function listPipelineRunsOutput(
  project: string,
  top: number,
  definitionId: number | undefined,
  pipelineRuns: readonly PipelineRunSummary[],
) {
  return {
    project,
    definitionId,
    top,
    total: pipelineRuns.length,
    pipelineRuns,
  };
}

function listPipelineArtifactsOutput(
  project: string,
  runId: number,
  artifacts: readonly PipelineArtifactSummary[],
) {
  return {
    project,
    runId,
    total: artifacts.length,
    artifacts,
  };
}

function dailyDigestOutput(summary: DailyDigestSummary) {
  return {
    myWorkItems: summary.myWorkItems,
    prsPendingMyReview: summary.prsPendingMyReview,
    failedPipelines: summary.failedPipelines,
    generatedAt: summary.generatedAt,
  };
}

function blockedItemsOutput(
  project: string,
  blockedItems: readonly BlockedItemSummary[],
) {
  return {
    blockedItems,
    totalBlocked: blockedItems.length,
    project,
  };
}

function sprintSummaryOutput(summary: SprintSummary) {
  return {
    sprint: summary.sprint,
    totalItems: summary.totalItems,
    byState: summary.byState,
    completionPercentage: summary.completionPercentage,
    atRiskItems: summary.atRiskItems,
  };
}

function sprintCapacityOutput(summary: SprintCapacitySummary) {
  return {
    sprint: summary.sprint,
    totalAvailableHours: summary.totalAvailableHours,
    members: summary.members,
    teamDaysOff: summary.teamDaysOff,
  };
}

function crossProjectDependenciesOutput(summary: CrossProjectDependenciesSummary) {
  return {
    workItem: summary.workItem,
    blockedBy: summary.blockedBy,
    blocking: summary.blocking,
    crossProjectCount: summary.crossProjectCount,
  };
}

function summarizeDependencyCount(
  blockedBy: readonly DependencyWorkItemSummary[],
  blocking: readonly DependencyWorkItemSummary[],
) {
  return `Found ${blockedBy.length} blocking dependencies and ${blocking.length} downstream dependencies.`;
}

function dashboardWidgetDataOutput(summary: DashboardWidgetDataSummary) {
  return {
    widgetName: summary.widgetName,
    widgetType: summary.widgetType,
    queryId: summary.queryId,
    queryResults: summary.queryResults,
    rawSettings: summary.rawSettings,
  };
}

function pipelineFailureOutput(analysis: PipelineFailureAnalysis) {
  return {
    buildNumber: analysis.buildNumber,
    definition: analysis.definition,
    requestedBy: analysis.requestedBy,
    startTime: analysis.startTime,
    finishTime: analysis.finishTime,
    failedTasks: analysis.failedTasks,
    summary: analysis.summary,
  };
}

function testFailureImpactOutput(summary: TestFailureImpactSummary) {
  return {
    testRun: summary.testRun,
    failedTests: summary.failedTests,
    impactSummary: summary.impactSummary,
  };
}

export function buildMcpServer(services: AzureDevOpsServices, logger: Logger): McpServer {
  const server = new McpServer(
    {
      name: APP_NAME,
      version: APP_VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description:
        "Use this when you need the Azure DevOps projects available through this connector.",
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        total: z.number().int().nonnegative(),
        projects: z.array(projectSchema),
      }),
    },
    async () => {
      try {
        const projects = await services.listProjects();
        return createStructuredToolResult(
          summarizeCount("project", projects),
          listProjectsOutput(projects),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_projects");
      }
    },
  );

  server.registerTool(
    "list_repositories",
    {
      title: "List Repositories",
      description:
        "Use this when you need the repositories inside a specific Azure DevOps project.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        total: z.number().int().nonnegative(),
        repositories: z.array(repositorySchema),
      }),
    },
    async ({ project }) => {
      try {
        const repositories = await services.listRepositories(project);
        return createStructuredToolResult(
          summarizeCount("repository", repositories),
          listRepositoriesOutput(project, repositories),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_repositories");
      }
    },
  );

  server.registerTool(
    "list_pull_requests",
    {
      title: "List Pull Requests",
      description:
        "Use this when you need pull requests from a repository in a specific Azure DevOps project.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        repository: z.string().min(1).describe("Repository name or ID."),
        status: z
          .enum(["active", "completed", "abandoned"])
          .default("active")
          .describe("Pull request status filter."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        repository: z.string(),
        status: z.string(),
        total: z.number().int().nonnegative(),
        pullRequests: z.array(pullRequestSchema),
      }),
    },
    async ({ project, repository, status }) => {
      try {
        const pullRequests = await services.listPullRequests(project, repository, status);
        return createStructuredToolResult(
          summarizeCount("pull request", pullRequests),
          listPullRequestsOutput(project, repository, status, pullRequests),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_pull_requests");
      }
    },
  );

  server.registerTool(
    "get_pull_request_work_items",
    {
      title: "Get Pull Request Work Items",
      description:
        "Use this when you need the work items linked to a specific Azure DevOps pull request.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        repository: z.string().min(1).describe("Repository name or ID."),
        pullRequestId: z.number().int().positive().describe("Pull request ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        repository: z.string(),
        pullRequestId: z.number().int(),
        total: z.number().int().nonnegative(),
        workItems: z.array(workItemSchema),
      }),
    },
    async ({ project, repository, pullRequestId }) => {
      try {
        const workItems = await services.getPullRequestWorkItems(
          project,
          repository,
          pullRequestId,
        );
        return createStructuredToolResult(
          summarizeCount("linked work item", workItems),
          linkedWorkItemsOutput(project, repository, pullRequestId, workItems),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_pull_request_work_items");
      }
    },
  );

  server.registerTool(
    "search_pull_requests_by_work_item",
    {
      title: "Search Pull Requests By Work Item",
      description:
        "Use this when you need pull requests associated with a specific work item to understand how the requirement, bug, or story was implemented in code.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include underlying Azure DevOps pull request and relation payload fragments."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        workItemId: z.number().int(),
        project: z.string(),
        total: z.number().int().nonnegative(),
        pullRequests: z.array(linkedPullRequestSchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.searchPullRequestsByWorkItem(input);
        return createStructuredToolResult(
          summarizeCount("pull request", summary.pullRequests),
          searchPullRequestsByWorkItemOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "search_pull_requests_by_work_item");
      }
    },
  );

  server.registerTool(
    "get_pull_request_full",
    {
      title: "Get Pull Request Full",
      description:
        "Use this when you need a fuller pull request view with repository context, reviewers, merge metadata, and optionally linked work items.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        repository: trimmedStringSchema.describe("Repository name or ID."),
        pullRequestId: z.number().int().positive().describe("Pull request ID."),
        includeWorkItems: z
          .boolean()
          .optional()
          .describe("When true, include linked work items associated with the pull request."),
        includeReviewers: z
          .boolean()
          .optional()
          .describe("When true, include reviewer details exposed by Azure DevOps."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps pull request payload."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: pullRequestFullSchema,
    },
    async (input) => {
      try {
        const summary = await services.getPullRequestFull(input);
        return createStructuredToolResult(
          `Loaded pull request ${summary.pullRequestId} in repository ${summary.repository.name ?? input.repository}.`,
          getPullRequestFullOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_pull_request_full");
      }
    },
  );

  server.registerTool(
    "list_pull_request_commits",
    {
      title: "List Pull Request Commits",
      description:
        "Use this when you need the commits that make up a specific pull request.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        repository: trimmedStringSchema.describe("Repository name or ID."),
        pullRequestId: z.number().int().positive().describe("Pull request ID."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps commit payload for each commit."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        repository: z.string(),
        pullRequestId: z.number().int(),
        total: z.number().int().nonnegative(),
        commits: z.array(gitCommitSchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.listPullRequestCommits(input);
        return createStructuredToolResult(
          summarizeCount("commit", summary.commits),
          listPullRequestCommitsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_pull_request_commits");
      }
    },
  );

  server.registerTool(
    "get_pull_request_diff",
    {
      title: "Get Pull Request Diff",
      description:
        "Use this when you need a pull request file change summary and, when available, patch fragments for deeper code-change analysis.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        repository: trimmedStringSchema.describe("Repository name or ID."),
        pullRequestId: z.number().int().positive().describe("Pull request ID."),
        includePatch: z
          .boolean()
          .optional()
          .describe("When true, include patch text when Azure DevOps exposes it in the diff payload."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw Azure DevOps diff pages and iteration payloads."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        repository: z.string(),
        pullRequestId: z.number().int(),
        iterationId: z.number().int().nullable(),
        sourceCommitId: z.string().nullable(),
        targetCommitId: z.string().nullable(),
        totalFiles: z.number().int().nonnegative(),
        files: z.array(pullRequestFileChangeSchema),
        raw: z.unknown().optional(),
      }),
    },
    async (input) => {
      try {
        const summary = await services.getPullRequestDiff(input);
        return createStructuredToolResult(
          summarizeCount("changed file", summary.files),
          getPullRequestDiffOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_pull_request_diff");
      }
    },
  );

  server.registerTool(
    "get_commit_full",
    {
      title: "Get Commit Full",
      description:
        "Use this when you need a fuller commit view with repository context, changed files, optional patch content, and raw Azure DevOps payloads.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        repository: trimmedStringSchema.describe("Repository name or ID."),
        commitId: trimmedStringSchema.describe("Git commit SHA or commit ID."),
        includePatch: z
          .boolean()
          .optional()
          .describe("When true, include patch text when Azure DevOps exposes it in commit change payloads."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw Azure DevOps commit and change payloads."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: commitFullSchema,
    },
    async (input) => {
      try {
        const summary = await services.getCommitFull(input);
        return createStructuredToolResult(
          `Loaded commit ${summary.commitId} with ${summary.changedFiles.length} changed file${summary.changedFiles.length === 1 ? "" : "s"}.`,
          getCommitFullOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_commit_full");
      }
    },
  );

  server.registerTool(
    "search_commits_by_work_item",
    {
      title: "Search Commits By Work Item",
      description:
        "Use this when you need commits associated with a work item, typically by traversing linked pull requests and direct commit artifact links.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
        includePatch: z
          .boolean()
          .optional()
          .describe("When true, enrich commit results with changed files and patch text when Azure DevOps exposes it."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw Azure DevOps commit, relation, and PR-linked payload fragments."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        workItemId: z.number().int(),
        project: z.string(),
        total: z.number().int().nonnegative(),
        commits: z.array(linkedCommitSchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.searchCommitsByWorkItem(input);
        return createStructuredToolResult(
          summarizeCount("commit", summary.commits),
          searchCommitsByWorkItemOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "search_commits_by_work_item");
      }
    },
  );

  server.registerTool(
    "list_work_item_fields",
    {
      title: "List Work Item Fields",
      description:
        "Use this when you need the Azure DevOps work item field catalog for a project, including reference names and metadata for building dynamic analytics filters.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        search: trimmedStringSchema
          .optional()
          .describe("Optional case-insensitive substring filter applied to field names, reference names, and types."),
        referenceNames: trimmedStringArraySchema
          .optional()
          .describe("Optional exact reference-name filters used to keep only selected fields."),
        names: trimmedStringArraySchema
          .optional()
          .describe("Optional exact display-name filters used to keep only selected fields."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps field payload for each returned field."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        total: z.number().int().nonnegative(),
        fields: z.array(workItemFieldSchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.listWorkItemFields(input);
        return createStructuredToolResult(
          summarizeCount("work item field", summary.fields),
          listWorkItemFieldsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_fields");
      }
    },
  );

  server.registerTool(
    "list_area_paths",
    {
      title: "List Area Paths",
      description:
        "Use this when you need the Azure DevOps area path catalog for a project, either as a tree or a flattened path list for analytics filters.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        depth: z
          .number()
          .int()
          .min(0)
          .max(20)
          .optional()
          .describe("Maximum tree depth to request and return, where 0 keeps only the root node."),
        mode: z
          .enum(["tree", "flat"])
          .optional()
          .describe("Choose tree for recursive children arrays or flat for a flattened path catalog."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps classification node payload on each returned path."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        mode: z.enum(["tree", "flat"]),
        depth: z.number().int().min(0),
        total: z.number().int().nonnegative(),
        paths: z.array(areaPathNodeSchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.listAreaPaths(input);
        return createStructuredToolResult(
          summarizeCount("area path", summary.paths),
          listAreaPathsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_area_paths");
      }
    },
  );

  server.registerTool(
    "list_iteration_paths",
    {
      title: "List Iteration Paths",
      description:
        "Use this when you need the Azure DevOps iteration path catalog for a project, including date metadata when Azure DevOps exposes it.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        depth: z
          .number()
          .int()
          .min(0)
          .max(20)
          .optional()
          .describe("Maximum tree depth to request and return, where 0 keeps only the root node."),
        mode: z
          .enum(["tree", "flat"])
          .optional()
          .describe("Choose tree for recursive children arrays or flat for a flattened iteration catalog."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps classification node payload on each returned path."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        mode: z.enum(["tree", "flat"]),
        depth: z.number().int().min(0),
        total: z.number().int().nonnegative(),
        paths: z.array(iterationPathNodeSchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.listIterationPaths(input);
        return createStructuredToolResult(
          summarizeCount("iteration path", summary.paths),
          listIterationPathsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_iteration_paths");
      }
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description:
        "Use this when you need the work item tags that currently exist in a project for filter-building and discovery workflows.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        search: trimmedStringSchema
          .optional()
          .describe("Optional case-insensitive substring filter applied to tag names."),
        top: z
          .number()
          .int()
          .min(1)
          .max(MAX_TOP)
          .optional()
          .describe("Maximum number of tags to return after filtering."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps tag payload for each returned tag."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        total: z.number().int().nonnegative(),
        tags: z.array(workItemTagSchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.listTags(input);
        return createStructuredToolResult(
          summarizeCount("tag", summary.tags),
          listTagsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_tags");
      }
    },
  );

  server.registerTool(
    "resolve_identity",
    {
      title: "Resolve Identity",
      description:
        "Use this when you need to turn a free-text person query into likely Azure DevOps identities that can be reused in analytics filters such as assignedTo or createdBy.",
      inputSchema: z.object({
        query: trimmedStringSchema.describe("Free-text identity query such as a display name, alias, or email address."),
        project: trimmedStringSchema
          .optional()
          .describe("Optional Azure DevOps project name or ID used for allowlist enforcement and contextual narrowing."),
        top: z
          .number()
          .int()
          .min(1)
          .max(MAX_TOP)
          .optional()
          .describe("Maximum number of candidate identities to return."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps identity payload for each returned candidate."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        query: z.string(),
        project: z.string().nullable(),
        total: z.number().int().nonnegative(),
        identities: z.array(resolvedIdentitySchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.resolveIdentity(input);
        return createStructuredToolResult(
          summarizeCount("identity", summary.identities),
          resolveIdentityOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "resolve_identity");
      }
    },
  );

  server.registerTool(
    "list_saved_queries",
    {
      title: "List Saved Queries",
      description:
        "Use this when you need the saved query and query-folder catalog for a project so later analytics can reuse stable query IDs and paths instead of hardcoded assumptions.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        depth: z
          .number()
          .int()
          .min(0)
          .max(2)
          .optional()
          .describe("Maximum query-folder depth to retrieve from the Azure DevOps query hierarchy. Azure DevOps currently accepts values from 0 to 2."),
        mode: z
          .enum(["tree", "flat"])
          .optional()
          .describe("Choose tree for recursive query-folder children arrays or flat for a flattened catalog."),
        includeWiql: z
          .boolean()
          .optional()
          .describe("When true, include WIQL text for saved queries when Azure DevOps returns it."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps query hierarchy payload on each returned node."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        mode: z.enum(["tree", "flat"]),
        depth: z.number().int().min(0),
        total: z.number().int().nonnegative(),
        queries: z.array(savedQuerySchema),
      }),
    },
    async (input) => {
      try {
        const summary = await services.listSavedQueries(input);
        return createStructuredToolResult(
          summarizeCount("saved query", summary.queries),
          listSavedQueriesOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_saved_queries");
      }
    },
  );

  const runSavedQueryInputSchema = z
    .object({
      project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
      queryId: trimmedStringSchema
        .optional()
        .describe("Saved query ID to execute. Provide this or path, but not both."),
      path: trimmedStringSchema
        .optional()
        .describe("Saved query path to resolve and execute. Provide this or queryId, but not both."),
      includeWorkItems: z
        .boolean()
        .optional()
        .describe("When true, load normalized work item details for the returned work item IDs."),
      includeRaw: z
        .boolean()
        .optional()
        .describe("When true, include raw Azure DevOps query-definition, execution, and work item payload fragments."),
      top: z
        .number()
        .int()
        .min(1)
        .max(MAX_TOP)
        .optional()
        .describe("Maximum number of work item IDs, and optional work items, to return from the saved query result."),
      expand: workItemExpandSchema
        .optional()
        .describe("Optional work item expansion mode used only when includeWorkItems is true."),
    })
    .refine(
      (value) => (value.queryId ? 1 : 0) + (value.path ? 1 : 0) === 1,
      "Provide exactly one of queryId or path.",
    );

  server.registerTool(
    "run_saved_query",
    {
      title: "Run Saved Query",
      description:
        "Use this when you need to execute an existing Azure DevOps saved query by ID or path and optionally enrich the resulting work item IDs with normalized work item details.",
      inputSchema: runSavedQueryInputSchema,
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        query: savedQuerySchema,
        wiql: z.string().nullable(),
        total: z.number().int().nonnegative(),
        returned: z.number().int().nonnegative(),
        workItemIds: z.array(z.number().int().positive()),
        workItems: z.array(workItemFullSchema).optional(),
        raw: z.unknown().optional(),
      }),
    },
    async (input) => {
      try {
        const summary = await services.runSavedQuery(input);
        return createStructuredToolResult(
          summary.total === 1
            ? "Saved query returned 1 work item."
            : `Saved query returned ${summary.returned} work items out of ${summary.total} matched.`,
          runSavedQueryOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "run_saved_query");
      }
    },
  );

  const exportWorkItemsDeltaInputSchema = z
    .object({
      project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
      fromDate: isoDateInputSchema
        .optional()
        .describe("Optional alias for changedSince when exporting work item deltas."),
      changedSince: isoDateInputSchema
        .optional()
        .describe("Lower bound for System.ChangedDate used to build the delta export."),
      workItemTypes: z.array(trimmedStringSchema).optional(),
      categoryReferenceNames: z.array(trimmedStringSchema).optional(),
      categoryNames: z.array(trimmedStringSchema).optional(),
      states: z.array(trimmedStringSchema).optional(),
      assignedTo: trimmedStringSchema.optional(),
      createdBy: trimmedStringSchema.optional(),
      changedBy: trimmedStringSchema.optional(),
      tags: z.array(trimmedStringSchema).optional(),
      tagsAny: z.array(trimmedStringSchema).optional(),
      tagsAll: z.array(trimmedStringSchema).optional(),
      areaPaths: z.array(trimmedStringSchema).optional(),
      iterationPaths: z.array(trimmedStringSchema).optional(),
      text: trimmedStringSchema.optional(),
      ids: z.array(z.number().int().positive()).optional(),
      priority: z.array(z.number().int()).optional(),
      severity: z.array(trimmedStringSchema).optional(),
      reason: z.array(trimmedStringSchema).optional(),
      changedDateTo: isoDateInputSchema.optional(),
      orderBy: z.array(workItemSearchOrderBySchema).optional(),
      top: z.number().int().min(1).max(200).optional(),
      maxItems: z.number().int().min(1).max(200).optional(),
      includeWorkItems: z.boolean().optional(),
      includeUpdates: z.boolean().optional(),
      includeRevisions: z.boolean().optional(),
      includeRaw: z.boolean().optional(),
      expand: workItemExpandSchema.optional(),
      includeRelations: z.boolean().optional(),
      includeLinks: z.boolean().optional(),
    })
    .refine(
      (value) => Boolean(value.changedSince || value.fromDate),
      "Provide changedSince or fromDate.",
    );

  server.registerTool(
    "export_work_items_delta",
    {
      title: "Export Work Items Delta",
      description:
        "Use this when you need a work item delta export from a specific changed-since watermark, optionally enriched with work item details, updates, and revisions for larger analytics workflows.",
      inputSchema: exportWorkItemsDeltaInputSchema,
      annotations: readOnlyAnnotations,
      outputSchema: workItemsDeltaExportSchema,
    },
    async (input) => {
      try {
        const summary = await services.exportWorkItemsDelta(input);
        return createStructuredToolResult(
          summarizeCount("delta work item", summary.workItemIds),
          exportWorkItemsDeltaOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "export_work_items_delta");
      }
    },
  );

  const exportTraceabilityDatasetInputSchema = z
    .object({
      project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
      queryId: trimmedStringSchema
        .optional()
        .describe("Optional saved query ID used to define the dataset scope."),
      path: trimmedStringSchema
        .optional()
        .describe("Optional saved query path used to define the dataset scope."),
      workItemTypes: z.array(trimmedStringSchema).optional(),
      categoryReferenceNames: z.array(trimmedStringSchema).optional(),
      categoryNames: z.array(trimmedStringSchema).optional(),
      states: z.array(trimmedStringSchema).optional(),
      assignedTo: trimmedStringSchema.optional(),
      createdBy: trimmedStringSchema.optional(),
      changedBy: trimmedStringSchema.optional(),
      tags: z.array(trimmedStringSchema).optional(),
      tagsAny: z.array(trimmedStringSchema).optional(),
      tagsAll: z.array(trimmedStringSchema).optional(),
      areaPaths: z.array(trimmedStringSchema).optional(),
      iterationPaths: z.array(trimmedStringSchema).optional(),
      text: trimmedStringSchema.optional(),
      ids: z.array(z.number().int().positive()).optional(),
      priority: z.array(z.number().int()).optional(),
      severity: z.array(trimmedStringSchema).optional(),
      reason: z.array(trimmedStringSchema).optional(),
      createdDateFrom: isoDateInputSchema.optional(),
      createdDateTo: isoDateInputSchema.optional(),
      changedDateFrom: isoDateInputSchema.optional(),
      changedDateTo: isoDateInputSchema.optional(),
      closedDateFrom: isoDateInputSchema.optional(),
      closedDateTo: isoDateInputSchema.optional(),
      resolvedDateFrom: isoDateInputSchema.optional(),
      resolvedDateTo: isoDateInputSchema.optional(),
      orderBy: z.array(workItemSearchOrderBySchema).optional(),
      top: z.number().int().min(1).max(200).optional(),
      maxItems: z.number().int().min(1).max(200).optional(),
      includeWorkItems: z.boolean().optional(),
      includeTestLinks: z.boolean().optional(),
      includeCoverage: z.boolean().optional(),
      includePullRequests: z.boolean().optional(),
      includeCommits: z.boolean().optional(),
      includeSuites: z.boolean().optional(),
      includePlans: z.boolean().optional(),
      includeRecentRuns: z.boolean().optional(),
      includeRaw: z.boolean().optional(),
      expand: workItemExpandSchema.optional(),
      includeRelations: z.boolean().optional(),
      includeLinks: z.boolean().optional(),
    })
    .refine(
      (value) => !(value.queryId && value.path),
      "Provide queryId or path, but not both.",
    );

  server.registerTool(
    "export_traceability_dataset",
    {
      title: "Export Traceability Dataset",
      description:
        "Use this when you need a chunkable analytics dataset that combines work items with optional test traceability, coverage, pull request, and commit context.",
      inputSchema: exportTraceabilityDatasetInputSchema,
      annotations: readOnlyAnnotations,
      outputSchema: traceabilityDatasetExportSchema,
    },
    async (input) => {
      try {
        const summary = await services.exportTraceabilityDataset(input);
        return createStructuredToolResult(
          summarizeCount("dataset work item", summary.workItemIds),
          exportTraceabilityDatasetOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "export_traceability_dataset");
      }
    },
  );

  const similarityScopeSchema = z.object({
    project: trimmedStringSchema.describe("Azure DevOps project name or ID for the source work item or primary search scope."),
    candidateProjects: z
      .array(trimmedStringSchema)
      .optional()
      .describe("Optional candidate-project scope for similarity and duplicate searches. Each project must pass the configured allowlist."),
    workItemTypes: z.array(trimmedStringSchema).optional(),
    states: z.array(trimmedStringSchema).optional(),
    assignedTo: trimmedStringSchema.optional(),
    createdBy: trimmedStringSchema.optional(),
    tags: z.array(trimmedStringSchema).optional(),
    areaPaths: z.array(trimmedStringSchema).optional(),
    iterationPaths: z.array(trimmedStringSchema).optional(),
    text: trimmedStringSchema.optional(),
    ids: z.array(z.number().int().positive()).optional(),
    priority: z.array(z.number().int()).optional(),
    severity: z.array(trimmedStringSchema).optional(),
    reason: z.array(trimmedStringSchema).optional(),
    fieldNames: z
      .array(trimmedStringSchema)
      .optional()
      .describe("Optional custom field reference names to compare as deterministic similarity signals."),
    top: z
      .number()
      .int()
      .min(1)
      .max(MAX_TOP)
      .optional()
      .describe("Maximum number of ranked candidates to return."),
    maxCandidates: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Maximum number of candidate work items to analyze before scoring."),
    minScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Minimum score threshold used to keep similarity or duplicate candidates."),
    includeRaw: z
      .boolean()
      .optional()
      .describe("When true, include raw scoring signals and raw candidate payload fragments."),
  });

  server.registerTool(
    "find_similar_work_items",
    {
      title: "Find Similar Work Items",
      description:
        "Use this when you need deterministic, explainable similarity candidates for one Azure DevOps work item based on title, description, tags, paths, identities, custom fields, and shared artifact links.",
      inputSchema: similarityScopeSchema.extend({
        workItemId: z
          .number()
          .int()
          .positive()
          .describe("Azure DevOps work item ID used as the similarity source."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: similarWorkItemsResultSchema,
    },
    async (input) => {
      try {
        const summary = await services.findSimilarWorkItems(input);
        return createStructuredToolResult(
          summarizeCount("similar work item candidate", summary.candidates),
          findSimilarWorkItemsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "find_similar_work_items");
      }
    },
  );

  server.registerTool(
    "find_duplicate_candidates",
    {
      title: "Find Duplicate Candidates",
      description:
        "Use this when you need explainable duplicate candidates for a work item, optimized for bug, issue, or incident de-duplication workflows.",
      inputSchema: similarityScopeSchema.extend({
        sourceWorkItemId: z
          .number()
          .int()
          .positive()
          .describe("Azure DevOps work item ID used as the duplicate-detection source."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: duplicateCandidatesResultSchema,
    },
    async (input) => {
      try {
        const summary = await services.findDuplicateCandidates(input);
        return createStructuredToolResult(
          summarizeCount("duplicate candidate", summary.candidates),
          findDuplicateCandidatesOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "find_duplicate_candidates");
      }
    },
  );

  server.registerTool(
    "cluster_work_items_by_similarity",
    {
      title: "Cluster Work Items By Similarity",
      description:
        "Use this when you need deterministic similarity clusters across a search scope of work items for recurring-issue analysis.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID for the primary clustering scope."),
        projects: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional project scope list used when clustering across multiple allowlisted projects."),
        workItemTypes: z.array(trimmedStringSchema).optional(),
        states: z.array(trimmedStringSchema).optional(),
        assignedTo: trimmedStringSchema.optional(),
        createdBy: trimmedStringSchema.optional(),
        tags: z.array(trimmedStringSchema).optional(),
        areaPaths: z.array(trimmedStringSchema).optional(),
        iterationPaths: z.array(trimmedStringSchema).optional(),
        text: trimmedStringSchema.optional(),
        ids: z.array(z.number().int().positive()).optional(),
        priority: z.array(z.number().int()).optional(),
        severity: z.array(trimmedStringSchema).optional(),
        reason: z.array(trimmedStringSchema).optional(),
        fieldNames: z.array(trimmedStringSchema).optional(),
        maxItems: z
          .number()
          .int()
          .min(2)
          .max(200)
          .optional()
          .describe("Maximum number of work items to load into the clustering scope."),
        minScore: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Minimum pairwise similarity score required to connect two items into the same cluster."),
        minClusterSize: z
          .number()
          .int()
          .min(2)
          .max(50)
          .optional()
          .describe("Minimum number of members required for a cluster to be returned."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw cluster member payloads and pairwise similarity edges."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: similarityClustersResultSchema,
    },
    async (input) => {
      try {
        const summary = await services.clusterWorkItemsBySimilarity(input);
        return createStructuredToolResult(
          summarizeCount("similarity cluster", summary.clusters),
          clusterWorkItemsBySimilarityOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "cluster_work_items_by_similarity");
      }
    },
  );

  server.registerTool(
    "list_work_item_categories",
    {
      title: "List Work Item Categories",
      description:
        "Use this when you need the work item categories configured for a specific Azure DevOps project.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        total: z.number().int().nonnegative(),
        categories: z.array(workItemCategorySchema),
      }),
    },
    async ({ project }) => {
      try {
        const categories = await services.listWorkItemCategories(project);
        return createStructuredToolResult(
          summarizeCount("work item category", categories),
          listWorkItemCategoriesOutput(project, categories),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_categories");
      }
    },
  );

  server.registerTool(
    "list_work_item_types",
    {
      title: "List Work Item Types",
      description:
        "Use this when you need the work item types that exist in a specific Azure DevOps project.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps work item type payload on each returned type."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        total: z.number().int().nonnegative(),
        workItemTypes: z.array(workItemTypeSchema),
      }),
    },
    async (input) => {
      try {
        const workItemTypes = await services.listWorkItemTypes(input);
        return createStructuredToolResult(
          summarizeCount("work item type", workItemTypes),
          listWorkItemTypesOutput(input.project, workItemTypes),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_types");
      }
    },
  );

  server.registerTool(
    "get_work_item",
    {
      title: "Get Work Item",
      description:
        "Use this when you already know an Azure DevOps work item ID and need its details.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Work item ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: workItemSchema,
    },
    async ({ id }) => {
      try {
        const workItem = await services.getWorkItem(id);
        return createStructuredToolResult(
          `Retrieved work item ${workItem.id}.`,
          workItem,
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_work_item");
      }
    },
  );

  server.registerTool(
    "get_work_item_full",
    {
      title: "Get Work Item Full",
      description:
        "Use this when you need the full Azure DevOps work item payload with all fields, relations, links, and optional raw response data.",
      inputSchema: z.object({
        id: z.number().int().positive().describe("Azure DevOps work item ID."),
        project: trimmedStringSchema
          .optional()
          .describe("Optional Azure DevOps project name or ID used for allowlist and mismatch validation."),
        expand: workItemExpandSchema
          .optional()
          .describe("Optional Azure DevOps base expansion mode. Flags like includeRelations and includeLinks may widen it."),
        includeRelations: z
          .boolean()
          .optional()
          .describe("When true, include normalized work item relations."),
        includeLinks: z
          .boolean()
          .optional()
          .describe("When true, include normalized _links and links maps."),
        includeComments: z
          .boolean()
          .optional()
          .describe("When true, include work item comments."),
        includeUpdates: z
          .boolean()
          .optional()
          .describe("When true, include work item updates."),
        includeRevisions: z
          .boolean()
          .optional()
          .describe("When true, include work item revisions."),
        includeAttachments: z
          .boolean()
          .optional()
          .describe("When true, include attached file relations as normalized attachments."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps response alongside the normalized fields."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: workItemFullSchema,
    },
    async (input) => {
      try {
        const workItem = await services.getWorkItemFull(input);
        return createStructuredToolResult(
          `Retrieved full work item ${workItem.id}.`,
          workItem as WorkItemFull,
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_work_item_full");
      }
    },
  );

  server.registerTool(
    "list_work_item_comments",
    {
      title: "List Work Item Comments",
      description:
        "Use this when you need the full Azure DevOps comment history for one work item, including deleted comments and paging-aware retrieval.",
      inputSchema: workItemAuditInputSchema,
      annotations: readOnlyAnnotations,
      outputSchema: workItemCommentsListSchema,
    },
    async (input) => {
      try {
        const summary = await services.listWorkItemComments(input);
        return createStructuredToolResult(
          summarizeCount("work item comment", summary.comments),
          workItemCommentsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_comments");
      }
    },
  );

  server.registerTool(
    "list_work_item_updates",
    {
      title: "List Work Item Updates",
      description:
        "Use this when you need the full Azure DevOps work item update history, including changed fields and relation changes.",
      inputSchema: workItemAuditInputSchema,
      annotations: readOnlyAnnotations,
      outputSchema: workItemUpdatesListSchema,
    },
    async (input) => {
      try {
        const summary = await services.listWorkItemUpdates(input);
        return createStructuredToolResult(
          summarizeCount("work item update", summary.updates),
          workItemUpdatesOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_updates");
      }
    },
  );

  server.registerTool(
    "list_work_item_revisions",
    {
      title: "List Work Item Revisions",
      description:
        "Use this when you need every Azure DevOps work item revision with field snapshots for audit or history analysis.",
      inputSchema: workItemAuditInputSchema,
      annotations: readOnlyAnnotations,
      outputSchema: workItemRevisionsListSchema,
    },
    async (input) => {
      try {
        const summary = await services.listWorkItemRevisions(input);
        return createStructuredToolResult(
          summarizeCount("work item revision", summary.revisions),
          workItemRevisionsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_revisions");
      }
    },
  );

  server.registerTool(
    "list_work_item_link_types",
    {
      title: "List Work Item Link Types",
      description:
        "Use this when you need the available Azure DevOps work item relation types and their normalized traceability metadata.",
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        total: z.number().int().nonnegative(),
        linkTypes: z.array(workItemLinkTypeSchema),
      }),
    },
    async () => {
      try {
        const linkTypes = await services.listWorkItemLinkTypes();
        return createStructuredToolResult(
          summarizeCount("work item link type", linkTypes),
          {
            total: linkTypes.length,
            linkTypes,
          },
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_link_types");
      }
    },
  );

  server.registerTool(
    "get_work_item_relations_graph",
    {
      title: "Get Work Item Relations Graph",
      description:
        "Use this when you need a normalized work item relations graph, including cross-project links that are permitted by the connector allowlist.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
        maxDepth: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("Maximum traversal depth. Values above 5 are clamped."),
        relationTypes: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional relation type filters by raw reference name, display name, or normalized category."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: workItemRelationsGraphSchema,
    },
    async (input) => {
      try {
        const graph = await services.getWorkItemRelationsGraph(input);
        return createStructuredToolResult(
          `Built a relations graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`,
          graph as WorkItemRelationsGraph,
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_work_item_relations_graph");
      }
    },
  );

  server.registerTool(
    "get_traceability_chain",
    {
      title: "Get Traceability Chain",
      description:
        "Use this when you need normalized traceability chains derived from a work item relations graph for downstream analysis.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
        maxDepth: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("Maximum traversal depth. Values above 5 are clamped."),
        relationTypes: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional relation type filters by raw reference name, display name, or normalized category."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: traceabilityChainSummarySchema,
    },
    async (input) => {
      try {
        const summary = await services.getTraceabilityChain(input);
        return createStructuredToolResult(
          `Built ${summary.totalChains} traceability chains from ${summary.nodes.length} graph nodes.`,
          summary as TraceabilityChainSummary,
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_traceability_chain");
      }
    },
  );

  server.registerTool(
    "list_linked_work_items",
    {
      title: "List Linked Work Items",
      description:
        "Use this when you need a flattened, node-centric list of work items linked to a root item, with path context derived from the normalized relations graph.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
        maxDepth: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe("Maximum traversal depth. Values above 5 are clamped."),
        relationTypes: z
          .array(trimmedStringSchema)
          .optional()
          .describe(
            "Optional relation type filters by raw reference name, display name, or normalized category.",
          ),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: linkedWorkItemsSummarySchema,
    },
    async (input) => {
      try {
        const summary = await services.listLinkedWorkItems(input);
        return createStructuredToolResult(
          summarizeCount("linked work item", summary.linkedWorkItems),
          summary as LinkedWorkItemsSummary,
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_linked_work_items");
      }
    },
  );

  server.registerTool(
    "list_work_item_test_links",
    {
      title: "List Work Item Test Links",
      description:
        "Use this when you need to connect a work item to directly linked test cases and, when requested, enrich them with suite, plan, and recent run context for downstream analysis.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
        includeTestCases: z
          .boolean()
          .optional()
          .describe("When true, include the linked test case work item summaries in addition to the minimal fields."),
        includeSuites: z
          .boolean()
          .optional()
          .describe("When true, include per-test-case suite summaries and populate suite-derived IDs."),
        includePlans: z
          .boolean()
          .optional()
          .describe("When true, include per-test-case plan summaries and populate plan-derived IDs."),
        includeRecentRuns: z
          .boolean()
          .optional()
          .describe("When true, load recent run summaries referenced by linked test point assignments."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw relation, point, and run payload fragments used to build each link."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: workItemTestLinksSummarySchema,
    },
    async (input) => {
      try {
        const summary = await services.listWorkItemTestLinks(input);
        return createStructuredToolResult(
          summarizeCount("work item test link", summary.testLinks),
          listWorkItemTestLinksOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_work_item_test_links");
      }
    },
  );

  server.registerTool(
    "get_user_story_test_coverage",
    {
      title: "Get User Story Test Coverage",
      description:
        "Use this when you need an analytical test coverage view for a user story or similar work item, including linked test cases, suite and plan coverage, recent runs, and summarized outcome counts.",
      inputSchema: z
        .object({
          project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
          workItemId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Azure DevOps work item ID. Use this or userStoryId."),
          userStoryId: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Azure DevOps user story work item ID. Use this or workItemId."),
          includeSuites: z
            .boolean()
            .optional()
            .describe("When true, include suite coverage and suite-level rollups. Defaults to true."),
          includePlans: z
            .boolean()
            .optional()
            .describe("When true, include plan coverage and plan-level rollups. Defaults to true."),
          includeRecentRuns: z
            .boolean()
            .optional()
            .describe("When true, include recent run coverage and compute latest outcomes from run results. Defaults to true."),
          includeRaw: z
            .boolean()
            .optional()
            .describe("When true, include underlying test-link and run payload fragments used to build the coverage view."),
        })
        .refine((input) => input.workItemId !== undefined || input.userStoryId !== undefined, {
          message: "Either workItemId or userStoryId must be provided.",
          path: ["workItemId"],
        }),
      annotations: readOnlyAnnotations,
      outputSchema: userStoryTestCoverageSchema,
    },
    async (input) => {
      try {
        const summary = await services.getUserStoryTestCoverage(input);
        return createStructuredToolResult(
          `Coverage status is ${summary.coverageStatus} across ${summary.summary.totalLinkedTestCases} linked test cases.`,
          getUserStoryTestCoverageOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_user_story_test_coverage");
      }
    },
  );

  server.registerTool(
    "get_requirement_traceability_report",
    {
      title: "Get Requirement Traceability Report",
      description:
        "Use this when you need a broader requirement or user-story traceability report with linked test cases, suite and plan coverage, recent runs, coverage gaps, and a high-level traceability verdict.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
        includeSuites: z
          .boolean()
          .optional()
          .describe("When true, include suite coverage and suite-level rollups. Defaults to true."),
        includePlans: z
          .boolean()
          .optional()
          .describe("When true, include plan coverage and plan-level rollups. Defaults to true."),
        includeRecentRuns: z
          .boolean()
          .optional()
          .describe("When true, include recent run coverage and compute latest outcomes from run results. Defaults to true."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include underlying coverage payload fragments used to build the traceability report."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: requirementTraceabilityReportSchema,
    },
    async (input) => {
      try {
        const summary = await services.getRequirementTraceabilityReport(input);
        return createStructuredToolResult(
          `Traceability status is ${summary.traceabilityStatus} with coverage status ${summary.coverageStatus}.`,
          getRequirementTraceabilityReportOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_requirement_traceability_report");
      }
    },
  );

  server.registerTool(
    "search_work_items",
    {
      title: "Search Work Items",
      description:
        "Use this when you need to find work items by project, assignee, state, or free-text search.",
      inputSchema: z.object({
        project: trimmedStringSchema.optional().describe("Optional Azure DevOps project name or ID."),
        assignedToMe: z
          .boolean()
          .optional()
          .describe("If true, only return items assigned to the authenticated Azure DevOps identity."),
        state: trimmedStringSchema.optional().describe("Optional work item state filter."),
        text: trimmedStringSchema.optional().describe("Optional free-text filter."),
        top: z
          .number()
          .int()
          .min(1)
          .max(MAX_TOP)
          .optional()
          .describe(`Maximum number of results to return, up to ${MAX_TOP}.`),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        query: z.object({
          project: z.string().optional(),
          assignedToMe: z.boolean().optional(),
          state: z.string().optional(),
          text: z.string().optional(),
          top: z.number().int().optional(),
        }),
        total: z.number().int().nonnegative(),
        workItems: z.array(workItemSchema),
      }),
    },
    async (input) => {
      try {
        const result = await services.searchWorkItems(input);
        return createStructuredToolResult(
          summarizeCount("work item", result.workItems),
          {
            query: result.query,
            total: result.workItems.length,
            workItems: result.workItems,
          },
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "search_work_items");
      }
    },
  );

  server.registerTool(
    "search_work_items_advanced",
    {
      title: "Search Work Items Advanced",
      description:
        "Use this when you need advanced Azure DevOps work item filtering by type, category, dates, tags, area path, iteration path, and ordering.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        workItemTypes: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional work item type filters such as Bug, Incident, or Issue."),
        categoryReferenceNames: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional work item category reference names such as Microsoft.BugCategory."),
        categoryNames: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional work item category display names such as Bug Category."),
        states: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional work item state filters."),
        assignedTo: trimmedStringSchema.optional().describe("Optional assignee filter."),
        createdBy: trimmedStringSchema.optional().describe("Optional creator filter."),
        changedBy: trimmedStringSchema.optional().describe("Optional last changed by filter."),
        tags: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional tag filters using any-match semantics."),
        tagsAny: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional tag filters where any supplied tag may match."),
        tagsAll: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional tag filters where every supplied tag must match."),
        areaPaths: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional area path filters. Matches descendant paths using WIQL UNDER."),
        iterationPaths: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional iteration path filters. Matches descendant paths using WIQL UNDER."),
        text: trimmedStringSchema
          .optional()
          .describe("Optional free-text filter applied to title and description."),
        ids: z
          .array(z.number().int().positive())
          .optional()
          .describe("Optional explicit work item IDs to constrain the query."),
        priority: z
          .array(z.number().int())
          .optional()
          .describe("Optional priority filters."),
        severity: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional severity filters."),
        reason: z
          .array(trimmedStringSchema)
          .optional()
          .describe("Optional reason filters."),
        createdDateFrom: isoDateInputSchema
          .optional()
          .describe("Optional lower bound for System.CreatedDate."),
        createdDateTo: isoDateInputSchema
          .optional()
          .describe("Optional upper bound for System.CreatedDate."),
        changedDateFrom: isoDateInputSchema
          .optional()
          .describe("Optional lower bound for System.ChangedDate."),
        changedDateTo: isoDateInputSchema
          .optional()
          .describe("Optional upper bound for System.ChangedDate."),
        closedDateFrom: isoDateInputSchema
          .optional()
          .describe("Optional lower bound for ClosedDate."),
        closedDateTo: isoDateInputSchema
          .optional()
          .describe("Optional upper bound for ClosedDate."),
        resolvedDateFrom: isoDateInputSchema
          .optional()
          .describe("Optional lower bound for ResolvedDate."),
        resolvedDateTo: isoDateInputSchema
          .optional()
          .describe("Optional upper bound for ResolvedDate."),
        orderBy: z
          .array(workItemSearchOrderBySchema)
          .optional()
          .describe("Optional sort order definitions. Defaults to changedDate desc."),
        top: z
          .number()
          .int()
          .min(1)
          .max(MAX_TOP)
          .optional()
          .describe(`Maximum number of results to return, up to ${MAX_TOP}.`),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        query: advancedWorkItemQuerySchema,
        total: z.number().int().nonnegative(),
        workItems: z.array(workItemSchema),
      }),
    },
    async (input) => {
      try {
        const result = await services.searchWorkItemsAdvanced(input);
        return createStructuredToolResult(
          summarizeCount("work item", result.workItems),
          {
            query: result.query,
            total: result.workItems.length,
            workItems: result.workItems,
          },
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "search_work_items_advanced");
      }
    },
  );

  server.registerTool(
    "export_work_items_full",
    {
      title: "Export Work Items Full",
      description:
        "Use this when you need a filtered set of fully expanded Azure DevOps work items for analysis or export, including optional comments, updates, revisions, attachments, links, and raw payloads.",
      inputSchema: exportWorkItemsFullInputSchema,
      annotations: readOnlyAnnotations,
      outputSchema: exportWorkItemsFullSchema,
    },
    async (input) => {
      try {
        const result = await services.exportWorkItemsFull(input);
        return createStructuredToolResult(
          summarizeCount("exported work item", result.workItems),
          exportWorkItemsFullOutput(result),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "export_work_items_full");
      }
    },
  );

  server.registerTool(
    "list_test_plans",
    {
      title: "List Test Plans",
      description:
        "Use this when you need the test plans available in a specific Azure DevOps project.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        total: z.number().int().nonnegative(),
        testPlans: z.array(testPlanSchema),
      }),
    },
    async ({ project }) => {
      try {
        const testPlans = await services.listTestPlans(project);
        return createStructuredToolResult(
          summarizeCount("test plan", testPlans),
          listTestPlansOutput(project, testPlans),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_test_plans");
      }
    },
  );

  server.registerTool(
    "get_test_plan",
    {
      title: "Get Test Plan",
      description:
        "Use this when you need the full metadata for one Azure DevOps test plan, including root suite, ownership, links, and optional raw payload.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Azure DevOps test plan ID."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps test plan payload."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testPlanFullSchema,
    },
    async (input) => {
      try {
        const testPlan = await services.getTestPlan(input);
        return createStructuredToolResult(
          `Loaded test plan ${testPlan.id} (${testPlan.name}).`,
          getTestPlanOutput(testPlan),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_test_plan");
      }
    },
  );

  server.registerTool(
    "get_test_plan_suites_tree",
    {
      title: "Get Test Plan Suites Tree",
      description:
        "Use this when you need the recursive Azure DevOps suite tree for one test plan, including nested children for analysis.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Azure DevOps test plan ID."),
        maxDepth: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Optional maximum suite tree depth. Omit to return the full tree."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw Azure DevOps suite payloads on each tree node."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testPlanSuitesTreeSchema,
    },
    async (input) => {
      try {
        const summary = await services.getTestPlanSuitesTree(input);
        return createStructuredToolResult(
          `Loaded suite tree with ${summary.totalSuites} suites for plan ${summary.planId}.`,
          getTestPlanSuitesTreeOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_test_plan_suites_tree");
      }
    },
  );

  server.registerTool(
    "get_test_suite",
    {
      title: "Get Test Suite",
      description:
        "Use this when you need the full metadata for one Azure DevOps test suite, including parent, children, and plan context.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Azure DevOps test plan ID."),
        suiteId: z.number().int().positive().describe("Azure DevOps test suite ID."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps suite payload."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testSuiteFullSchema,
    },
    async (input) => {
      try {
        const testSuite = await services.getTestSuite(input);
        return createStructuredToolResult(
          `Loaded test suite ${testSuite.id} (${testSuite.name}).`,
          getTestSuiteOutput(testSuite),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_test_suite");
      }
    },
  );

  server.registerTool(
    "list_test_suites",
    {
      title: "List Test Suites",
      description:
        "Use this when you need the test suites inside a specific Azure DevOps test plan.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Test plan ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        planId: z.number().int(),
        total: z.number().int().nonnegative(),
        testSuites: z.array(testSuiteSchema),
      }),
    },
    async ({ project, planId }) => {
      try {
        const testSuites = await services.listTestSuites(project, planId);
        return createStructuredToolResult(
          summarizeCount("test suite", testSuites),
          listTestSuitesOutput(project, planId, testSuites),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_test_suites");
      }
    },
  );

  server.registerTool(
    "list_test_points",
    {
      title: "List Test Points",
      description:
        "Use this when you need Execute-table style test point rows for one Azure DevOps test suite, including outcome, configuration, tester, and run context.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Azure DevOps test plan ID."),
        suiteId: z.number().int().positive().describe("Azure DevOps test suite ID."),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Optional internal page size for loading large point sets."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps point payload on each point."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testPointsListSchema,
    },
    async (input) => {
      try {
        const summary = await services.listTestPoints(input);
        return createStructuredToolResult(
          summarizeCount("test point", summary.points),
          listTestPointsOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_test_points");
      }
    },
  );

  server.registerTool(
    "list_test_cases",
    {
      title: "List Test Cases",
      description:
        "Use this when you need the test cases and point assignments inside a specific test suite.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Test plan ID."),
        suiteId: z.number().int().positive().describe("Test suite ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        planId: z.number().int(),
        suiteId: z.number().int(),
        total: z.number().int().nonnegative(),
        testCases: z.array(testCaseSchema),
      }),
    },
    async ({ project, planId, suiteId }) => {
      try {
        const testCases = await services.listTestCases(project, planId, suiteId);
        return createStructuredToolResult(
          summarizeCount("test case", testCases),
          listTestCasesOutput(project, planId, suiteId, testCases),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_test_cases");
      }
    },
  );

  server.registerTool(
    "list_test_cases_full",
    {
      title: "List Test Cases Full",
      description:
        "Use this when you need full suite-context test case details, including work item fields, parsed steps, parameters, shared steps, and linked test points.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Azure DevOps test plan ID."),
        suiteId: z.number().int().positive().describe("Azure DevOps test suite ID."),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Optional internal page size for nested point retrieval."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw Azure DevOps work item and nested point payloads."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testCasesFullListSchema,
    },
    async (input) => {
      try {
        const summary = await services.listTestCasesFull(input);
        return createStructuredToolResult(
          summarizeCount("test case", summary.testCases),
          listTestCasesFullOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_test_cases_full");
      }
    },
  );

  server.registerTool(
    "get_test_point_history",
    {
      title: "Get Test Point History",
      description:
        "Use this when you need the execution history for one Azure DevOps test point, including run outcome, configuration, and run-by context across historical runs.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Azure DevOps test plan ID."),
        suiteId: z.number().int().positive().describe("Azure DevOps test suite ID."),
        pointId: z.number().int().positive().describe("Azure DevOps test point ID."),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Optional internal page size for loading runs and results."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include the raw Azure DevOps result payload on each history entry."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testPointHistorySchema,
    },
    async (input) => {
      try {
        const summary = await services.getTestPointHistory(input);
        return createStructuredToolResult(
          `Loaded ${summary.totalHistoryEntries} history entries for test point ${summary.pointId}.`,
          getTestPointHistoryOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_test_point_history");
      }
    },
  );

  server.registerTool(
    "list_test_runs",
    {
      title: "List Test Runs",
      description:
        "Use this when you need the most recent Azure DevOps test runs in a project.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        top: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(`Maximum number of runs to return. Values above ${MAX_TOP} are clamped.`),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        top: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        testRuns: z.array(testRunSchema),
      }),
    },
    async ({ project, top }) => {
      try {
        const testRuns = await services.listTestRuns(project, top);
        return createStructuredToolResult(
          summarizeCount("test run", testRuns),
          listTestRunsOutput(project, clampTop(top, DEFAULT_RUN_TOP), testRuns),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_test_runs");
      }
    },
  );

  server.registerTool(
    "get_test_run_full",
    {
      title: "Get Test Run Full",
      description:
        "Use this when you need the full contents of one Azure DevOps test run, including results, configuration context, optional step details, attachments, and raw payloads.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        runId: z.number().int().positive().describe("Azure DevOps test run ID."),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Optional internal page size for run result pagination."),
        includeAttachments: z
          .boolean()
          .optional()
          .describe("When false, skip run attachment retrieval."),
        includeSteps: z
          .boolean()
          .optional()
          .describe("When false, skip step-level iteration and action details."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw Azure DevOps run and result payloads."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testRunFullSchema,
    },
    async (input) => {
      try {
        const summary = await services.getTestRunFull(input);
        return createStructuredToolResult(
          `Loaded test run ${summary.runId} with ${summary.results.length} results.`,
          getTestRunFullOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_test_run_full");
      }
    },
  );

  server.registerTool(
    "export_test_plan_full",
    {
      title: "Export Test Plan Full",
      description:
        "Use this when you need a single analytical export of a test plan, including suite tree, points, optional point history, run details, test cases, and raw payloads.",
      inputSchema: z.object({
        project: trimmedStringSchema.describe("Azure DevOps project name or ID."),
        planId: z.number().int().positive().describe("Azure DevOps test plan ID."),
        includeSuites: z
          .boolean()
          .optional()
          .describe("When false, omit suite metadata maps and tree payloads."),
        includePoints: z
          .boolean()
          .optional()
          .describe("When false, omit point rows unless needed for another include flag."),
        includePointHistory: z
          .boolean()
          .optional()
          .describe("When true, include point execution history keyed by point ID."),
        includeRuns: z
          .boolean()
          .optional()
          .describe("When true, include full test runs keyed by run ID."),
        includeTestCases: z
          .boolean()
          .optional()
          .describe("When true, include suite-context test case summaries keyed by work item ID."),
        includeRaw: z
          .boolean()
          .optional()
          .describe("When true, include raw Azure DevOps payloads on nested entities where available."),
        maxDepth: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Optional suite tree depth limit for export traversal."),
        suiteIds: z
          .array(z.number().int().positive())
          .optional()
          .describe("Optional subset of suite IDs to export instead of the full plan tree."),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Optional internal page size for points, runs, and results."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: exportTestPlanFullSchema,
    },
    async (input) => {
      try {
        const summary = await services.exportTestPlanFull(input);
        return createStructuredToolResult(
          `Exported test plan ${summary.planId} with ${summary.suiteTree.length} suite tree roots.`,
          exportTestPlanFullOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "export_test_plan_full");
      }
    },
  );

  server.registerTool(
    "list_pipelines",
    {
      title: "List Pipelines",
      description:
        "Use this when you need pipeline definitions for a specific Azure DevOps project.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        total: z.number().int().nonnegative(),
        pipelines: z.array(pipelineSchema),
      }),
    },
    async ({ project }) => {
      try {
        const pipelines = await services.listPipelines(project);
        return createStructuredToolResult(
          summarizeCount("pipeline", pipelines),
          listPipelinesOutput(project, pipelines),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_pipelines");
      }
    },
  );

  server.registerTool(
    "list_pipeline_runs",
    {
      title: "List Pipeline Runs",
      description:
        "Use this when you need recent pipeline build history for a project or a specific pipeline definition.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        definitionId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Optional build definition ID to limit results to one pipeline."),
        top: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(`Maximum number of runs to return. Values above ${MAX_TOP} are clamped.`),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        definitionId: z.number().int().optional(),
        top: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        pipelineRuns: z.array(pipelineRunSchema),
      }),
    },
    async ({ project, definitionId, top }) => {
      try {
        const pipelineRuns = await services.listPipelineRuns(project, definitionId, top);
        return createStructuredToolResult(
          summarizeCount("pipeline run", pipelineRuns),
          listPipelineRunsOutput(
            project,
            clampTop(top, DEFAULT_RUN_TOP),
            definitionId,
            pipelineRuns,
          ),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_pipeline_runs");
      }
    },
  );

  server.registerTool(
    "list_pipeline_artifacts",
    {
      title: "List Pipeline Artifacts",
      description:
        "Use this when you already know a pipeline run ID and need its published artifacts.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        runId: z
          .number()
          .int()
          .positive()
          .describe("Pipeline run ID, which matches the build ID returned by list_pipeline_runs."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        project: z.string(),
        runId: z.number().int(),
        total: z.number().int().nonnegative(),
        artifacts: z.array(pipelineArtifactSchema),
      }),
    },
    async ({ project, runId }) => {
      try {
        const artifacts = await services.listPipelineArtifacts(project, runId);
        return createStructuredToolResult(
          summarizeCount("pipeline artifact", artifacts),
          listPipelineArtifactsOutput(project, runId, artifacts),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "list_pipeline_artifacts");
      }
    },
  );

  server.registerTool(
    "get_my_daily_digest",
    {
      title: "Get My Daily Digest",
      description:
        "Use this when you need a combined daily view of your open work items, pending PR reviews, and recent failed pipelines.",
      inputSchema: z.object({
        project: z
          .string()
          .min(1)
          .optional()
          .describe("Optional Azure DevOps project name or ID to scope the digest."),
        myEmail: z
          .string()
          .email()
          .describe("Email address used to match assigned work items and pull request reviews."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        myWorkItems: z.array(dailyDigestWorkItemSchema),
        prsPendingMyReview: z.array(dailyDigestPullRequestSchema),
        failedPipelines: z.array(dailyDigestFailedPipelineSchema),
        generatedAt: z.string(),
      }),
    },
    async (input) => {
      try {
        const summary = await services.getMyDailyDigest(input);
        return createStructuredToolResult(
          `Compiled daily digest with ${summary.myWorkItems.length} work items, ${summary.prsPendingMyReview.length} pull requests, and ${summary.failedPipelines.length} failed pipelines.`,
          dailyDigestOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_my_daily_digest");
      }
    },
  );

  server.registerTool(
    "get_blocked_items",
    {
      title: "Get Blocked Items",
      description:
        "Use this when you need stale blocked work items for a project, optionally scoped to a team or iteration.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        team: z
          .string()
          .min(1)
          .optional()
          .describe("Optional team name used to resolve the current iteration."),
        iterationPath: z
          .string()
          .min(1)
          .optional()
          .describe("Optional iteration path to use instead of the team's current iteration."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: z.object({
        blockedItems: z.array(blockedItemSchema),
        totalBlocked: z.number().int().nonnegative(),
        project: z.string(),
      }),
    },
    async (input) => {
      try {
        const result = await services.getBlockedItems(input);
        return createStructuredToolResult(
          summarizeCount("blocked work item", result.blockedItems),
          blockedItemsOutput(result.project, result.blockedItems),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_blocked_items");
      }
    },
  );

  server.registerTool(
    "get_sprint_summary",
    {
      title: "Get Sprint Summary",
      description:
        "Use this when you need the current sprint window, state counts, completion percentage, and at-risk items for a team.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        team: z.string().min(1).describe("Azure DevOps team name."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: sprintSummarySchema,
    },
    async (input) => {
      try {
        const summary = await services.getSprintSummary(input);
        return createStructuredToolResult(
          `Summarized the current sprint with ${summary.totalItems} work items and ${summary.atRiskItems.length} at-risk items.`,
          sprintSummaryOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_sprint_summary");
      }
    },
  );

  server.registerTool(
    "get_sprint_capacity",
    {
      title: "Get Sprint Capacity",
      description:
        "Use this when you need the current sprint dates, team capacity, time off, and total available hours for a team.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        team: z.string().min(1).describe("Azure DevOps team name."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: sprintCapacitySchema,
    },
    async (input) => {
      try {
        const summary = await services.getSprintCapacity(input);
        return createStructuredToolResult(
          `Calculated sprint capacity for ${summary.members.length} team members with ${summary.totalAvailableHours} available hours.`,
          sprintCapacityOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_sprint_capacity");
      }
    },
  );

  server.registerTool(
    "get_cross_project_dependencies",
    {
      title: "Get Cross-Project Dependencies",
      description:
        "Use this when you need dependency links for one work item, including blockers or dependents that may live in other projects.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        workItemId: z.number().int().positive().describe("Azure DevOps work item ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: crossProjectDependenciesSchema,
    },
    async (input) => {
      try {
        const summary = await services.getCrossProjectDependencies(input);
        return createStructuredToolResult(
          summarizeDependencyCount(summary.blockedBy, summary.blocking),
          crossProjectDependenciesOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_cross_project_dependencies");
      }
    },
  );

  server.registerTool(
    "get_dashboard_widget_data",
    {
      title: "Get Dashboard Widget Data",
      description:
        "Use this when you need to inspect one Azure DevOps dashboard widget, parse its settings, and load the work items behind its saved query when available.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        dashboardId: z.string().min(1).describe("Azure DevOps dashboard ID."),
        widgetId: z.string().min(1).describe("Azure DevOps widget ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: dashboardWidgetDataSchema,
    },
    async (input) => {
      try {
        const summary = await services.getDashboardWidgetData(input);
        const queryResultCount = summary.queryResults?.length ?? 0;
        return createStructuredToolResult(
          `Loaded dashboard widget "${summary.widgetName}" with ${queryResultCount} query result items.`,
          dashboardWidgetDataOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "get_dashboard_widget_data");
      }
    },
  );

  server.registerTool(
    "analyze_pipeline_failure",
    {
      title: "Analyze Pipeline Failure",
      description:
        "Use this when you need build details, failed tasks, relevant logs, and a concise failure summary for one pipeline run.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        runId: z.number().int().positive().describe("Pipeline run ID / build ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: pipelineFailureAnalysisSchema,
    },
    async (input) => {
      try {
        const analysis = await services.analyzePipelineFailure(input);
        return createStructuredToolResult(
          `Analyzed pipeline run ${analysis.buildNumber} and found ${analysis.failedTasks.length} failed tasks.`,
          pipelineFailureOutput(analysis),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "analyze_pipeline_failure");
      }
    },
  );

  server.registerTool(
    "analyze_test_failure_impact",
    {
      title: "Analyze Test Failure Impact",
      description:
        "Use this when you need failed test results, linked work items, and a concise impact summary for one Azure DevOps test run.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        testRunId: z.number().int().positive().describe("Azure DevOps test run ID."),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: testFailureImpactSchema,
    },
    async (input) => {
      try {
        const summary = await services.analyzeTestFailureImpact(input);
        return createStructuredToolResult(
          `Analyzed ${summary.failedTests.length} failed tests for run ${summary.testRun.id}.`,
          testFailureImpactOutput(summary),
        );
      } catch (error) {
        return createToolErrorResult(error, logger, "analyze_test_failure_impact");
      }
    },
  );

  server.registerTool(
    "get_wiki_page",
    {
      title: "Get Wiki Page",
      description:
        "Use this when you need the Markdown content of a specific Azure DevOps wiki page.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
        wikiIdentifier: z.string().min(1).describe("Wiki name or wiki ID."),
        path: z
          .string()
          .min(1)
          .describe('Wiki page path, for example "/Home" or "/Setup/Installation".'),
      }),
      annotations: readOnlyAnnotations,
      outputSchema: wikiPageSchema,
    },
    async ({ project, wikiIdentifier, path }) => {
      try {
        const page = await services.getWikiPage(project, wikiIdentifier, path);
        const text = page.isTruncated
          ? `Retrieved wiki page ${page.path}. Content was truncated for safety.`
          : `Retrieved wiki page ${page.path}.`;
        return createStructuredToolResult(text, page as WikiPageSummary);
      } catch (error) {
        return createToolErrorResult(error, logger, "get_wiki_page");
      }
    },
  );

  return server;
}
