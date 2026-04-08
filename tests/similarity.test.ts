import { describe, expect, it } from "vitest";
import type { WorkItemFull } from "../src/models.js";
import {
  assessWorkItemSimilarity,
  clusterSimilarityCandidates,
} from "../src/domain/similarity.js";

function buildWorkItem(
  id: number,
  overrides: Partial<WorkItemFull> = {},
): WorkItemFull {
  return {
    id,
    project: "Allowed Project",
    title: `Work item ${id}`,
    state: "Active",
    workItemType: "Bug",
    assignedTo: "Gytis",
    createdBy: "Gytis",
    changedBy: "Gytis",
    createdDate: "2026-04-01T08:00:00Z",
    changedDate: "2026-04-02T08:00:00Z",
    closedDate: null,
    areaPath: "Allowed Project\\Frontend",
    iterationPath: "Allowed Project\\Sprint 1",
    tags: "frontend; urgent",
    reason: null,
    priority: 1,
    severity: "2 - High",
    commentCount: 0,
    activityDate: "2026-04-02T08:00:00Z",
    description: "Login page fails during save and validation flow.",
    url: `https://example.invalid/workitems/${id}`,
    rev: 1,
    fields: {
      "Custom.Component": "frontend",
    },
    relations: [],
    ...overrides,
  };
}

describe("similarity helpers", () => {
  it("scores clear positive matches with explainable reasons", () => {
    const source = buildWorkItem(101, {
      title: "Login save fails on validation error",
      description: "Saving the login form fails when validation returns a backend error.",
      tags: "frontend; login; urgent",
      relations: [
        {
          rel: "ArtifactLink",
          url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
          linkedWorkItemId: null,
          attributes: {},
        },
      ],
    });
    const candidate = buildWorkItem(202, {
      title: "Login form save failure after validation error",
      description: "The login form save flow fails after the backend returns a validation error.",
      tags: "frontend; login",
      relations: [
        {
          rel: "ArtifactLink",
          url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
          linkedWorkItemId: null,
          attributes: {},
        },
      ],
    });

    const assessment = assessWorkItemSimilarity(source, candidate, ["Custom.Component"]);

    expect(assessment.similarityScore).toBeGreaterThan(0.5);
    expect(assessment.duplicateScore).toBeGreaterThanOrEqual(assessment.similarityScore);
    expect(assessment.reasons.map((reason) => reason.kind)).toEqual(
      expect.arrayContaining(["title", "description", "tags", "customField", "linkedArtifact"]),
    );
  });

  it("keeps clearly unrelated items at a low score", () => {
    const source = buildWorkItem(101, {
      title: "Login save fails on validation error",
      description: "Saving the login form fails when validation returns a backend error.",
      tags: "frontend; login; urgent",
    });
    const candidate = buildWorkItem(303, {
      title: "Data warehouse refresh is delayed overnight",
      description: "Nightly ETL refresh finishes late because of an infrastructure dependency.",
      workItemType: "Task",
      areaPath: "Allowed Project\\Data",
      iterationPath: "Allowed Project\\Sprint 9",
      tags: "etl; warehouse",
      assignedTo: "Another User",
      createdBy: "Another User",
      fields: {
        "Custom.Component": "data",
      },
    });

    const assessment = assessWorkItemSimilarity(source, candidate, ["Custom.Component"]);

    expect(assessment.similarityScore).toBeLessThan(0.2);
    expect(assessment.reasons).toEqual([]);
  });

  it("clusters related items and leaves unrelated items outside the cluster", () => {
    const items = [
      buildWorkItem(101, {
        title: "Login save fails on validation error",
        description: "Saving the login form fails when validation returns a backend error.",
        tags: "frontend; login; urgent",
      }),
      buildWorkItem(202, {
        title: "Login form save failure after validation error",
        description: "The login form save flow fails after backend validation errors.",
        tags: "frontend; login",
      }),
      buildWorkItem(303, {
        title: "ETL warehouse refresh is delayed overnight",
        description: "Nightly ETL refresh finishes late because of a downstream dependency.",
        areaPath: "Allowed Project\\Data",
        iterationPath: "Allowed Project\\Sprint 9",
        tags: "etl; warehouse",
        assignedTo: "Another User",
        createdBy: "Another User",
      }),
    ];

    const clusters = clusterSimilarityCandidates(items, [], 0.35, 2, true);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.memberIds).toEqual([101, 202]);
    expect(clusters[0]?.commonSignals.length).toBeGreaterThan(0);
    expect(clusters[0]?.raw).toEqual(
      expect.objectContaining({
        members: expect.any(Array),
        edges: expect.any(Array),
      }),
    );
  });
});
