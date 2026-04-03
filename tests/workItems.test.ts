import { describe, expect, it } from "vitest";
import { buildSearchWorkItemsWiql } from "../src/domain/workItems.js";
import { mapWorkItem } from "../src/domain/shared.js";

describe("work item helpers", () => {
  it("builds a WIQL query with project, assignee, state, and text filters", () => {
    const wiql = buildSearchWorkItemsWiql({
      project: "My Project",
      assignedToMe: true,
      state: "Active",
      text: "login bug",
      top: 10,
    });

    expect(wiql).toContain("[System.TeamProject] = 'My Project'");
    expect(wiql).toContain("[System.AssignedTo] = @Me");
    expect(wiql).toContain("[System.State] = 'Active'");
    expect(wiql).toContain("[System.Title] CONTAINS 'login bug'");
  });

  it("uses allowlist projects when no explicit project is provided", () => {
    const wiql = buildSearchWorkItemsWiql({}, ["Project One", "Project Two"]);

    expect(wiql).toContain("[System.TeamProject] IN ('Project One', 'Project Two')");
  });

  it("maps work items and strips HTML descriptions", () => {
    const item = mapWorkItem({
      id: 123,
      url: "https://example/items/123",
      fields: {
        "System.TeamProject": "Project One",
        "System.Title": "Fix login flow",
        "System.State": "Active",
        "System.WorkItemType": "Bug",
        "System.AssignedTo": { displayName: "Gytis" },
        "System.CreatedDate": "2026-03-18T07:00:00Z",
        "System.ChangedDate": "2026-03-18T08:00:00Z",
        "Microsoft.VSTS.Common.Priority": 1,
        "System.Description": "<p>Hello <strong>world</strong></p>",
      },
    });

    expect(item.id).toBe(123);
    expect(item.assignedTo).toBe("Gytis");
    expect(item.description).toBe("Hello world");
  });
});
