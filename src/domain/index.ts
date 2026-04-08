import type { AppConfig } from "../config.js";
import {
  AzureDevOpsClient,
  type AzureDevOpsClientLike,
} from "../azure/client.js";
import type { Logger } from "../logging.js";
import {
  analyzeTestFailureImpact,
  analyzePipelineFailure,
  getCrossProjectDependencies,
  getDashboardWidgetData,
  getBlockedItems,
  getMyDailyDigest,
  getSprintCapacity,
  getSprintSummary,
  type AnalyzeTestFailureImpactInput,
  type AnalyzePipelineFailureInput,
  type GetCrossProjectDependenciesInput,
  type GetDashboardWidgetDataInput,
  type GetBlockedItemsInput,
  type GetMyDailyDigestInput,
  type GetSprintCapacityInput,
  type GetSprintSummaryInput,
} from "./composite.js";
import {
  getCommitFull,
  getPullRequestDiff,
  getPullRequestFull,
  listPullRequestCommits,
  searchCommitsByWorkItem,
  searchPullRequestsByWorkItem,
  type GetCommitFullInput,
  type GetPullRequestDiffInput,
  type GetPullRequestFullInput as CodeIntelligenceGetPullRequestFullInput,
  type ListPullRequestCommitsInput,
  type SearchCommitsByWorkItemInput,
  type SearchPullRequestsByWorkItemInput,
} from "./codeIntelligence.js";
import {
  listAreaPaths,
  listIterationPaths,
  listTags,
  listWorkItemFields,
  resolveIdentity,
  type ListAreaPathsInput,
  type ListIterationPathsInput,
  type ListTagsInput,
  type ListWorkItemFieldsInput,
  type ResolveIdentityInput,
} from "./discovery.js";
import {
  listPipelineArtifacts,
  listPipelineRuns,
  listPipelines,
} from "./pipelines.js";
import {
  exportTraceabilityDataset,
  exportWorkItemsDelta,
  listSavedQueries,
  runSavedQuery,
  type ExportTraceabilityDatasetInput,
  type ExportWorkItemsDeltaInput,
  type ListSavedQueriesInput,
  type RunSavedQueryInput,
} from "./reporting.js";
import {
  clusterWorkItemsBySimilarity,
  findDuplicateCandidates,
  findSimilarWorkItems,
  type ClusterWorkItemsBySimilarityInput,
  type FindDuplicateCandidatesInput,
  type FindSimilarWorkItemsInput,
} from "./similarity.js";
import { getPullRequestWorkItems, listPullRequests } from "./pullRequests.js";
import { listProjects } from "./projects.js";
import { listRepositories } from "./repositories.js";
import {
  exportTestPlanFull,
  getTestPlan,
  getTestPlanSuitesTree,
  getTestPointHistory,
  getTestRunFull,
  getTestSuite,
  listTestCases,
  listTestCasesFull,
  listTestPoints,
  listTestPlans,
  listTestRuns,
  listTestSuites,
  type ExportTestPlanFullInput,
  type GetTestPlanInput,
  type GetTestPlanSuitesTreeInput,
  type GetTestPointHistoryInput,
  type GetTestRunFullInput,
  type GetTestSuiteInput,
  type ListTestCasesFullInput,
  type ListTestPointsInput,
} from "./testManagement.js";
import {
  getRequirementTraceabilityReport,
  getUserStoryTestCoverage,
  getTraceabilityChain,
  getWorkItemRelationsGraph,
  listLinkedWorkItems,
  listWorkItemTestLinks,
  listWorkItemLinkTypes,
  type GetRequirementTraceabilityReportInput,
  type GetUserStoryTestCoverageInput,
  type GetTraceabilityChainInput,
  type ListLinkedWorkItemsInput,
  type ListWorkItemTestLinksInput,
  type TraceabilityGraphInput,
} from "./traceability.js";
import { getWikiPage } from "./wiki.js";
import {
  exportWorkItemsFull,
  getWorkItemFull,
  getWorkItem,
  listWorkItemComments,
  listWorkItemCategories,
  listWorkItemRevisions,
  listWorkItemTypes,
  listWorkItemUpdates,
  type ExportWorkItemsFullInput,
  type ListWorkItemTypesInput,
  searchWorkItemsAdvanced,
  searchWorkItems,
  type GetWorkItemFullInput,
  type WorkItemAuditInput,
  type SearchWorkItemsAdvancedInput,
  type SearchWorkItemsInput,
} from "./workItems.js";

