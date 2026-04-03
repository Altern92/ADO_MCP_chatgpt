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

export type WorkItemSummary = {
  readonly id: number;
  readonly project: string | null;
  readonly title: string | null;
  readonly state: string | null;
  readonly workItemType: string | null;
  readonly assignedTo: string | null;
  readonly createdDate: string | null;
  readonly changedDate: string | null;
  readonly closedDate: string | null;
  readonly priority: number | null;
  readonly description: string | null;
  readonly url: string | null;
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
