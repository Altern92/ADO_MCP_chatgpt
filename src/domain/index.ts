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
  listPipelineArtifacts,
  listPipelineRuns,
  listPipelines,
} from "./pipelines.js";
import { getPullRequestWorkItems, listPullRequests } from "./pullRequests.js";
import { listProjects } from "./projects.js";
import { listRepositories } from "./repositories.js";
import {
  listTestCases,
  listTestPlans,
  listTestRuns,
  listTestSuites,
} from "./testManagement.js";
import { getWikiPage } from "./wiki.js";
import { getWorkItem, searchWorkItems, type SearchWorkItemsInput } from "./workItems.js";

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
  getWorkItem(id: number): ReturnType<typeof getWorkItem>;
  searchWorkItems(input: SearchWorkItemsInput): ReturnType<typeof searchWorkItems>;
  listTestPlans(project: string): ReturnType<typeof listTestPlans>;
  listTestSuites(project: string, planId: number): ReturnType<typeof listTestSuites>;
  listTestCases(
    project: string,
    planId: number,
    suiteId: number,
  ): ReturnType<typeof listTestCases>;
  listTestRuns(project: string, top?: number): ReturnType<typeof listTestRuns>;
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
    getWorkItem: (id) => getWorkItem(client, config, id),
    searchWorkItems: (input) => searchWorkItems(client, config, input),
    listTestPlans: (project) => listTestPlans(client, config, project),
    listTestSuites: (project, planId) => listTestSuites(client, config, project, planId),
    listTestCases: (project, planId, suiteId) =>
      listTestCases(client, config, project, planId, suiteId),
    listTestRuns: (project, top) => listTestRuns(client, config, project, top),
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