export interface AzureDevOpsServices {
  listProjects(): ReturnType<typeof listProjects>;
  listRepositories(project: string): ReturnType<typeof listRepositories>;
  listPullRequests(
    project: string,
    repository: string,
    status: "active" | "completed" | "abandoned",
  ): ReturnType<typeof listPullRequests>;
  getPullRequestWorkItems(
    project: string,
    repository: string,
    pullRequestId: number,
  ): ReturnType<typeof getPullRequestWorkItems>;
  searchPullRequestsByWorkItem(
    input: SearchPullRequestsByWorkItemInput,
  ): ReturnType<typeof searchPullRequestsByWorkItem>;
  getPullRequestFull(
    input: CodeIntelligenceGetPullRequestFullInput,
  ): ReturnType<typeof getPullRequestFull>;
  listPullRequestCommits(
    input: ListPullRequestCommitsInput,
  ): ReturnType<typeof listPullRequestCommits>;
  getPullRequestDiff(
    input: GetPullRequestDiffInput,
  ): ReturnType<typeof getPullRequestDiff>;
  getCommitFull(input: GetCommitFullInput): ReturnType<typeof getCommitFull>;
  searchCommitsByWorkItem(
    input: SearchCommitsByWorkItemInput,
  ): ReturnType<typeof searchCommitsByWorkItem>;
  listWorkItemFields(
    input: ListWorkItemFieldsInput,
  ): ReturnType<typeof listWorkItemFields>;
  listAreaPaths(input: ListAreaPathsInput): ReturnType<typeof listAreaPaths>;
  listIterationPaths(
    input: ListIterationPathsInput,
  ): ReturnType<typeof listIterationPaths>;
  listTags(input: ListTagsInput): ReturnType<typeof listTags>;
  resolveIdentity(input: ResolveIdentityInput): ReturnType<typeof resolveIdentity>;
  listSavedQueries(
    input: ListSavedQueriesInput,
  ): ReturnType<typeof listSavedQueries>;
  runSavedQuery(input: RunSavedQueryInput): ReturnType<typeof runSavedQuery>;
  exportWorkItemsDelta(
    input: ExportWorkItemsDeltaInput,
  ): ReturnType<typeof exportWorkItemsDelta>;
  exportTraceabilityDataset(
    input: ExportTraceabilityDatasetInput,
  ): ReturnType<typeof exportTraceabilityDataset>;
  findSimilarWorkItems(
    input: FindSimilarWorkItemsInput,
  ): ReturnType<typeof findSimilarWorkItems>;
  findDuplicateCandidates(
    input: FindDuplicateCandidatesInput,
  ): ReturnType<typeof findDuplicateCandidates>;
  clusterWorkItemsBySimilarity(
    input: ClusterWorkItemsBySimilarityInput,
  ): ReturnType<typeof clusterWorkItemsBySimilarity>;
  listWorkItemCategories(project: string): ReturnType<typeof listWorkItemCategories>;
  listWorkItemTypes(input: string | ListWorkItemTypesInput): ReturnType<typeof listWorkItemTypes>;
  getWorkItem(id: number): ReturnType<typeof getWorkItem>;
  getWorkItemFull(input: GetWorkItemFullInput): ReturnType<typeof getWorkItemFull>;
  listWorkItemComments(input: WorkItemAuditInput): ReturnType<typeof listWorkItemComments>;
  listWorkItemUpdates(input: WorkItemAuditInput): ReturnType<typeof listWorkItemUpdates>;
  listWorkItemRevisions(input: WorkItemAuditInput): ReturnType<typeof listWorkItemRevisions>;
  searchWorkItems(input: SearchWorkItemsInput): ReturnType<typeof searchWorkItems>;
  searchWorkItemsAdvanced(
    input: SearchWorkItemsAdvancedInput,
  ): ReturnType<typeof searchWorkItemsAdvanced>;
  exportWorkItemsFull(
    input: ExportWorkItemsFullInput,
  ): ReturnType<typeof exportWorkItemsFull>;
  listWorkItemLinkTypes(): ReturnType<typeof listWorkItemLinkTypes>;
  getWorkItemRelationsGraph(
    input: TraceabilityGraphInput,
  ): ReturnType<typeof getWorkItemRelationsGraph>;
  getTraceabilityChain(
    input: GetTraceabilityChainInput,
  ): ReturnType<typeof getTraceabilityChain>;
  listLinkedWorkItems(
    input: ListLinkedWorkItemsInput,
  ): ReturnType<typeof listLinkedWorkItems>;
  listWorkItemTestLinks(
    input: ListWorkItemTestLinksInput,
  ): ReturnType<typeof listWorkItemTestLinks>;
  getUserStoryTestCoverage(
    input: GetUserStoryTestCoverageInput,
  ): ReturnType<typeof getUserStoryTestCoverage>;
  getRequirementTraceabilityReport(
    input: GetRequirementTraceabilityReportInput,
  ): ReturnType<typeof getRequirementTraceabilityReport>;
  listTestPlans(project: string): ReturnType<typeof listTestPlans>;
  getTestPlan(input: GetTestPlanInput): ReturnType<typeof getTestPlan>;
  getTestPlanSuitesTree(
    input: GetTestPlanSuitesTreeInput,
  ): ReturnType<typeof getTestPlanSuitesTree>;
  getTestSuite(input: GetTestSuiteInput): ReturnType<typeof getTestSuite>;
  listTestSuites(project: string, planId: number): ReturnType<typeof listTestSuites>;
  listTestCases(
    project: string,
    planId: number,
    suiteId: number,
  ): ReturnType<typeof listTestCases>;
  listTestCasesFull(
    input: ListTestCasesFullInput,
  ): ReturnType<typeof listTestCasesFull>;
  listTestPoints(input: ListTestPointsInput): ReturnType<typeof listTestPoints>;
  getTestPointHistory(
    input: GetTestPointHistoryInput,
  ): ReturnType<typeof getTestPointHistory>;
  listTestRuns(project: string, top?: number): ReturnType<typeof listTestRuns>;
  getTestRunFull(input: GetTestRunFullInput): ReturnType<typeof getTestRunFull>;
  exportTestPlanFull(
    input: ExportTestPlanFullInput,
  ): ReturnType<typeof exportTestPlanFull>;
  listPipelines(project: string): ReturnType<typeof listPipelines>;
  listPipelineRuns(
    project: string,
    definitionId?: number,
    top?: number,
  ): ReturnType<typeof listPipelineRuns>;
  listPipelineArtifacts(
    project: string,
    runId: number,
  ): ReturnType<typeof listPipelineArtifacts>;
  getWikiPage(
    project: string,
    wikiIdentifier: string,
    path: string,
  ): ReturnType<typeof getWikiPage>;
  getMyDailyDigest(input: GetMyDailyDigestInput): ReturnType<typeof getMyDailyDigest>;
  getBlockedItems(input: GetBlockedItemsInput): ReturnType<typeof getBlockedItems>;
  getSprintCapacity(input: GetSprintCapacityInput): ReturnType<typeof getSprintCapacity>;
  getSprintSummary(input: GetSprintSummaryInput): ReturnType<typeof getSprintSummary>;
  getCrossProjectDependencies(
    input: GetCrossProjectDependenciesInput,
  ): ReturnType<typeof getCrossProjectDependencies>;
  getDashboardWidgetData(
    input: GetDashboardWidgetDataInput,
  ): ReturnType<typeof getDashboardWidgetData>;
  analyzePipelineFailure(
    input: AnalyzePipelineFailureInput,
  ): ReturnType<typeof analyzePipelineFailure>;
  analyzeTestFailureImpact(
    input: AnalyzeTestFailureImpactInput,
  ): ReturnType<typeof analyzeTestFailureImpact>;
}

