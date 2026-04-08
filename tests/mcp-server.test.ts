import { describe, expect, it } from "vitest";
import { Logger } from "../src/logging.js";
import { buildMcpServer } from "../src/mcp/server.js";
import type { AzureDevOpsServices } from "../src/domain/index.js";

describe("MCP server tool registration", () => {
  function buildServer() {
    const services = new Proxy(
      {},
      {
        get: () => async () => undefined,
      },
    ) as AzureDevOpsServices;

    return buildMcpServer(services, new Logger("info"));
  }

  it("registers the new composite tools", () => {
    const server = buildServer();
    const toolNames = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
    ).sort();
    const expectedToolNames = [
      "analyze_pipeline_failure",
      "analyze_test_failure_impact",
      "cluster_work_items_by_similarity",
      "export_test_plan_full",
      "export_traceability_dataset",
      "export_work_items_delta",
      "export_work_items_full",
      "find_duplicate_candidates",
      "find_similar_work_items",
      "get_blocked_items",
      "get_commit_full",
      "get_cross_project_dependencies",
      "get_dashboard_widget_data",
      "get_my_daily_digest",
      "get_pull_request_diff",
      "get_pull_request_full",
      "get_pull_request_work_items",
      "get_requirement_traceability_report",
      "get_sprint_capacity",
      "get_sprint_summary",
      "get_test_plan",
      "get_test_plan_suites_tree",
      "get_test_point_history",
      "get_test_run_full",
      "get_test_suite",
      "get_traceability_chain",
      "get_user_story_test_coverage",
      "get_wiki_page",
      "get_work_item",
      "get_work_item_full",
      "get_work_item_relations_graph",
      "list_area_paths",
      "list_iteration_paths",
      "list_linked_work_items",
      "list_pipeline_artifacts",
      "list_pipeline_runs",
      "list_pipelines",
      "list_projects",
      "list_pull_request_commits",
      "list_pull_requests",
      "list_repositories",
      "list_saved_queries",
      "list_tags",
      "list_test_cases",
      "list_test_cases_full",
      "list_test_plans",
      "list_test_points",
      "list_test_runs",
      "list_test_suites",
      "list_work_item_categories",
      "list_work_item_comments",
      "list_work_item_fields",
      "list_work_item_link_types",
      "list_work_item_revisions",
      "list_work_item_test_links",
      "list_work_item_types",
      "list_work_item_updates",
      "resolve_identity",
      "run_saved_query",
      "search_commits_by_work_item",
      "search_pull_requests_by_work_item",
      "search_work_items",
      "search_work_items_advanced",
    ].sort();

    expect(toolNames).toEqual(expectedToolNames);
  });

  it("rejects whitespace-only analytics inputs and invalid date filters", () => {
    const server = buildServer() as unknown as {
      _registeredTools: Record<string, { inputSchema: { safeParse: (input: unknown) => { success: boolean } } }>;
    };

    expect(
      server._registeredTools.list_work_item_fields.inputSchema.safeParse({
        project: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_area_paths.inputSchema.safeParse({
        project: "Allowed Project",
        depth: -1,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_iteration_paths.inputSchema.safeParse({
        project: "   ",
        mode: "tree",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_tags.inputSchema.safeParse({
        project: "Allowed Project",
        search: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.resolve_identity.inputSchema.safeParse({
        query: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_saved_queries.inputSchema.safeParse({
        project: "Allowed Project",
        depth: 3,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.run_saved_query.inputSchema.safeParse({
        project: "Allowed Project",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.run_saved_query.inputSchema.safeParse({
        project: "Allowed Project",
        queryId: " query-1 ",
        path: " Shared Queries/Anything ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.export_work_items_delta.inputSchema.safeParse({
        project: "Allowed Project",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.export_traceability_dataset.inputSchema.safeParse({
        project: "Allowed Project",
        queryId: "query-1",
        path: "Shared Queries/Anything",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.find_similar_work_items.inputSchema.safeParse({
        project: "Allowed Project",
        workItemId: 101,
        candidateProjects: ["   "],
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.find_duplicate_candidates.inputSchema.safeParse({
        project: "Allowed Project",
        sourceWorkItemId: 101,
        minScore: 2,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.cluster_work_items_by_similarity.inputSchema.safeParse({
        project: "Allowed Project",
        maxItems: 1,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_test_plan.inputSchema.safeParse({
        project: "   ",
        planId: 12,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_test_suite.inputSchema.safeParse({
        project: "Allowed Project",
        planId: 12,
        suiteId: 0,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_test_points.inputSchema.safeParse({
        project: "   ",
        planId: 12,
        suiteId: 1002,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_test_cases_full.inputSchema.safeParse({
        project: "Allowed Project",
        planId: 12,
        suiteId: -1,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_test_point_history.inputSchema.safeParse({
        project: "Allowed Project",
        planId: 12,
        suiteId: 1002,
        pointId: -1,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_test_run_full.inputSchema.safeParse({
        project: "Allowed Project",
        runId: 7001,
        pageSize: 0,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.export_test_plan_full.inputSchema.safeParse({
        project: "Allowed Project",
        planId: 12,
        suiteIds: [0],
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_work_item_types.inputSchema.safeParse({
        project: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_work_item_full.inputSchema.safeParse({
        id: 101,
        project: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_work_item_test_links.inputSchema.safeParse({
        project: "   ",
        workItemId: 101,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_user_story_test_coverage.inputSchema.safeParse({
        project: "Allowed Project",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_requirement_traceability_report.inputSchema.safeParse({
        project: "Allowed Project",
        workItemId: 0,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.search_pull_requests_by_work_item.inputSchema.safeParse({
        project: "   ",
        workItemId: 101,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_pull_request_full.inputSchema.safeParse({
        project: "Allowed Project",
        repository: "   ",
        pullRequestId: 55,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_pull_request_commits.inputSchema.safeParse({
        project: "Allowed Project",
        repository: "frontend",
        pullRequestId: 0,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_pull_request_diff.inputSchema.safeParse({
        project: "Allowed Project",
        repository: "frontend",
        pullRequestId: -1,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.get_commit_full.inputSchema.safeParse({
        project: "Allowed Project",
        repository: "frontend",
        commitId: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.search_commits_by_work_item.inputSchema.safeParse({
        project: "   ",
        workItemId: 101,
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.list_work_item_comments.inputSchema.safeParse({
        id: 101,
        project: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.search_work_items.inputSchema.safeParse({
        text: "   ",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.search_work_items_advanced.inputSchema.safeParse({
        project: "Allowed Project",
        createdDateFrom: "not-a-date",
      }).success,
    ).toBe(false);
    expect(
      server._registeredTools.export_work_items_full.inputSchema.safeParse({
        project: "Allowed Project",
        changedDateTo: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("accepts trimmed analytics inputs and the new get_work_item_full payload controls", () => {
    const server = buildServer() as unknown as {
      _registeredTools: Record<
        string,
        { inputSchema: { safeParse: (input: unknown) => { success: boolean; data?: Record<string, unknown> } } }
      >;
    };

    const workItemFull = server._registeredTools.get_work_item_full.inputSchema.safeParse({
      id: 101,
      project: " Allowed Project ",
      expand: "links",
      includeRelations: true,
      includeComments: true,
      includeRaw: true,
    });
    const listTypes = server._registeredTools.list_work_item_types.inputSchema.safeParse({
      project: " Allowed Project ",
      includeRaw: true,
    });
    const listFields = server._registeredTools.list_work_item_fields.inputSchema.safeParse({
      project: " Allowed Project ",
      search: " Assigned ",
      referenceNames: [" System.AssignedTo "],
      includeRaw: true,
    });
    const listAreaPaths = server._registeredTools.list_area_paths.inputSchema.safeParse({
      project: " Allowed Project ",
      depth: 3,
      mode: "flat",
      includeRaw: true,
    });
    const listIterationPaths = server._registeredTools.list_iteration_paths.inputSchema.safeParse({
      project: " Allowed Project ",
      depth: 2,
      mode: "tree",
      includeRaw: true,
    });
    const listTags = server._registeredTools.list_tags.inputSchema.safeParse({
      project: " Allowed Project ",
      search: " customer ",
      top: 25,
      includeRaw: true,
    });
    const resolveIdentity = server._registeredTools.resolve_identity.inputSchema.safeParse({
      query: " alice ",
      project: " Allowed Project ",
      top: 5,
      includeRaw: true,
    });
    const listSavedQueries = server._registeredTools.list_saved_queries.inputSchema.safeParse({
      project: " Allowed Project ",
      depth: 2,
      mode: "flat",
      includeWiql: true,
      includeRaw: true,
    });
    const runSavedQuery = server._registeredTools.run_saved_query.inputSchema.safeParse({
      project: " Allowed Project ",
      path: " Shared Queries/Ready For QA ",
      includeWorkItems: true,
      includeRaw: true,
      top: 25,
      expand: "relations",
    });
    const exportWorkItemsDelta = server._registeredTools.export_work_items_delta.inputSchema.safeParse({
      project: " Allowed Project ",
      changedSince: "2026-04-01",
      maxItems: 25,
      includeWorkItems: true,
      includeUpdates: true,
      includeRevisions: true,
      includeRaw: true,
      expand: "relations",
    });
    const exportTraceabilityDataset = server._registeredTools.export_traceability_dataset.inputSchema.safeParse({
      project: " Allowed Project ",
      path: " Shared Queries/Ready For QA ",
      maxItems: 25,
      includeWorkItems: true,
      includePullRequests: true,
      includeCommits: true,
      includeRaw: true,
      expand: "relations",
    });
    const findSimilarWorkItems = server._registeredTools.find_similar_work_items.inputSchema.safeParse({
      project: " Allowed Project ",
      workItemId: 101,
      candidateProjects: [" Allowed Project "],
      fieldNames: [" Custom.Component "],
      top: 5,
      maxCandidates: 25,
      minScore: 0.35,
      includeRaw: true,
    });
    const findDuplicateCandidates = server._registeredTools.find_duplicate_candidates.inputSchema.safeParse({
      project: " Allowed Project ",
      sourceWorkItemId: 101,
      top: 5,
      maxCandidates: 25,
      minScore: 0.6,
      includeRaw: true,
    });
    const clusterWorkItemsBySimilarity = server._registeredTools.cluster_work_items_by_similarity.inputSchema.safeParse({
      project: " Allowed Project ",
      projects: [" Allowed Project "],
      maxItems: 25,
      minScore: 0.4,
      minClusterSize: 2,
      includeRaw: true,
    });
    const listComments = server._registeredTools.list_work_item_comments.inputSchema.safeParse({
      id: 101,
      project: " Allowed Project ",
      pageSize: 50,
      includeRaw: true,
    });
    const listWorkItemTestLinks = server._registeredTools.list_work_item_test_links.inputSchema.safeParse({
      project: " Allowed Project ",
      workItemId: 101,
      includeTestCases: true,
      includeSuites: true,
      includePlans: true,
      includeRecentRuns: true,
      includeRaw: true,
    });
    const getUserStoryCoverage = server._registeredTools.get_user_story_test_coverage.inputSchema.safeParse({
      project: " Allowed Project ",
      userStoryId: 101,
      includeSuites: true,
      includePlans: true,
      includeRecentRuns: false,
      includeRaw: true,
    });
    const getRequirementTraceabilityReport = server._registeredTools.get_requirement_traceability_report.inputSchema.safeParse({
      project: " Allowed Project ",
      workItemId: 101,
      includeSuites: true,
      includePlans: false,
      includeRecentRuns: true,
      includeRaw: true,
    });
    const searchPullRequestsByWorkItem = server._registeredTools.search_pull_requests_by_work_item.inputSchema.safeParse({
      project: " Allowed Project ",
      workItemId: 101,
      includeRaw: true,
    });
    const getPullRequestFull = server._registeredTools.get_pull_request_full.inputSchema.safeParse({
      project: " Allowed Project ",
      repository: " frontend ",
      pullRequestId: 55,
      includeWorkItems: true,
      includeReviewers: false,
      includeRaw: true,
    });
    const listPullRequestCommits = server._registeredTools.list_pull_request_commits.inputSchema.safeParse({
      project: " Allowed Project ",
      repository: " frontend ",
      pullRequestId: 55,
      includeRaw: true,
    });
    const getPullRequestDiff = server._registeredTools.get_pull_request_diff.inputSchema.safeParse({
      project: " Allowed Project ",
      repository: " frontend ",
      pullRequestId: 55,
      includePatch: true,
      includeRaw: true,
    });
    const getCommitFull = server._registeredTools.get_commit_full.inputSchema.safeParse({
      project: " Allowed Project ",
      repository: " frontend ",
      commitId: " abc123 ",
      includePatch: true,
      includeRaw: true,
    });
    const searchCommitsByWorkItem = server._registeredTools.search_commits_by_work_item.inputSchema.safeParse({
      project: " Allowed Project ",
      workItemId: 101,
      includePatch: true,
      includeRaw: true,
    });
    const getTestPlan = server._registeredTools.get_test_plan.inputSchema.safeParse({
      project: " Allowed Project ",
      planId: 12,
      includeRaw: true,
    });
    const getTestSuite = server._registeredTools.get_test_suite.inputSchema.safeParse({
      project: " Allowed Project ",
      planId: 12,
      suiteId: 1002,
      includeRaw: true,
    });
    const listTestPoints = server._registeredTools.list_test_points.inputSchema.safeParse({
      project: " Allowed Project ",
      planId: 12,
      suiteId: 1002,
      pageSize: 25,
      includeRaw: true,
    });
    const listTestCasesFull = server._registeredTools.list_test_cases_full.inputSchema.safeParse({
      project: " Allowed Project ",
      planId: 12,
      suiteId: 1002,
      pageSize: 25,
      includeRaw: true,
    });
    const getTestPointHistory = server._registeredTools.get_test_point_history.inputSchema.safeParse({
      project: " Allowed Project ",
      planId: 12,
      suiteId: 1002,
      pointId: 9001,
      pageSize: 10,
      includeRaw: true,
    });
    const getTestRunFull = server._registeredTools.get_test_run_full.inputSchema.safeParse({
      project: " Allowed Project ",
      runId: 7001,
      includeSteps: false,
      includeRaw: true,
    });
    const exportTestPlanFull = server._registeredTools.export_test_plan_full.inputSchema.safeParse({
      project: " Allowed Project ",
      planId: 12,
      suiteIds: [1002],
      includePointHistory: true,
      includeRuns: true,
    });
    const advancedSearch = server._registeredTools.search_work_items_advanced.inputSchema.safeParse({
      project: " Allowed Project ",
      states: [" Active "],
      createdDateFrom: "2026-03-01",
    });
    const exportFull = server._registeredTools.export_work_items_full.inputSchema.safeParse({
      project: " Allowed Project ",
      states: [" Active "],
      maxItems: 25,
      includeComments: true,
    });

    expect(workItemFull.success).toBe(true);
    expect(workItemFull.data?.project).toBe("Allowed Project");
    expect(listTypes.success).toBe(true);
    expect(listTypes.data?.project).toBe("Allowed Project");
    expect(listFields.success).toBe(true);
    expect(listFields.data?.project).toBe("Allowed Project");
    expect(listAreaPaths.success).toBe(true);
    expect(listAreaPaths.data?.project).toBe("Allowed Project");
    expect(listIterationPaths.success).toBe(true);
    expect(listIterationPaths.data?.project).toBe("Allowed Project");
    expect(listTags.success).toBe(true);
    expect(listTags.data?.project).toBe("Allowed Project");
    expect(resolveIdentity.success).toBe(true);
    expect(resolveIdentity.data?.query).toBe("alice");
    expect(resolveIdentity.data?.project).toBe("Allowed Project");
    expect(listSavedQueries.success).toBe(true);
    expect(listSavedQueries.data?.project).toBe("Allowed Project");
    expect(runSavedQuery.success).toBe(true);
    expect(runSavedQuery.data?.project).toBe("Allowed Project");
    expect(runSavedQuery.data?.path).toBe("Shared Queries/Ready For QA");
    expect(exportWorkItemsDelta.success).toBe(true);
    expect(exportWorkItemsDelta.data?.project).toBe("Allowed Project");
    expect(exportTraceabilityDataset.success).toBe(true);
    expect(exportTraceabilityDataset.data?.project).toBe("Allowed Project");
    expect(exportTraceabilityDataset.data?.path).toBe("Shared Queries/Ready For QA");
    expect(findSimilarWorkItems.success).toBe(true);
    expect(findSimilarWorkItems.data?.project).toBe("Allowed Project");
    expect(findDuplicateCandidates.success).toBe(true);
    expect(findDuplicateCandidates.data?.project).toBe("Allowed Project");
    expect(clusterWorkItemsBySimilarity.success).toBe(true);
    expect(clusterWorkItemsBySimilarity.data?.project).toBe("Allowed Project");
    expect(listComments.success).toBe(true);
    expect(listComments.data?.project).toBe("Allowed Project");
    expect(listWorkItemTestLinks.success).toBe(true);
    expect(listWorkItemTestLinks.data?.project).toBe("Allowed Project");
    expect(getUserStoryCoverage.success).toBe(true);
    expect(getUserStoryCoverage.data?.project).toBe("Allowed Project");
    expect(getRequirementTraceabilityReport.success).toBe(true);
    expect(getRequirementTraceabilityReport.data?.project).toBe("Allowed Project");
    expect(searchPullRequestsByWorkItem.success).toBe(true);
    expect(searchPullRequestsByWorkItem.data?.project).toBe("Allowed Project");
    expect(getPullRequestFull.success).toBe(true);
    expect(getPullRequestFull.data?.repository).toBe("frontend");
    expect(listPullRequestCommits.success).toBe(true);
    expect(listPullRequestCommits.data?.repository).toBe("frontend");
    expect(getPullRequestDiff.success).toBe(true);
    expect(getPullRequestDiff.data?.repository).toBe("frontend");
    expect(getCommitFull.success).toBe(true);
    expect(getCommitFull.data?.repository).toBe("frontend");
    expect(getCommitFull.data?.commitId).toBe("abc123");
    expect(searchCommitsByWorkItem.success).toBe(true);
    expect(searchCommitsByWorkItem.data?.project).toBe("Allowed Project");
    expect(getTestPlan.success).toBe(true);
    expect(getTestPlan.data?.project).toBe("Allowed Project");
    expect(getTestSuite.success).toBe(true);
    expect(getTestSuite.data?.project).toBe("Allowed Project");
    expect(listTestPoints.success).toBe(true);
    expect(listTestPoints.data?.project).toBe("Allowed Project");
    expect(listTestCasesFull.success).toBe(true);
    expect(listTestCasesFull.data?.project).toBe("Allowed Project");
    expect(getTestPointHistory.success).toBe(true);
    expect(getTestPointHistory.data?.project).toBe("Allowed Project");
    expect(getTestRunFull.success).toBe(true);
    expect(getTestRunFull.data?.project).toBe("Allowed Project");
    expect(exportTestPlanFull.success).toBe(true);
    expect(exportTestPlanFull.data?.project).toBe("Allowed Project");
    expect(advancedSearch.success).toBe(true);
    expect(advancedSearch.data?.project).toBe("Allowed Project");
    expect(exportFull.success).toBe(true);
    expect(exportFull.data?.project).toBe("Allowed Project");
  });
});
