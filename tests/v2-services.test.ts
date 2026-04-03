import { describe, expect, it, vi } from "vitest";
import { MAX_TOP, WIKI_CONTENT_MAX_LENGTH } from "../src/constants.js";
import { createAzureDevOpsServices } from "../src/domain/index.js";

describe("Azure DevOps v2 services", () => {
  it("lists test plans and test suites", async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            {
              id: 1,
              name: "Regression Plan",
              state: "Active",
              iteration: "Allowed Project\\Sprint 1",
              areaPath: "Allowed Project\\QA",
            },
          ],
        })
        .mockResolvedValueOnce({
          value: [
            {
              id: 8,
              name: "Smoke Suite",
              suiteType: "staticTestSuite",
              parentSuite: { id: 1 },
              testCaseCount: 3,
            },
          ],
        }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const plans = await services.listTestPlans("Allowed Project");
    const suites = await services.listTestSuites("Allowed Project", 1);

    expect(plans).toHaveLength(1);
    expect(plans[0]?.name).toBe("Regression Plan");
    expect(suites[0]?.parentSuiteId).toBe(1);
  });

  it("merges test cases from suite entries, points, and work item fallback titles", async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          value: [{ id: 101 }, { id: 102 }],
        })
        .mockResolvedValueOnce({
          value: [
            {
              testCase: { id: "101" },
              assignedTo: { displayName: "Tester One" },
              configuration: { name: "Windows 11" },
              workItemProperties: [
                {
                  workItem: {
                    key: "System.Title",
                    value: "Login works",
                  },
                },
              ],
            },
            {
              testCase: { id: "101" },
              assignedTo: { displayName: "Tester One" },
              configuration: { name: "Windows 11" },
            },
            {
              testCase: { id: "102" },
              assignedTo: { displayName: "Tester Two" },
              configuration: { name: "Chrome" },
            },
          ],
        })
        .mockResolvedValueOnce({
          value: [
            {
              id: 102,
              fields: {
                "System.Title": "Checkout flow",
              },
            },
          ],
        }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const cases = await services.listTestCases("Allowed Project", 1, 10);

    expect(cases).toHaveLength(2);
    expect(cases[0]).toEqual({
      workItemId: 101,
      workItemName: "Login works",
      pointAssignments: [{ tester: "Tester One", configuration: "Windows 11" }],
    });
    expect(cases[1]?.workItemName).toBe("Checkout flow");
  });

  it("uses default and capped top values for test runs", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [{ id: 1, name: "Nightly", state: "Completed" }],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await services.listTestRuns("Allowed Project");
    await services.listTestRuns("Allowed Project", 999);

    expect(client.get).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("$top=10"),
    );
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`$top=${MAX_TOP}`),
    );
  });

  it("lists pipelines, pipeline runs, and pipeline artifacts", async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          value: [{ id: 7, name: "CI", path: "\\Builds", type: "build" }],
        })
        .mockResolvedValueOnce({
          value: [
            {
              id: 44,
              buildNumber: "2026.03.18.1",
              status: "completed",
              result: "succeeded",
              definition: { name: "CI" },
              requestedBy: { displayName: "Gytis" },
            },
          ],
        })
        .mockResolvedValueOnce([
          {
            id: 2,
            name: "drop",
            resource: {
              type: "Container",
              downloadUrl: "https://example.invalid/artifact",
            },
            source: "44",
          },
        ]),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const pipelines = await services.listPipelines("Allowed Project");
    const runs = await services.listPipelineRuns("Allowed Project", 7, 5);
    const artifacts = await services.listPipelineArtifacts("Allowed Project", 44);

    expect(pipelines[0]?.name).toBe("CI");
    expect(runs[0]?.definitionName).toBe("CI");
    expect(artifacts[0]?.downloadUrl).toBe("https://example.invalid/artifact");
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("definitions=7"),
    );
  });

  it("returns wiki content with normalization and truncation metadata", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        path: "/Home",
        gitItemPath: "/Home.md",
        isParentPage: false,
        content: "x".repeat(WIKI_CONTENT_MAX_LENGTH + 25),
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const page = await services.getWikiPage("Allowed Project", "Project Wiki", "Home");

    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining("path=%2FHome"),
    );
    expect(page.path).toBe("/Home");
    expect(page.content).toHaveLength(WIKI_CONTENT_MAX_LENGTH);
    expect(page.isTruncated).toBe(true);
  });

  it("enforces the allowlist on all new project-scoped services", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const blockedCalls = [
      () => services.listTestPlans("Blocked Project"),
      () => services.listTestSuites("Blocked Project", 1),
      () => services.listTestCases("Blocked Project", 1, 2),
      () => services.listTestRuns("Blocked Project", 5),
      () => services.listPipelines("Blocked Project"),
      () => services.listPipelineRuns("Blocked Project", 1, 5),
      () => services.listPipelineArtifacts("Blocked Project", 10),
      () => services.getWikiPage("Blocked Project", "Wiki", "/Home"),
      () => services.getSprintCapacity({ project: "Blocked Project", team: "Platform Team" }),
      () =>
        services.getCrossProjectDependencies({
          project: "Blocked Project",
          workItemId: 101,
        }),
      () =>
        services.getDashboardWidgetData({
          project: "Blocked Project",
          dashboardId: "dashboard-1",
          widgetId: "widget-1",
        }),
      () =>
        services.analyzeTestFailureImpact({
          project: "Blocked Project",
          testRunId: 77,
        }),
    ];

    for (const blockedCall of blockedCalls) {
      await expect(blockedCall()).rejects.toThrow(/Blocked Project/);
    }

    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });
});
