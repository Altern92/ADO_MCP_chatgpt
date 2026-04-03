import { describe, expect, it } from "vitest";
import { MAX_TOP } from "../src/constants.js";
import {
  clampTop,
  mapPipeline,
  mapPipelineArtifact,
  mapPipelineRun,
  mapTestPlan,
  mapTestRun,
  mapTestSuite,
  mapWikiPage,
} from "../src/domain/shared.js";

describe("v2 shared helpers", () => {
  it("clamps recent-list top values to safe bounds", () => {
    expect(clampTop(undefined, 10)).toBe(10);
    expect(clampTop(0, 10)).toBe(1);
    expect(clampTop(999, 10)).toBe(MAX_TOP);
  });

  it("maps test and pipeline response shapes into summaries", () => {
    const plan = mapTestPlan({
      id: 12,
      name: "Release Plan",
      state: "Active",
      startDate: "2026-03-18T08:00:00Z",
      endDate: "2026-03-20T08:00:00Z",
      iteration: "Project\\Iteration 12",
      areaPath: "Project\\QA",
    });
    const suite = mapTestSuite({
      id: 25,
      name: "Smoke",
      suiteType: "staticTestSuite",
      parentSuite: { id: 12 },
      testCaseCount: 4,
    });
    const run = mapTestRun({
      id: 7,
      name: "Nightly",
      state: "Completed",
      totalTests: 20,
      passedTests: 18,
      failedTests: 2,
      startedDate: "2026-03-18T01:00:00Z",
      completedDate: "2026-03-18T01:10:00Z",
    });
    const pipeline = mapPipeline({
      id: 3,
      name: "CI",
      path: "\\Builds",
      type: "build",
      queueStatus: "enabled",
    });
    const pipelineRun = mapPipelineRun({
      id: 101,
      buildNumber: "2026.03.18.1",
      status: "completed",
      result: "succeeded",
      startTime: "2026-03-18T07:00:00Z",
      finishTime: "2026-03-18T07:05:00Z",
      definition: { name: "CI" },
      requestedBy: { displayName: "Gytis" },
    });
    const artifact = mapPipelineArtifact({
      id: 1,
      name: "drop",
      resource: {
        type: "Container",
        downloadUrl: "https://example.invalid/download",
      },
      source: "101",
    });

    expect(plan.name).toBe("Release Plan");
    expect(suite.parentSuiteId).toBe(12);
    expect(run.failedTests).toBe(2);
    expect(pipeline.queueStatus).toBe("enabled");
    expect(pipelineRun.requestedBy).toBe("Gytis");
    expect(artifact.downloadUrl).toBe("https://example.invalid/download");
  });

  it("truncates wiki content and preserves metadata", () => {
    const page = mapWikiPage(
      {
        path: "/Home",
        gitItemPath: "/Home.md",
        isParentPage: true,
        content: "abcdef",
      },
      4,
    );

    expect(page.path).toBe("/Home");
    expect(page.gitItemPath).toBe("/Home.md");
    expect(page.isParentPage).toBe(true);
    expect(page.content).toBe("abcd");
    expect(page.contentLength).toBe(6);
    expect(page.isTruncated).toBe(true);
  });
});
