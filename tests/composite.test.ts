import { afterEach, describe, expect, it, vi } from "vitest";
import { AzureDevOpsApiError } from "../src/errors.js";
import { createAzureDevOpsServices } from "../src/domain/index.js";

describe("composite Azure DevOps services", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a daily digest from work items, pull requests, and failed pipelines", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));

    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/projects?api-version=7.1") {
          return {
            value: [
              { id: "1", name: "Allowed Project" },
              { id: "2", name: "Blocked Project" },
            ],
          };
        }

        if (path.startsWith("/_apis/Identities?")) {
          return {
            value: [{ id: "user-1", uniqueName: "me@example.com" }],
          };
        }

        if (path.includes("/_apis/git/pullrequests?")) {
          return {
            value: [
              {
                pullRequestId: 7,
                title: "Review retry fix",
                repository: { name: "frontend" },
                createdBy: { displayName: "Alex" },
              },
            ],
          };
        }

        if (path.includes("/_apis/build/builds?")) {
          return {
            value: [
              {
                id: 55,
                buildNumber: "2026.03.23.1",
                definition: { name: "CI" },
                finishTime: "2026-03-23T10:00:00.000Z",
              },
            ],
          };
        }

        if (path.includes("/_apis/wit/workitems?ids=101")) {
          return {
            value: [
              {
                id: 101,
                fields: {
                  "System.Title": "Investigate flaky tests",
                  "System.State": "Active",
                  "Microsoft.VSTS.Common.Priority": 1,
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string, body: unknown) => {
        expect(path).toBe("/_apis/wit/wiql?api-version=7.1");
        const query = (body as { query: string }).query;
        expect(query).toContain("[System.AssignedTo] = 'me@example.com'");
        expect(query).toContain("[System.State] NOT IN ('Closed', 'Resolved')");
        expect(query).toContain("[System.TeamProject] = 'Allowed Project'");
        return { workItems: [{ id: 101 }] };
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const digest = await services.getMyDailyDigest({
      myEmail: "me@example.com",
    });

    expect(digest.generatedAt).toBe("2026-03-23T12:00:00.000Z");
    expect(digest.myWorkItems).toEqual([
      {
        id: 101,
        title: "Investigate flaky tests",
        state: "Active",
        priority: 1,
      },
    ]);
    expect(digest.prsPendingMyReview[0]).toEqual({
      pullRequestId: 7,
      title: "Review retry fix",
      repository: "frontend",
      createdBy: "Alex",
    });
    expect(digest.failedPipelines[0]).toEqual({
      id: 55,
      buildNumber: "2026.03.23.1",
      definition: { name: "CI" },
      finishTime: "2026-03-23T10:00:00.000Z",
    });
    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining("searchCriteria.reviewerId=user-1"),
    );
    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining("minTime=2026-03-22T12%3A00%3A00.000Z"),
    );
  });

  it("falls back to reviewer email matching when the identities endpoint is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));

    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/projects?api-version=7.1") {
          return {
            value: [{ id: "1", name: "Allowed Project" }],
          };
        }

        if (path.startsWith("/_apis/Identities?")) {
          throw new AzureDevOpsApiError(path, 401, "corr-identity");
        }

        if (path.includes("/_apis/git/pullrequests?searchCriteria.status=active")) {
          return {
            value: [
              {
                pullRequestId: 9,
                title: "Review fallback path",
                repository: { name: "frontend" },
                createdBy: { displayName: "Alex" },
                reviewers: [
                  {
                    id: "user-1",
                    uniqueName: "me@example.com",
                    vote: 0,
                    hasDeclined: false,
                  },
                ],
              },
            ],
          };
        }

        if (path.includes("/_apis/build/builds?")) {
          return {
            value: [],
          };
        }

        if (path.includes("/_apis/wit/workitems?ids=101")) {
          return {
            value: [
              {
                id: 101,
                fields: {
                  "System.Title": "Investigate flaky tests",
                  "System.State": "Active",
                  "Microsoft.VSTS.Common.Priority": 1,
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string, body: unknown) => {
        expect(path).toBe("/_apis/wit/wiql?api-version=7.1");
        const query = (body as { query: string }).query;
        expect(query).toContain("[System.AssignedTo] = 'me@example.com'");
        return { workItems: [{ id: 101 }] };
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const digest = await services.getMyDailyDigest({
      myEmail: "me@example.com",
    });

    expect(digest.prsPendingMyReview).toEqual([
      {
        pullRequestId: 9,
        title: "Review fallback path",
        repository: "frontend",
        createdBy: "Alex",
      },
    ]);
    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining("searchCriteria.status=active"),
    );
  });

  it("returns stale blocked items scoped to the current team iteration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));

    const client = {
      get: vi.fn(async (path: string) => {
        if (path.includes("/_apis/work/teamsettings/iterations?")) {
          return {
            value: [{ path: "Allowed Project\\Sprint 12" }],
          };
        }

        if (path.includes("/_apis/wit/workitems?ids=201")) {
          return {
            value: [
              {
                id: 201,
                fields: {
                  "System.Title": "Waiting on upstream dependency",
                  "System.State": "Active",
                  "System.AssignedTo": { displayName: "Jamie" },
                  "System.ChangedDate": "2026-03-17T10:00:00.000Z",
                  "System.Tags": "Blocked;Backend",
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string, body: unknown) => {
        expect(path).toBe(
          "/Allowed%20Project/_apis/wit/wiql?timePrecision=true&api-version=7.1",
        );
        const query = (body as { query: string }).query;
        expect(query).toContain("[System.Tags] CONTAINS 'Blocked'");
        expect(query).toContain("[System.ChangedDate] < '2026-03-18T12:00:00.000Z'");
        expect(query).toContain(
          "[System.IterationPath] UNDER 'Allowed Project\\Sprint 12'",
        );
        return { workItems: [{ id: 201 }] };
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.getBlockedItems({
      project: "Allowed Project",
      team: "Platform Team",
    });

    expect(result).toEqual({
      blockedItems: [
        {
          id: 201,
          title: "Waiting on upstream dependency",
          state: "Active",
          assignedTo: "Jamie",
          tags: "Blocked;Backend",
          daysSinceUpdate: 6,
        },
      ],
      totalBlocked: 1,
      project: "Allowed Project",
    });
  });

  it("summarizes the current sprint and flags stale active items", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));

    const client = {
      get: vi.fn(async (path: string) => {
        if (path.includes("/_apis/work/teamsettings/iterations?")) {
          return {
            value: [
              {
                id: "iteration-12",
                name: "Sprint 12",
                path: "Allowed Project\\Sprint 12",
                attributes: {
                  startDate: "2026-03-20T00:00:00.000Z",
                  finishDate: "2026-03-28T00:00:00.000Z",
                },
              },
            ],
          };
        }

        if (path.includes("/_apis/wit/workitems?ids=301,302,303,304")) {
          return {
            value: [
              {
                id: 301,
                fields: {
                  "System.Title": "Plan validation changes",
                  "System.State": "New",
                  "System.ChangedDate": "2026-03-23T08:00:00.000Z",
                },
              },
              {
                id: 302,
                fields: {
                  "System.Title": "Implement retry fix",
                  "System.State": "Active",
                  "System.AssignedTo": { displayName: "Morgan" },
                  "System.ChangedDate": "2026-03-19T09:00:00.000Z",
                },
              },
              {
                id: 303,
                fields: {
                  "System.Title": "Review pipeline docs",
                  "System.State": "Resolved",
                  "System.ChangedDate": "2026-03-22T14:00:00.000Z",
                },
              },
              {
                id: 304,
                fields: {
                  "System.Title": "Close release tasks",
                  "System.State": "Closed",
                  "System.ChangedDate": "2026-03-22T15:00:00.000Z",
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string, body: unknown) => {
        expect(path).toBe("/Allowed%20Project/_apis/wit/wiql?api-version=7.1");
        expect((body as { query: string }).query).toContain(
          "[System.IterationPath] UNDER 'Allowed Project\\Sprint 12'",
        );
        return { workItems: [{ id: 301 }, { id: 302 }, { id: 303 }, { id: 304 }] };
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.getSprintSummary({
      project: "Allowed Project",
      team: "Platform Team",
    });

    expect(summary).toEqual({
      sprint: {
        name: "Sprint 12",
        startDate: "2026-03-20T00:00:00.000Z",
        endDate: "2026-03-28T00:00:00.000Z",
        daysRemaining: 5,
      },
      totalItems: 4,
      byState: {
        new: 1,
        active: 1,
        resolved: 1,
        closed: 1,
      },
      completionPercentage: 50,
      atRiskItems: [
        {
          id: 302,
          title: "Implement retry fix",
          state: "Active",
          assignedTo: "Morgan",
          daysSinceUpdate: 4,
        },
      ],
    });
  });

  it("calculates sprint capacity from team members and days off", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.includes("/_apis/work/teamsettings/iterations?$timeframe=current")) {
          return {
            value: [
              {
                id: "iteration-12",
                name: "Sprint 12",
                path: "Allowed Project\\Sprint 12",
                attributes: {
                  startDate: "2026-03-23T00:00:00.000Z",
                  finishDate: "2026-03-28T00:00:00.000Z",
                },
              },
            ],
          };
        }

        if (path.endsWith("/iterations/iteration-12/capacities?api-version=7.1")) {
          return {
            value: [
              {
                teamMember: { displayName: "Alex" },
                activities: [{ capacityPerDay: 6 }],
                daysOff: [
                  {
                    start: "2026-03-25T00:00:00.000Z",
                    end: "2026-03-26T00:00:00.000Z",
                  },
                ],
              },
              {
                teamMember: { displayName: "Jamie" },
                activities: [{ capacityPerDay: "4" }],
                daysOff: [],
              },
            ],
          };
        }

        if (path.endsWith("/iterations/iteration-12/teamdaysoff?api-version=7.1")) {
          return {
            daysOff: [
              {
                start: "2026-03-24T00:00:00.000Z",
                end: "2026-03-25T00:00:00.000Z",
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.getSprintCapacity({
      project: "Allowed Project",
      team: "Platform Team",
    });

    expect(summary).toEqual({
      sprint: {
        name: "Sprint 12",
        startDate: "2026-03-23T00:00:00.000Z",
        endDate: "2026-03-28T00:00:00.000Z",
      },
      totalAvailableHours: 34,
      members: [
        {
          displayName: "Alex",
          capacityPerDay: 6,
          daysOff: 1,
          availableHours: 18,
        },
        {
          displayName: "Jamie",
          capacityPerDay: 4,
          daysOff: 0,
          availableHours: 16,
        },
      ],
      teamDaysOff: [
        {
          start: "2026-03-24T00:00:00.000Z",
          end: "2026-03-25T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns dependency links across projects for a work item", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.includes("/_apis/wit/workitems/500?") && path.includes("$expand=relations")) {
          expect(path).not.toContain("fields=");
          return {
            id: 500,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Coordinate release",
              "System.State": "Active",
            },
            relations: [
              {
                rel: "System.LinkTypes.Dependency-Reverse",
                url: "https://dev.azure.com/example/_apis/wit/workItems/401",
              },
              {
                rel: "System.LinkTypes.Dependency-Forward",
                url: "https://dev.azure.com/example/_apis/wit/workItems/402",
              },
            ],
          };
        }

        if (path.includes("/_apis/wit/workitems/401?")) {
          return {
            id: 401,
            url: "https://example.invalid/items/401",
            fields: {
              "System.TeamProject": "Shared Project",
              "System.Title": "Complete shared dependency",
              "System.State": "Active",
            },
          };
        }

        if (path.includes("/_apis/wit/workitems/402?")) {
          return {
            id: 402,
            url: "https://example.invalid/items/402",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Follow-up rollout task",
              "System.State": "New",
            },
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project", "Shared Project"],
    });

    const summary = await services.getCrossProjectDependencies({
      project: "Allowed Project",
      workItemId: 500,
    });

    expect(summary).toEqual({
      workItem: {
        id: 500,
        title: "Coordinate release",
        project: "Allowed Project",
        state: "Active",
      },
      blockedBy: [
        {
          id: 401,
          title: "Complete shared dependency",
          project: "Shared Project",
          state: "Active",
          url: "https://example.invalid/items/401",
        },
      ],
      blocking: [
        {
          id: 402,
          title: "Follow-up rollout task",
          project: "Allowed Project",
          state: "New",
          url: "https://example.invalid/items/402",
        },
      ],
      crossProjectCount: 1,
    });
  });

  it("loads dashboard widget settings and query-backed work items", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/dashboard/dashboards/dashboard-1/widgets/widget-7?api-version=7.1-preview.2"
        ) {
          return {
            name: "Open Bugs",
            contributionId: "ms.vss-dashboards-web.Microsoft.VisualStudioOnline.Dashboards.QueryScalarWidget",
            settings: JSON.stringify({
              queryId: "query-123",
              title: "Open Bugs",
            }),
          };
        }

        if (
          path === "/Allowed%20Project/_apis/wit/wiql/query-123?api-version=7.1"
        ) {
          return {
            workItems: [{ id: 501 }],
          };
        }

        if (path.includes("/_apis/wit/workitems?ids=501")) {
          return {
            value: [
              {
                id: 501,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Fix dashboard bug",
                  "System.State": "Active",
                  "System.AssignedTo": { displayName: "Taylor" },
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.getDashboardWidgetData({
      project: "Allowed Project",
      dashboardId: "dashboard-1",
      widgetId: "widget-7",
    });

    expect(summary).toEqual({
      widgetName: "Open Bugs",
      widgetType:
        "ms.vss-dashboards-web.Microsoft.VisualStudioOnline.Dashboards.QueryScalarWidget",
      queryId: "query-123",
      queryResults: [
        {
          id: 501,
          title: "Fix dashboard bug",
          state: "Active",
          assignedTo: "Taylor",
        },
      ],
      rawSettings: {
        queryId: "query-123",
        title: "Open Bugs",
      },
    });
  });

  it("analyzes failed tests and linked work item impact", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/test/runs/88?api-version=7.1") {
          return {
            id: 88,
            name: "Nightly Validation",
            totalTests: 24,
            failedTests: 2,
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/runs/88/results?outcomes=Failed&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 10,
                testCaseTitle: "Login should succeed",
                errorMessage: "Expected status 200",
              },
              {
                id: 11,
                testCaseTitle: "Checkout should succeed",
                errorMessage: "Expected one payment record",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/runs/88/results/10/workitems?api-version=7.1"
        ) {
          return {
            value: [{ id: 601 }],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/runs/88/results/11/workitems?api-version=7.1"
        ) {
          return {
            value: [],
          };
        }

        if (path.includes("/_apis/wit/workitems/601?")) {
          return {
            id: 601,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Investigate failed login path",
              "System.State": "Active",
            },
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.analyzeTestFailureImpact({
      project: "Allowed Project",
      testRunId: 88,
    });

    expect(summary.testRun).toEqual({
      id: 88,
      name: "Nightly Validation",
      totalTests: 24,
      failedTests: 2,
    });
    expect(summary.failedTests).toEqual([
      {
        testName: "Login should succeed",
        errorMessage: "Expected status 200",
        linkedWorkItems: [
          {
            id: 601,
            title: "Investigate failed login path",
            state: "Active",
            project: "Allowed Project",
          },
        ],
      },
      {
        testName: "Checkout should succeed",
        errorMessage: "Expected one payment record",
        linkedWorkItems: [],
      },
    ]);
    expect(summary.impactSummary).toContain("2 failed tests");
    expect(summary.impactSummary).toContain("1 unique impacted work items");
  });

  it("analyzes a failed pipeline and trims task logs to the first 50 lines", async () => {
    const longLog = Array.from({ length: 60 }, (_, index) => {
      if (index === 2) {
        return "##[error] Unit tests failed";
      }

      return `log line ${index + 1}`;
    }).join("\n");

    const client = {
      get: vi.fn(async (path: string) => {
        if (path.endsWith("/_apis/build/builds/77?api-version=7.1")) {
          return {
            buildNumber: "2026.03.23.4",
            definition: { name: "CI" },
            requestedBy: { displayName: "Taylor" },
            startTime: "2026-03-23T09:00:00.000Z",
            finishTime: "2026-03-23T09:10:00.000Z",
          };
        }

        if (path.endsWith("/_apis/build/builds/77/timeline?api-version=7.1")) {
          return {
            records: [
              {
                id: "task-1",
                type: "Task",
                name: "Run tests",
                result: "failed",
                log: { id: 9001 },
              },
              {
                id: "task-2",
                type: "Task",
                name: "Publish artifacts",
                result: "succeeded",
                log: { id: 9002 },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
      getText: vi.fn(async (path: string) => {
        expect(path).toBe(
          "/Allowed%20Project/_apis/build/builds/77/logs/9001?api-version=7.1",
        );
        return longLog;
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const analysis = await services.analyzePipelineFailure({
      project: "Allowed Project",
      runId: 77,
    });

    expect(analysis.buildNumber).toBe("2026.03.23.4");
    expect(analysis.definition).toBe("CI");
    expect(analysis.requestedBy).toBe("Taylor");
    expect(analysis.failedTasks).toHaveLength(1);
    expect(analysis.failedTasks[0]?.name).toBe("Run tests");
    expect(analysis.failedTasks[0]?.log.split(/\r?\n/)).toHaveLength(50);
    expect(analysis.failedTasks[0]?.log).toContain("##[error] Unit tests failed");
    expect(analysis.summary).toContain("Run tests");
    expect(analysis.summary).toContain("Unit tests failed");
  });

  it("maps dashboard widget 404s to clear contextual messages", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        throw new AzureDevOpsApiError(path, 404, "corr-widget");
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.getDashboardWidgetData({
        project: "Allowed Project",
        dashboardId: "dashboard-1",
        widgetId: "widget-7",
      }),
    ).rejects.toMatchObject({
      userMessage: expect.stringContaining(
        'Dashboard widget "widget-7" was not found on dashboard "dashboard-1" in project "Allowed Project".',
      ),
    });
  });

  it("maps 404s to clear contextual messages", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        throw new AzureDevOpsApiError(path, 404, "corr-404");
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.analyzePipelineFailure({
        project: "Allowed Project",
        runId: 77,
      }),
    ).rejects.toMatchObject({
      userMessage: expect.stringContaining(
        'Pipeline run 77 was not found in project "Allowed Project".',
      ),
    });
  });
});
