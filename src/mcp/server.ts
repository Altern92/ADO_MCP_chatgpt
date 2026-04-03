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
  BlockedItemSummary,
  CrossProjectDependenciesSummary,
  DashboardWidgetDataSummary,
  DailyDigestSummary,
  DependencyWorkItemSummary,
  PipelineFailureAnalysis,
  PipelineArtifactSummary,
  PipelineRunSummary,
  PipelineSummary,
  ProjectSummary,
  PullRequestSummary,
  RepositorySummary,
  TestCaseSummary,
  TestPlanSummary,
  TestRunSummary,
  TestSuiteSummary,
  WikiPageSummary,
  WorkItemSummary,
  SprintSummary,
  SprintCapacitySummary,
  TestFailureImpactSummary,
} from "../models.js";
import type { Logger } from "../logging.js";
import { createStructuredToolResult, createToolErrorResult } from "./results.js";

const readOnlyAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true,
};

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

const workItemSchema = z.object({
  id: z.number().int(),
  project: z.string().nullable(),
  title: z.string().nullable(),
  state: z.string().nullable(),
  workItemType: z.string().nullable(),
  assignedTo: z.string().nullable(),
  createdDate: z.string().nullable(),
  changedDate: z.string().nullable(),
  closedDate: z.string().nullable(),
  priority: z.number().nullable(),
  description: z.string().nullable(),
  url: z.string().nullable(),
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
    "search_work_items",
    {
      title: "Search Work Items",
      description:
        "Use this when you need to find work items by project, assignee, state, or free-text search.",
      inputSchema: z.object({
        project: z.string().min(1).optional().describe("Optional Azure DevOps project name or ID."),
        assignedToMe: z
          .boolean()
          .optional()
          .describe("If true, only return items assigned to the authenticated Azure DevOps identity."),
        state: z.string().min(1).optional().describe("Optional work item state filter."),
        text: z.string().min(1).optional().describe("Optional free-text filter."),
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
    "list_test_plans",
    {
      title: "List Test Plans",
      description:
        "Use this when you need the test plans available in a specific Azure DevOps project.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
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
    "list_test_suites",
    {
      title: "List Test Suites",
      description:
        "Use this when you need the test suites inside a specific Azure DevOps test plan.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
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
    "list_test_cases",
    {
      title: "List Test Cases",
      description:
        "Use this when you need the test cases and point assignments inside a specific test suite.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
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
    "list_test_runs",
    {
      title: "List Test Runs",
      description:
        "Use this when you need the most recent Azure DevOps test runs in a project.",
      inputSchema: z.object({
        project: z.string().min(1).describe("Azure DevOps project name or ID."),
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
