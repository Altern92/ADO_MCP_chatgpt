export type ProjectSummary = {
  readonly id: string;
  readonly name: string;
  readonly state: string | null;
  readonly visibility: string | null;
  readonly url: string | null;
};

export type RepositorySummary = {
  readonly id: string;
  readonly name: string;
  readonly defaultBranch: string | null;
  readonly remoteUrl: string | null;
  readonly webUrl: string | null;
};

export type PullRequestSummary = {
  readonly id: number;
  readonly title: string;
  readonly status: string | null;
  readonly createdBy: string | null;
  readonly sourceBranch: string | null;
  readonly targetBranch: string | null;
  readonly createdDate: string | null;
  readonly url: string | null;
};

export type PullRequestRepositoryContext = {
  readonly id: string | null;
  readonly name: string | null;
  readonly project: string | null;
  readonly defaultBranch: string | null;
  readonly remoteUrl: string | null;
  readonly webUrl: string | null;
  readonly url: string | null;
};

export type PullRequestReviewerSummary = {
  readonly id: string | null;
  readonly displayName: string | null;
  readonly uniqueName: string | null;
  readonly vote: number | null;
  readonly isRequired: boolean;
  readonly hasDeclined: boolean;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type LinkedPullRequestSummary = {
  readonly pullRequestId: number;
  readonly title: string;
  readonly repository: string | null;
  readonly repositoryId: string | null;
  readonly project: string | null;
  readonly status: string | null;
  readonly createdBy: string | null;
  readonly createdDate: string | null;
  readonly sourceBranch: string | null;
  readonly targetBranch: string | null;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type PullRequestSearchResultsByWorkItem = {
  readonly project: string;
  readonly workItemId: number;
  readonly total: number;
  readonly pullRequests: readonly LinkedPullRequestSummary[];
};

export type PullRequestFull = {
  readonly pullRequestId: number;
  readonly title: string;
  readonly description: string | null;
  readonly status: string | null;
  readonly createdBy: string | null;
  readonly createdDate: string | null;
  readonly closedDate: string | null;
  readonly sourceBranch: string | null;
  readonly targetBranch: string | null;
  readonly mergeStatus: string | null;
  readonly completionStatus: string | null;
  readonly isDraft: boolean;
  readonly repository: PullRequestRepositoryContext;
  readonly url: string | null;
  readonly workItems?: readonly WorkItemSummary[];
  readonly reviewers?: readonly PullRequestReviewerSummary[];
  readonly raw?: unknown;
};

export type GitCommitSummary = {
  readonly commitId: string;
  readonly author: string | null;
  readonly authorDate: string | null;
  readonly committer: string | null;
  readonly commitDate: string | null;
  readonly comment: string | null;
  readonly commentTruncated: string | null;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type GitCommitStatsSummary = {
  readonly changedFiles: number;
  readonly additions: number | null;
  readonly deletions: number | null;
};

export type CommitFull = {
  readonly commitId: string;
  readonly comment: string | null;
  readonly author: string | null;
  readonly authorDate: string | null;
  readonly committer: string | null;
  readonly commitDate: string | null;
  readonly url: string | null;
  readonly repository: PullRequestRepositoryContext;
  readonly changedFiles: readonly PullRequestFileChangeSummary[];
  readonly stats: GitCommitStatsSummary | null;
  readonly raw?: unknown;
};

export type LinkedCommitSummary = {
  readonly commitId: string;
  readonly comment: string | null;
  readonly author: string | null;
  readonly authorDate: string | null;
  readonly committer: string | null;
  readonly commitDate: string | null;
  readonly repository: string | null;
  readonly repositoryId: string | null;
  readonly project: string | null;
  readonly pullRequestIds: readonly number[];
  readonly url: string | null;
  readonly changedFiles?: readonly PullRequestFileChangeSummary[];
  readonly raw?: unknown;
};

export type CommitSearchResultsByWorkItem = {
  readonly project: string;
  readonly workItemId: number;
  readonly total: number;
  readonly commits: readonly LinkedCommitSummary[];
};

export type PullRequestCommitsList = {
  readonly project: string;
  readonly repository: string;
  readonly pullRequestId: number;
  readonly total: number;
  readonly commits: readonly GitCommitSummary[];
};

export type PullRequestFileChangeSummary = {
  readonly path: string | null;
  readonly originalPath: string | null;
  readonly changeType: string | null;
  readonly itemType: string | null;
  readonly objectId: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly patch?: string | null;
  readonly raw?: unknown;
};

export type PullRequestDiff = {
  readonly project: string;
  readonly repository: string;
  readonly pullRequestId: number;
  readonly iterationId: number | null;
  readonly sourceCommitId: string | null;
  readonly targetCommitId: string | null;
  readonly totalFiles: number;
  readonly files: readonly PullRequestFileChangeSummary[];
  readonly raw?: unknown;
};

export type WorkItemSummary = {
  readonly id: number;
  readonly project: string | null;
  readonly title: string | null;
  readonly state: string | null;
  readonly workItemType: string | null;
  readonly assignedTo: string | null;
  readonly createdBy: string | null;
  readonly changedBy: string | null;
  readonly createdDate: string | null;
  readonly changedDate: string | null;
  readonly closedDate: string | null;
  readonly areaPath: string | null;
  readonly iterationPath: string | null;
  readonly tags: string | null;
  readonly reason: string | null;
  readonly priority: number | null;
  readonly severity: string | null;
  readonly commentCount: number | null;
  readonly activityDate: string | null;
  readonly description: string | null;
  readonly url: string | null;
};

export type WorkItemRelationSummary = {
  readonly rel: string | null;
  readonly url: string | null;
  readonly linkedWorkItemId: number | null;
  readonly attributes: Record<string, unknown>;
};

export type WorkItemLinksSummary = Record<string, string | null>;

export type WorkItemCommentSummary = {
  readonly id: number | null;
  readonly commentId: number | null;
  readonly workItemId: number | null;
  readonly text: string | null;
  readonly renderedText: string | null;
  readonly format: string | null;
  readonly createdBy: string | null;
  readonly modifiedBy: string | null;
  readonly createdDate: string | null;
  readonly modifiedDate: string | null;
  readonly isDeleted: boolean;
  readonly version: number | null;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemUpdateSummary = {
  readonly id: number | null;
  readonly updateId: number | null;
  readonly workItemId: number | null;
  readonly rev: number | null;
  readonly revisedBy: string | null;
  readonly revisedDate: string | null;
  readonly changedFields: readonly string[];
  readonly fields: Record<string, unknown>;
  readonly relations: Record<string, readonly WorkItemRelationSummary[]>;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemRevisionSummary = {
  readonly id: number | null;
  readonly workItemId: number | null;
  readonly rev: number | null;
  readonly changedBy: string | null;
  readonly changedDate: string | null;
  readonly createdDate: string | null;
  readonly state: string | null;
  readonly title: string | null;
  readonly workItemType: string | null;
  readonly fields: Record<string, unknown>;
  readonly relations: readonly WorkItemRelationSummary[];
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemAttachmentSummary = {
  readonly id: string | null;
  readonly rel: string | null;
  readonly url: string | null;
  readonly name: string | null;
  readonly authorizedDate: string | null;
  readonly resourceSize: number | null;
  readonly comment: string | null;
  readonly attributes: Record<string, unknown>;
};

export type WorkItemFull = WorkItemSummary & {
  readonly rev: number | null;
  readonly fields: Record<string, unknown>;
  readonly relations?: readonly WorkItemRelationSummary[];
  readonly links?: WorkItemLinksSummary;
  readonly _links?: Record<string, unknown>;
  readonly commentVersionRef?: Record<string, unknown> | null;
  readonly comments?: readonly WorkItemCommentSummary[];
  readonly updates?: readonly WorkItemUpdateSummary[];
  readonly revisions?: readonly WorkItemRevisionSummary[];
  readonly attachments?: readonly WorkItemAttachmentSummary[];
  readonly raw?: unknown;
};

export type WorkItemAuditPagingStrategy = "none" | "continuation" | "skip";

export type WorkItemAuditPagingSummary = {
  readonly strategy: WorkItemAuditPagingStrategy;
  readonly pageSize: number;
  readonly pagesFetched: number;
};

export type WorkItemCommentsList = {
  readonly workItemId: number;
  readonly project: string | null;
  readonly totalCount: number;
  readonly returned: number;
  readonly paging: WorkItemAuditPagingSummary;
  readonly comments: readonly WorkItemCommentSummary[];
};

export type WorkItemUpdatesList = {
  readonly workItemId: number;
  readonly project: string | null;
  readonly totalCount: number;
  readonly returned: number;
  readonly paging: WorkItemAuditPagingSummary;
  readonly updates: readonly WorkItemUpdateSummary[];
};

export type WorkItemRevisionsList = {
  readonly workItemId: number;
  readonly project: string | null;
  readonly totalCount: number;
  readonly returned: number;
  readonly paging: WorkItemAuditPagingSummary;
  readonly revisions: readonly WorkItemRevisionSummary[];
};

export type ExportedWorkItemsFullSummary = {
  readonly query: unknown;
  readonly totalMatched: number;
  readonly returned: number;
  readonly workItems: readonly WorkItemFull[];
};

export type TraceabilityRelationDirection =
  | "forward"
  | "reverse"
  | "bidirectional"
  | "unknown";

export type WorkItemLinkTypeSummary = {
  readonly referenceName: string;
  readonly name: string;
  readonly oppositeReferenceName: string | null;
  readonly topology: string | null;
  readonly category: string;
  readonly direction: TraceabilityRelationDirection;
  readonly enabled: boolean;
  readonly editable: boolean;
  readonly acyclic: boolean;
  readonly directional: boolean;
  readonly singleTarget: boolean;
  readonly usage: string | null;
  readonly url: string | null;
  readonly attributes: Record<string, unknown>;
};

export type TraceabilityGraphNode = WorkItemSummary & {
  readonly depth: number;
  readonly isRoot: boolean;
};

export type TraceabilityGraphEdge = {
  readonly sourceId: number;
  readonly targetId: number;
  readonly sourceProject: string | null;
  readonly targetProject: string | null;
  readonly referenceName: string;
  readonly name: string | null;
  readonly oppositeReferenceName: string | null;
  readonly topology: string | null;
  readonly category: string;
  readonly direction: TraceabilityRelationDirection;
  readonly isCrossProject: boolean;
  readonly attributes: Record<string, unknown>;
};

export type TraceabilitySkippedRelationReason =
  | "filtered_out"
  | "non_work_item_relation"
  | "not_allowed"
  | "not_found";

export type TraceabilitySkippedRelation = {
  readonly sourceId: number;
  readonly sourceProject: string | null;
  readonly referenceName: string | null;
  readonly targetId: number | null;
  readonly reason: TraceabilitySkippedRelationReason;
};

export type WorkItemRelationsGraph = {
  readonly rootId: number;
  readonly rootProject: string | null;
  readonly maxDepth: number;
  readonly relationTypeFilter: readonly string[];
  readonly nodes: readonly TraceabilityGraphNode[];
  readonly edges: readonly TraceabilityGraphEdge[];
  readonly skippedRelations: readonly TraceabilitySkippedRelation[];
  readonly relationTypesEncountered: readonly string[];
  readonly crossProjectNodeCount: number;
  readonly crossProjectEdgeCount: number;
  readonly traversal: {
    readonly visitedNodeCount: number;
    readonly exploredEdgeCount: number;
    readonly skippedRelationCount: number;
    readonly truncatedAtDepth: boolean;
  };
};

export type TraceabilityChainStep = {
  readonly fromId: number;
  readonly toId: number;
  readonly referenceName: string;
  readonly category: string;
  readonly direction: TraceabilityRelationDirection;
};

export type TraceabilityChain = {
  readonly chainId: string;
  readonly nodeIds: readonly number[];
  readonly steps: readonly TraceabilityChainStep[];
  readonly terminalNodeId: number;
  readonly terminalNodeProject: string | null;
  readonly terminalWorkItemType: string | null;
  readonly containsCrossProjectItems: boolean;
  readonly cycleDetected: boolean;
  readonly endsAtMaxDepth: boolean;
};

export type TraceabilityChainSummary = WorkItemRelationsGraph & {
  readonly chains: readonly TraceabilityChain[];
  readonly totalChains: number;
};

export type LinkedWorkItemSummary = TraceabilityGraphNode & {
  readonly isCrossProject: boolean;
  readonly pathCount: number;
  readonly relationTypes: readonly string[];
  readonly relationCategories: readonly string[];
  readonly incomingRelations: readonly TraceabilityGraphEdge[];
  readonly outgoingRelations: readonly TraceabilityGraphEdge[];
  readonly pathsFromRoot: readonly TraceabilityChain[];
};

export type LinkedWorkItemsSummary = {
  readonly rootId: number;
  readonly rootProject: string | null;
  readonly root: TraceabilityGraphNode;
  readonly maxDepth: number;
  readonly relationTypeFilter: readonly string[];
  readonly linkedWorkItems: readonly LinkedWorkItemSummary[];
  readonly totalLinkedWorkItems: number;
  readonly edges: readonly TraceabilityGraphEdge[];
  readonly skippedRelations: readonly TraceabilitySkippedRelation[];
  readonly relationTypesEncountered: readonly string[];
  readonly crossProjectNodeCount: number;
  readonly crossProjectEdgeCount: number;
  readonly traversal: {
    readonly visitedNodeCount: number;
    readonly exploredEdgeCount: number;
    readonly skippedRelationCount: number;
    readonly truncatedAtDepth: boolean;
  };
};

export type WorkItemTestLinkSuiteSummary = {
  readonly id: number;
  readonly name: string | null;
  readonly planId: number | null;
  readonly planName: string | null;
  readonly project: string | null;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemTestLinkPlanSummary = {
  readonly id: number;
  readonly name: string | null;
  readonly project: string | null;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemTestLinkRecentRunSummary = TestRunSummary & {
  readonly project: string;
  readonly pointIds: readonly number[];
  readonly suiteIds: readonly number[];
  readonly planIds: readonly number[];
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemTestLinkSummary = {
  readonly relationType: string;
  readonly relationName: string | null;
  readonly relationCategory: string;
  readonly relationDirection: TraceabilityRelationDirection;
  readonly testCaseId: number;
  readonly testCaseTitle: string | null;
  readonly testCaseState: string | null;
  readonly testCaseProject: string | null;
  readonly isCrossProject: boolean;
  readonly suiteIds: readonly number[];
  readonly planIds: readonly number[];
  readonly recentRuns: readonly WorkItemTestLinkRecentRunSummary[];
  readonly testCase?: WorkItemSummary;
  readonly suites?: readonly WorkItemTestLinkSuiteSummary[];
  readonly plans?: readonly WorkItemTestLinkPlanSummary[];
  readonly raw?: unknown;
};

export type WorkItemTestLinksSummary = {
  readonly project: string;
  readonly workItemId: number;
  readonly workItem: WorkItemSummary;
  readonly testLinks: readonly WorkItemTestLinkSummary[];
  readonly totalTestLinks: number;
  readonly totalTestCases: number;
  readonly totalSuites: number;
  readonly totalPlans: number;
  readonly totalRecentRuns: number;
  readonly relationTypesEncountered: readonly string[];
  readonly skippedRelations: readonly TraceabilitySkippedRelation[];
};

export type TestCoverageOutcome = "passed" | "failed" | "not_executed" | "unknown";

export type UserStoryTestCoverageStatus =
  | "no_tests"
  | "passed"
  | "failed"
  | "not_executed"
  | "unknown"
  | "partial";

export type UserStoryTestCoverageSummary = {
  readonly totalLinkedTestCases: number;
  readonly withSuites: number;
  readonly withPlans: number;
  readonly withRecentRuns: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly notExecutedCount: number;
  readonly unknownCount: number;
};

export type UserStoryLinkedTestCaseCoverage = {
  readonly testCaseId: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly relationType: string;
  readonly suiteIds: readonly number[];
  readonly planIds: readonly number[];
  readonly recentRuns: readonly WorkItemTestLinkRecentRunSummary[];
  readonly latestOutcome: TestCoverageOutcome;
  readonly raw?: unknown;
};

export type UserStorySuiteCoverageSummary = {
  readonly suiteId: number;
  readonly suiteName: string | null;
  readonly planId: number | null;
  readonly planName: string | null;
  readonly project: string | null;
  readonly linkedTestCaseIds: readonly number[];
  readonly recentRunIds: readonly number[];
  readonly summary: UserStoryTestCoverageSummary;
  readonly coverageStatus: UserStoryTestCoverageStatus;
};

export type UserStoryPlanCoverageSummary = {
  readonly planId: number;
  readonly planName: string | null;
  readonly project: string | null;
  readonly linkedTestCaseIds: readonly number[];
  readonly recentRunIds: readonly number[];
  readonly summary: UserStoryTestCoverageSummary;
  readonly coverageStatus: UserStoryTestCoverageStatus;
};

export type UserStoryRecentRunCoverageSummary = WorkItemTestLinkRecentRunSummary & {
  readonly linkedTestCaseIds: readonly number[];
  readonly summary: UserStoryTestCoverageSummary;
  readonly coverageStatus: UserStoryTestCoverageStatus;
};

export type UserStoryTestCoverage = {
  readonly project: string;
  readonly workItemId: number;
  readonly workItem: WorkItemSummary;
  readonly summary: UserStoryTestCoverageSummary;
  readonly linkedTestCases: readonly UserStoryLinkedTestCaseCoverage[];
  readonly suiteCoverage: readonly UserStorySuiteCoverageSummary[];
  readonly planCoverage: readonly UserStoryPlanCoverageSummary[];
  readonly recentRuns: readonly UserStoryRecentRunCoverageSummary[];
  readonly coverageStatus: UserStoryTestCoverageStatus;
  readonly raw?: unknown;
};

export type RequirementTraceabilityStatus =
  | "complete"
  | "partial"
  | "missing_tests"
  | "missing_execution"
  | "at_risk";

export type RequirementTraceabilityGaps = {
  readonly hasNoLinkedTestCases: boolean;
  readonly hasTestCaseWithoutSuite: boolean;
  readonly hasTestCaseWithoutPlan: boolean;
  readonly hasTestCaseWithoutRecentRun: boolean;
  readonly hasFailedTests: boolean;
  readonly hasUnknownOutcomes: boolean;
  readonly missingSuiteTestCaseIds: readonly number[];
  readonly missingPlanTestCaseIds: readonly number[];
  readonly missingRecentRunTestCaseIds: readonly number[];
  readonly failedTestCaseIds: readonly number[];
  readonly unknownOutcomeTestCaseIds: readonly number[];
};

export type RequirementTraceabilityReport = {
  readonly project: string;
  readonly workItemId: number;
  readonly workItem: WorkItemSummary;
  readonly summary: UserStoryTestCoverageSummary;
  readonly linkedTestCases: readonly UserStoryLinkedTestCaseCoverage[];
  readonly suiteCoverage: readonly UserStorySuiteCoverageSummary[];
  readonly planCoverage: readonly UserStoryPlanCoverageSummary[];
  readonly recentRuns: readonly UserStoryRecentRunCoverageSummary[];
  readonly coverageStatus: UserStoryTestCoverageStatus;
  readonly gaps: RequirementTraceabilityGaps;
  readonly traceabilityStatus: RequirementTraceabilityStatus;
  readonly raw?: unknown;
};

export type WorkItemTypeReferenceSummary = {
  readonly name: string;
  readonly url: string | null;
};

export type WorkItemCategorySummary = {
  readonly name: string;
  readonly referenceName: string | null;
  readonly defaultWorkItemType: WorkItemTypeReferenceSummary | null;
  readonly workItemTypes: readonly WorkItemTypeReferenceSummary[];
  readonly url: string | null;
};

export type WorkItemTypeIconSummary = {
  readonly id: string | null;
  readonly url: string | null;
};

export type WorkItemTypeStateSummary = {
  readonly name: string;
  readonly color: string | null;
  readonly category: string | null;
};

export type WorkItemTypeFieldSummary = {
  readonly name: string;
  readonly referenceName: string | null;
  readonly alwaysRequired: boolean;
  readonly url: string | null;
};

export type WorkItemTypeSummary = {
  readonly name: string;
  readonly referenceName: string | null;
  readonly description: string | null;
  readonly color: string | null;
  readonly icon: WorkItemTypeIconSummary | null;
  readonly isDisabled: boolean;
  readonly states: readonly WorkItemTypeStateSummary[];
  readonly fields: readonly WorkItemTypeFieldSummary[];
  readonly url: string | null;
  readonly categoryReferenceName: string | null;
  readonly categoryName: string | null;
  readonly raw?: unknown;
};

export type WorkItemFieldSupportedOperationSummary = {
  readonly name: string;
  readonly referenceName: string | null;
};

export type WorkItemFieldSummary = {
  readonly name: string;
  readonly referenceName: string;
  readonly type: string | null;
  readonly readOnly: boolean;
  readonly isIdentity: boolean;
  readonly isPicklist: boolean;
  readonly supportedOperations: readonly WorkItemFieldSupportedOperationSummary[];
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemFieldsCatalog = {
  readonly project: string;
  readonly total: number;
  readonly fields: readonly WorkItemFieldSummary[];
};

export type AreaPathNodeSummary = {
  readonly path: string;
  readonly name: string;
  readonly hasChildren: boolean;
  readonly children: readonly AreaPathNodeSummary[];
  readonly raw?: unknown;
};

export type AreaPathsCatalog = {
  readonly project: string;
  readonly mode: "tree" | "flat";
  readonly depth: number;
  readonly total: number;
  readonly paths: readonly AreaPathNodeSummary[];
};

export type IterationPathNodeSummary = {
  readonly path: string;
  readonly name: string;
  readonly startDate: string | null;
  readonly finishDate: string | null;
  readonly hasChildren: boolean;
  readonly children: readonly IterationPathNodeSummary[];
  readonly raw?: unknown;
};

export type IterationPathsCatalog = {
  readonly project: string;
  readonly mode: "tree" | "flat";
  readonly depth: number;
  readonly total: number;
  readonly paths: readonly IterationPathNodeSummary[];
};

export type WorkItemTagSummary = {
  readonly name: string;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type WorkItemTagsCatalog = {
  readonly project: string;
  readonly total: number;
  readonly tags: readonly WorkItemTagSummary[];
};

export type ResolvedIdentitySummary = {
  readonly displayName: string | null;
  readonly uniqueName: string | null;
  readonly descriptor: string | null;
  readonly id: string | null;
  readonly url: string | null;
  readonly raw?: unknown;
};

export type ResolvedIdentityCatalog = {
  readonly query: string;
  readonly project: string | null;
  readonly total: number;
  readonly identities: readonly ResolvedIdentitySummary[];
};

export type SavedQuerySummary = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly isFolder: boolean;
  readonly hasChildren: boolean;
  readonly queryType: string | null;
  readonly wiql?: string | null;
  readonly url: string | null;
  readonly children: readonly SavedQuerySummary[];
  readonly raw?: unknown;
};

export type SavedQueriesCatalog = {
  readonly project: string;
  readonly mode: "tree" | "flat";
  readonly depth: number;
  readonly total: number;
  readonly queries: readonly SavedQuerySummary[];
};

export type SavedQueryExecutionSummary = {
  readonly project: string;
  readonly query: SavedQuerySummary;
  readonly wiql: string | null;
  readonly total: number;
  readonly returned: number;
  readonly workItemIds: readonly number[];
  readonly workItems?: readonly WorkItemFull[];
  readonly raw?: unknown;
};

export type WorkItemsDeltaExport = {
  readonly project: string;
  readonly changedSince: string;
  readonly total: number;
  readonly returned: number;
  readonly workItemIds: readonly number[];
  readonly workItems?: readonly WorkItemFull[];
  readonly updatesByWorkItemId?: Record<string, readonly WorkItemUpdateSummary[]>;
  readonly revisionsByWorkItemId?: Record<string, readonly WorkItemRevisionSummary[]>;
  readonly raw?: unknown;
};

export type TraceabilityDatasetScopeSummary = {
  readonly source: "search" | "saved_query";
  readonly totalMatched: number;
  readonly returned: number;
  readonly maxItems: number;
  readonly searchQuery?: unknown;
  readonly savedQuery?: SavedQuerySummary;
};

export type TraceabilityDatasetExport = {
  readonly project: string;
  readonly scope: TraceabilityDatasetScopeSummary;
  readonly workItemIds: readonly number[];
  readonly workItems?: readonly WorkItemFull[];
  readonly testLinksByWorkItemId?: Record<string, WorkItemTestLinksSummary>;
  readonly coverageByWorkItemId?: Record<string, RequirementTraceabilityReport>;
  readonly pullRequestsByWorkItemId?: Record<string, readonly LinkedPullRequestSummary[]>;
  readonly commitsByWorkItemId?: Record<string, readonly LinkedCommitSummary[]>;
  readonly raw?: unknown;
};

export type SimilarityReasonKind =
  | "title"
  | "description"
  | "tags"
  | "areaPath"
  | "iterationPath"
  | "workItemType"
  | "assignedTo"
  | "createdBy"
  | "customField"
  | "linkedArtifact";

export type SimilarityReasonSummary = {
  readonly kind: SimilarityReasonKind;
  readonly score: number;
  readonly description: string;
};

export type SimilarWorkItemCandidateSummary = {
  readonly candidateId: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly project: string | null;
  readonly workItemType: string | null;
  readonly url: string | null;
  readonly similarityScore: number;
  readonly reasons: readonly SimilarityReasonSummary[];
  readonly raw?: unknown;
};

export type SimilarWorkItemsResult = {
  readonly project: string;
  readonly workItemId: number;
  readonly total: number;
  readonly candidates: readonly SimilarWorkItemCandidateSummary[];
};

export type DuplicateCandidateSummary = {
  readonly sourceWorkItemId: number;
  readonly candidateId: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly project: string | null;
  readonly workItemType: string | null;
  readonly url: string | null;
  readonly duplicateScore: number;
  readonly reasons: readonly SimilarityReasonSummary[];
  readonly signals: Record<string, unknown>;
  readonly raw?: unknown;
};

export type DuplicateCandidatesResult = {
  readonly project: string;
  readonly sourceWorkItemId: number;
  readonly total: number;
  readonly candidates: readonly DuplicateCandidateSummary[];
};

export type SimilarityClusterSummary = {
  readonly clusterId: string;
  readonly memberIds: readonly number[];
  readonly summary: string;
  readonly commonSignals: readonly string[];
  readonly raw?: unknown;
};

export type SimilarityClustersResult = {
  readonly project: string;
  readonly totalClusters: number;
  readonly clusters: readonly SimilarityClusterSummary[];
};

export type TestPlanSummary = {
  readonly id: number;
  readonly name: string;
  readonly state: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly iteration: string | null;
  readonly areaPath: string | null;
};

export type TestSuiteSummary = {
  readonly id: number;
  readonly name: string;
  readonly suiteType: string | null;
  readonly parentSuiteId: number | null;
  readonly testCaseCount: number | null;
};

export type TestPointAssignmentSummary = {
  readonly tester: string | null;
  readonly configuration: string | null;
};

export type TestCaseSummary = {
  readonly workItemId: number;
  readonly workItemName: string | null;
  readonly pointAssignments: readonly TestPointAssignmentSummary[];
};

export type TestCaseStepKind = "action" | "sharedStep";

export type TestCaseStepSummary = {
  readonly index: number;
  readonly kind: TestCaseStepKind;
  readonly actionText: string | null;
  readonly expectedResult: string | null;
  readonly sharedStepId: number | null;
  readonly sharedStepTitle: string | null;
};

export type TestCaseParameterDefinitionSummary = {
  readonly name: string;
  readonly bind: string | null;
};

export type TestCaseParametersSummary = {
  readonly definitions: readonly TestCaseParameterDefinitionSummary[];
  readonly rows: readonly Record<string, string | null>[];
};

export type TestCaseSharedStepSummary = {
  readonly workItemId: number;
  readonly title: string | null;
  readonly url: string | null;
};

export type TestCaseFullSummary = {
  readonly workItemId: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly priority: number | null;
  readonly assignedTo: string | null;
  readonly automationStatus: string | null;
  readonly areaPath: string | null;
  readonly iterationPath: string | null;
  readonly steps: readonly TestCaseStepSummary[];
  readonly parameters: TestCaseParametersSummary | null;
  readonly sharedSteps: readonly TestCaseSharedStepSummary[];
  readonly points: readonly TestPointSummary[];
  readonly raw?: unknown;
};

export type TestCasesFullList = {
  readonly project: string;
  readonly planId: number;
  readonly suiteId: number;
  readonly totalCount: number;
  readonly testCases: readonly TestCaseFullSummary[];
};

export type TestRunSummary = {
  readonly id: number;
  readonly name: string;
  readonly state: string | null;
  readonly totalTests: number | null;
  readonly passedTests: number | null;
  readonly failedTests: number | null;
  readonly startedDate: string | null;
  readonly completedDate: string | null;
};

export type TestManagementPagingStrategy = "none" | "continuation" | "skip";

export type TestManagementPagingSummary = {
  readonly strategy: TestManagementPagingStrategy;
  readonly pageSize: number;
  readonly pagesFetched: number;
};

export type TestEntityReferenceSummary = {
  readonly id: number | null;
  readonly name: string | null;
  readonly url: string | null;
};

export type TestConfigurationSummary = TestEntityReferenceSummary & {
  readonly isDefault: boolean;
  readonly state: string | null;
};

export type TestPlanFull = TestPlanSummary & {
  readonly rootSuiteId: number | null;
  readonly owner: string | null;
  readonly createdBy: string | null;
  readonly createdDate: string | null;
  readonly updatedBy: string | null;
  readonly updatedDate: string | null;
  readonly revision: number | null;
  readonly url: string | null;
  readonly _links?: Record<string, unknown>;
  readonly raw?: unknown;
};

export type TestSuiteTreeNode = {
  readonly id: number;
  readonly name: string;
  readonly planId: number;
  readonly parentSuiteId: number | null;
  readonly suiteType: string | null;
  readonly testCaseCount: number | null;
  readonly requirementId: number | null;
  readonly queryString: string | null;
  readonly inheritDefaultConfigurations: boolean;
  readonly defaultConfigurations: readonly TestConfigurationSummary[];
  readonly state: string | null;
  readonly url: string | null;
  readonly children: readonly TestSuiteTreeNode[];
  readonly raw?: unknown;
};

export type TestPlanSuitesTree = {
  readonly project: string;
  readonly planId: number;
  readonly rootSuiteId: number | null;
  readonly totalSuites: number;
  readonly suiteTree: readonly TestSuiteTreeNode[];
};

export type TestSuiteChildSummary = {
  readonly id: number;
  readonly name: string;
  readonly suiteType: string | null;
  readonly testCaseCount: number | null;
  readonly url: string | null;
};

export type TestSuiteFull = TestSuiteSummary & {
  readonly planId: number;
  readonly planName: string | null;
  readonly requirementId: number | null;
  readonly queryString: string | null;
  readonly inheritDefaultConfigurations: boolean;
  readonly defaultConfigurations: readonly TestConfigurationSummary[];
  readonly state: string | null;
  readonly parent: TestSuiteChildSummary | null;
  readonly children: readonly TestSuiteChildSummary[];
  readonly configurationCount: number | null;
  readonly url: string | null;
  readonly _links?: Record<string, unknown>;
  readonly raw?: unknown;
};

export type TestPointSummary = {
  readonly pointId: number;
  readonly title: string | null;
  readonly outcome: string | null;
  readonly order: number | null;
  readonly state: string | null;
  readonly isActive: boolean;
  readonly lastUpdatedDate: string | null;
  readonly testCaseId: number | null;
  readonly testCaseTitle: string | null;
  readonly testSuiteId: number | null;
  readonly testSuiteTitle: string | null;
  readonly configuration: string | null;
  readonly configurationId: number | null;
  readonly tester: string | null;
  readonly lastRunId: number | null;
  readonly lastResultId: number | null;
  readonly runBy: string | null;
  readonly timeCompleted: string | null;
  readonly failureType: string | null;
  readonly resolutionState: string | null;
  readonly workItemProperties: Record<string, unknown>;
  readonly testCase: Record<string, unknown> | null;
  readonly url: string | null;
  readonly _links?: Record<string, unknown>;
  readonly raw?: unknown;
};

export type TestPointsList = {
  readonly project: string;
  readonly planId: number;
  readonly suiteId: number;
  readonly totalCount: number;
  readonly returned: number;
  readonly paging: TestManagementPagingSummary;
  readonly points: readonly TestPointSummary[];
};

export type TestPointHistoryEntry = {
  readonly resultId: number | null;
  readonly testRunId: number | null;
  readonly outcome: string | null;
  readonly state: string | null;
  readonly comment: string | null;
  readonly runBy: string | null;
  readonly timeCompleted: string | null;
  readonly durationInMs: number | null;
  readonly lastUpdatedDate: string | null;
  readonly testCase: TestEntityReferenceSummary | null;
  readonly testSuite: TestEntityReferenceSummary | null;
  readonly configuration: TestConfigurationSummary | null;
  readonly _links?: Record<string, unknown>;
  readonly raw?: unknown;
};

export type TestPointHistory = {
  readonly project: string;
  readonly planId: number;
  readonly suiteId: number;
  readonly pointId: number;
  readonly currentTester: string | null;
  readonly testCaseId: number | null;
  readonly testCaseTitle: string | null;
  readonly testSuiteId: number | null;
  readonly testSuiteTitle: string | null;
  readonly configurationId: number | null;
  readonly configurationName: string | null;
  readonly totalHistoryEntries: number;
  readonly paging: TestManagementPagingSummary;
  readonly history: readonly TestPointHistoryEntry[];
};

export type TestAttachmentSummary = {
  readonly id: number | null;
  readonly name: string | null;
  readonly comment: string | null;
  readonly url: string | null;
  readonly attachmentType: string | null;
  readonly size: number | null;
  readonly raw?: unknown;
};

export type TestRunResultStepSummary = {
  readonly actionPath: string | null;
  readonly actionText: string | null;
  readonly expectedResult: string | null;
  readonly outcome: string | null;
  readonly comment: string | null;
  readonly durationInMs: number | null;
  readonly attachments: readonly TestAttachmentSummary[];
  readonly raw?: unknown;
};

export type TestRunResultSummary = {
  readonly id: number;
  readonly outcome: string | null;
  readonly state: string | null;
  readonly priority: number | null;
  readonly startedDate: string | null;
  readonly completedDate: string | null;
  readonly durationInMs: number | null;
  readonly runBy: string | null;
  readonly errorMessage: string | null;
  readonly stackTrace: string | null;
  readonly comment: string | null;
  readonly testCase: TestEntityReferenceSummary | null;
  readonly testSuite: TestEntityReferenceSummary | null;
  readonly testPlan: TestEntityReferenceSummary | null;
  readonly configuration: TestConfigurationSummary | null;
  readonly linkedWorkItemIds: readonly number[];
  readonly attachments: readonly TestAttachmentSummary[];
  readonly steps: readonly TestRunResultStepSummary[];
  readonly url: string | null;
  readonly _links?: Record<string, unknown>;
  readonly raw?: unknown;
};

export type TestRunFull = TestRunSummary & {
  readonly runId: number;
  readonly outcome: string | null;
  readonly result: string | null;
  readonly runBy: string | null;
  readonly createdDate: string | null;
  readonly completedDate: string | null;
  readonly durationInMs: number | null;
  readonly comment: string | null;
  readonly analysisOwner: string | null;
  readonly analysisComment: string | null;
  readonly pipelineRunTested: string | null;
  readonly build: TestEntityReferenceSummary | null;
  readonly testPlan: TestEntityReferenceSummary | null;
  readonly attachments: readonly TestAttachmentSummary[];
  readonly linkedWorkItemIds: readonly number[];
  readonly results: readonly TestRunResultSummary[];
  readonly paging: TestManagementPagingSummary;
  readonly url: string | null;
  readonly _links?: Record<string, unknown>;
  readonly raw?: unknown;
};

export type ExportedTestPlanFull = {
  readonly project: string;
  readonly planId: number;
  readonly plan: TestPlanFull;
  readonly suiteTree: readonly TestSuiteTreeNode[];
  readonly suitesById: Record<string, TestSuiteFull>;
  readonly pointsBySuiteId: Record<string, readonly TestPointSummary[]>;
  readonly pointHistoryByPointId?: Record<string, TestPointHistory>;
  readonly runsById?: Record<string, TestRunFull>;
  readonly testCasesById?: Record<string, TestCaseSummary>;
};

export type PipelineSummary = {
  readonly id: number;
  readonly name: string;
  readonly path: string | null;
  readonly type: string | null;
  readonly queueStatus: string | null;
};

export type PipelineRunSummary = {
  readonly id: number;
  readonly buildNumber: string;
  readonly status: string | null;
  readonly result: string | null;
  readonly startTime: string | null;
  readonly finishTime: string | null;
  readonly definitionName: string | null;
  readonly requestedBy: string | null;
};

export type PipelineArtifactSummary = {
  readonly id: number | null;
  readonly name: string;
  readonly resourceType: string | null;
  readonly downloadUrl: string | null;
  readonly source: string | null;
};

export type WikiPageSummary = {
  readonly path: string;
  readonly content: string;
  readonly gitItemPath: string | null;
  readonly isParentPage: boolean;
  readonly contentLength: number;
  readonly isTruncated: boolean;
};

export type DailyDigestWorkItemSummary = {
  readonly id: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly priority: number | null;
};

export type DailyDigestPullRequestSummary = {
  readonly pullRequestId: number;
  readonly title: string;
  readonly repository: string | null;
  readonly createdBy: string | null;
};

export type DailyDigestFailedPipelineSummary = {
  readonly id: number;
  readonly buildNumber: string;
  readonly definition: {
    readonly name: string | null;
  };
  readonly finishTime: string | null;
};

export type DailyDigestSummary = {
  readonly myWorkItems: readonly DailyDigestWorkItemSummary[];
  readonly prsPendingMyReview: readonly DailyDigestPullRequestSummary[];
  readonly failedPipelines: readonly DailyDigestFailedPipelineSummary[];
  readonly generatedAt: string;
};

export type BlockedItemSummary = {
  readonly id: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly assignedTo: string | null;
  readonly tags: string | null;
  readonly daysSinceUpdate: number;
};

export type SprintWindowSummary = {
  readonly name: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly daysRemaining: number;
};

export type SprintStateSummary = {
  readonly new: number;
  readonly active: number;
  readonly resolved: number;
  readonly closed: number;
};

export type SprintAtRiskItemSummary = {
  readonly id: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly assignedTo: string | null;
  readonly daysSinceUpdate: number;
};

export type SprintSummary = {
  readonly sprint: SprintWindowSummary;
  readonly totalItems: number;
  readonly byState: SprintStateSummary;
  readonly completionPercentage: number;
  readonly atRiskItems: readonly SprintAtRiskItemSummary[];
};

export type DateRangeSummary = {
  readonly start: string;
  readonly end: string;
};

export type SprintCapacityMemberSummary = {
  readonly displayName: string;
  readonly capacityPerDay: number;
  readonly daysOff: number;
  readonly availableHours: number;
};

export type SprintCapacitySummary = {
  readonly sprint: {
    readonly name: string;
    readonly startDate: string | null;
    readonly endDate: string | null;
  };
  readonly totalAvailableHours: number;
  readonly members: readonly SprintCapacityMemberSummary[];
  readonly teamDaysOff: readonly DateRangeSummary[];
};

export type DependencyWorkItemSummary = {
  readonly id: number;
  readonly title: string | null;
  readonly project: string | null;
  readonly state: string | null;
  readonly url: string | null;
};

export type CrossProjectDependenciesSummary = {
  readonly workItem: {
    readonly id: number;
    readonly title: string | null;
    readonly project: string | null;
    readonly state: string | null;
  };
  readonly blockedBy: readonly DependencyWorkItemSummary[];
  readonly blocking: readonly DependencyWorkItemSummary[];
  readonly crossProjectCount: number;
};

export type DashboardWidgetQueryResultSummary = {
  readonly id: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly assignedTo: string | null;
};

export type DashboardWidgetDataSummary = {
  readonly widgetName: string;
  readonly widgetType: string;
  readonly queryId?: string;
  readonly queryResults?: readonly DashboardWidgetQueryResultSummary[];
  readonly rawSettings: Record<string, unknown>;
};

export type PipelineFailedTaskSummary = {
  readonly name: string;
  readonly log: string;
};

export type PipelineFailureAnalysis = {
  readonly buildNumber: string;
  readonly definition: string | null;
  readonly requestedBy: string | null;
  readonly startTime: string | null;
  readonly finishTime: string | null;
  readonly failedTasks: readonly PipelineFailedTaskSummary[];
  readonly summary: string;
};

export type TestFailureImpactLinkedWorkItemSummary = {
  readonly id: number;
  readonly title: string | null;
  readonly state: string | null;
  readonly project: string | null;
};

export type TestFailureImpactFailedTestSummary = {
  readonly testName: string;
  readonly errorMessage: string;
  readonly linkedWorkItems: readonly TestFailureImpactLinkedWorkItemSummary[];
};

export type TestFailureImpactSummary = {
  readonly testRun: {
    readonly id: number;
    readonly name: string;
    readonly totalTests: number | null;
    readonly failedTests: number | null;
  };
  readonly failedTests: readonly TestFailureImpactFailedTestSummary[];
  readonly impactSummary: string;
};