type ProjectScopedConfig = Pick<AppConfig, "azdoProjectAllowlist">;
type AzureClientConfig = Pick<
  AppConfig,
  "azdoOrg" | "requestTimeoutMs" | "maxRetries" | "retryBaseDelayMs"
>;

function isAzureDevOpsClientLike(value: unknown): value is AzureDevOpsClientLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { get?: unknown }).get === "function" &&
    typeof (value as { post?: unknown }).post === "function"
  );
}

export function createAzureDevOpsServices(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
): AzureDevOpsServices;
export function createAzureDevOpsServices(
  config: AzureClientConfig & ProjectScopedConfig,
  logger: Logger,
  pat: string,
  fetchImpl?: typeof fetch,
): AzureDevOpsServices;
export function createAzureDevOpsServices(
  clientOrConfig: AzureDevOpsClientLike | (AzureClientConfig & ProjectScopedConfig),
  configOrLogger: ProjectScopedConfig | Logger,
  pat?: string,
  fetchImpl?: typeof fetch,
): AzureDevOpsServices {
  let client: AzureDevOpsClientLike;
  let config: ProjectScopedConfig;

  if (isAzureDevOpsClientLike(clientOrConfig)) {
    client = clientOrConfig;
    config = configOrLogger as ProjectScopedConfig;
  } else {
    client = new AzureDevOpsClient(clientOrConfig, pat ?? "", configOrLogger as Logger, fetchImpl);
    config = clientOrConfig;
  }

  return {
    listProjects: () => listProjects(client, config),
    listRepositories: (project) => listRepositories(client, config, project),
    listPullRequests: (project, repository, status) =>
      listPullRequests(client, config, project, repository, status),
    getPullRequestWorkItems: (project, repository, pullRequestId) =>
      getPullRequestWorkItems(client, config, project, repository, pullRequestId),
    searchPullRequestsByWorkItem: (input) =>
      searchPullRequestsByWorkItem(client, config, input),
    getPullRequestFull: (input) => getPullRequestFull(client, config, input),
    listPullRequestCommits: (input) => listPullRequestCommits(client, config, input),
    getPullRequestDiff: (input) => getPullRequestDiff(client, config, input),
    getCommitFull: (input) => getCommitFull(client, config, input),
    searchCommitsByWorkItem: (input) => searchCommitsByWorkItem(client, config, input),
    listWorkItemFields: (input) => listWorkItemFields(client, config, input),
    listAreaPaths: (input) => listAreaPaths(client, config, input),
    listIterationPaths: (input) => listIterationPaths(client, config, input),
    listTags: (input) => listTags(client, config, input),
    resolveIdentity: (input) => resolveIdentity(client, config, input),
    listSavedQueries: (input) => listSavedQueries(client, config, input),
    runSavedQuery: (input) => runSavedQuery(client, config, input),
    exportWorkItemsDelta: (input) => exportWorkItemsDelta(client, config, input),
    exportTraceabilityDataset: (input) =>
      exportTraceabilityDataset(client, config, input),
    findSimilarWorkItems: (input) => findSimilarWorkItems(client, config, input),
    findDuplicateCandidates: (input) => findDuplicateCandidates(client, config, input),
    clusterWorkItemsBySimilarity: (input) =>
      clusterWorkItemsBySimilarity(client, config, input),
    listWorkItemCategories: (project) => listWorkItemCategories(client, config, project),
    listWorkItemTypes: (input) => listWorkItemTypes(client, config, input),
    getWorkItem: (id) => getWorkItem(client, config, id),
    getWorkItemFull: (input) => getWorkItemFull(client, config, input),
    listWorkItemComments: (input) => listWorkItemComments(client, config, input),
    listWorkItemUpdates: (input) => listWorkItemUpdates(client, config, input),
    listWorkItemRevisions: (input) => listWorkItemRevisions(client, config, input),
    searchWorkItems: (input) => searchWorkItems(client, config, input),
    searchWorkItemsAdvanced: (input) => searchWorkItemsAdvanced(client, config, input),
    exportWorkItemsFull: (input) => exportWorkItemsFull(client, config, input),
    listWorkItemLinkTypes: () => listWorkItemLinkTypes(client),
    getWorkItemRelationsGraph: (input) => getWorkItemRelationsGraph(client, config, input),
    getTraceabilityChain: (input) => getTraceabilityChain(client, config, input),
    listLinkedWorkItems: (input) => listLinkedWorkItems(client, config, input),
    listWorkItemTestLinks: (input) => listWorkItemTestLinks(client, config, input),
    getUserStoryTestCoverage: (input) => getUserStoryTestCoverage(client, config, input),
    getRequirementTraceabilityReport: (input) =>
      getRequirementTraceabilityReport(client, config, input),
    listTestPlans: (project) => listTestPlans(client, config, project),
    getTestPlan: (input) => getTestPlan(client, config, input),
    getTestPlanSuitesTree: (input) => getTestPlanSuitesTree(client, config, input),
    getTestSuite: (input) => getTestSuite(client, config, input),
    listTestSuites: (project, planId) => listTestSuites(client, config, project, planId),
    listTestCases: (project, planId, suiteId) =>
      listTestCases(client, config, project, planId, suiteId),
    listTestCasesFull: (input) => listTestCasesFull(client, config, input),
    listTestPoints: (input) => listTestPoints(client, config, input),
    getTestPointHistory: (input) => getTestPointHistory(client, config, input),
    listTestRuns: (project, top) => listTestRuns(client, config, project, top),
    getTestRunFull: (input) => getTestRunFull(client, config, input),
    exportTestPlanFull: (input) => exportTestPlanFull(client, config, input),
    listPipelines: (project) => listPipelines(client, config, project),
    listPipelineRuns: (project, definitionId, top) =>
      listPipelineRuns(client, config, project, definitionId, top),
    listPipelineArtifacts: (project, runId) =>
      listPipelineArtifacts(client, config, project, runId),
    getWikiPage: (project, wikiIdentifier, path) =>
      getWikiPage(client, config, project, wikiIdentifier, path),
    getMyDailyDigest: (input) => getMyDailyDigest(client, config, input),
    getBlockedItems: (input) => getBlockedItems(client, config, input),
    getSprintCapacity: (input) => getSprintCapacity(client, config, input),
    getSprintSummary: (input) => getSprintSummary(client, config, input),
    getCrossProjectDependencies: (input) =>
      getCrossProjectDependencies(client, config, input),
    getDashboardWidgetData: (input) => getDashboardWidgetData(client, config, input),
    analyzePipelineFailure: (input) => analyzePipelineFailure(client, config, input),
    analyzeTestFailureImpact: (input) =>
      analyzeTestFailureImpact(client, config, input),
  };
}
