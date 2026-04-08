import { describe, expect, it } from "vitest";
import {
  buildSearchWorkItemsAdvancedWiql,
  buildSearchWorkItemsWiql,
} from "../src/domain/workItems.js";
import {
  mapWorkItem,
  mapWorkItemComment,
  mapWorkItemFull,
  mapWorkItemRevision,
  mapWorkItemType,
  mapWorkItemUpdate,
} from "../src/domain/shared.js";

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

  it("builds an advanced WIQL query with categories, tags, dates, and ordering", () => {
    const wiql = buildSearchWorkItemsAdvancedWiql({
      project: "My Project",
      workItemTypes: ["Bug", "Incident"],
      categoryReferenceNames: ["Microsoft.BugCategory"],
      categoryNames: ["Bug Category"],
      resolvedWorkItemTypes: ["Bug", "Incident"],
      states: ["Active", "Resolved"],
      assignedTo: "Jane O'Neil",
      createdBy: "Creator One",
      changedBy: "Editor One",
      tagsAny: ["prod", "sev1"],
      tagsAll: ["customer escalation"],
      areaPaths: ["My Project\\Support"],
      iterationPaths: ["My Project\\Sprint 1"],
      text: "login bug",
      ids: [101, 202],
      priority: [1, 2],
      severity: ["1 - Critical"],
      reason: ["Investigating"],
      createdDateFrom: "2026-03-01",
      createdDateTo: "2026-03-31",
      changedDateFrom: "2026-04-01",
      changedDateTo: "2026-04-30",
      closedDateFrom: "2026-05-01",
      closedDateTo: "2026-05-31",
      resolvedDateFrom: "2026-06-01",
      resolvedDateTo: "2026-06-30",
      top: 25,
      orderBy: [
        { field: "priority", direction: "asc" },
        { field: "changedDate", direction: "desc" },
      ],
    });

    expect(wiql).toContain("[System.TeamProject] = 'My Project'");
    expect(wiql).toContain("[System.WorkItemType] IN ('Bug', 'Incident')");
    expect(wiql).toContain("[System.AssignedTo] = 'Jane O''Neil'");
    expect(wiql).toContain("[System.Tags] CONTAINS 'prod'");
    expect(wiql).toContain("[System.Tags] CONTAINS 'customer escalation'");
    expect(wiql).toContain("[System.AreaPath] UNDER 'My Project\\Support'");
    expect(wiql).toContain("[System.IterationPath] UNDER 'My Project\\Sprint 1'");
    expect(wiql).toContain("[System.CreatedDate] >= '2026-03-01'");
    expect(wiql).toContain("[Microsoft.VSTS.Common.ClosedDate] <= '2026-05-31'");
    expect(wiql).toContain(
      "ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC",
    );
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
        "System.CreatedBy": { displayName: "Creator" },
        "System.ChangedBy": { displayName: "Editor" },
        "System.CreatedDate": "2026-03-18T07:00:00Z",
        "System.ChangedDate": "2026-03-18T08:00:00Z",
        "System.AreaPath": "Project One\\Support",
        "System.IterationPath": "Project One\\Sprint 1",
        "System.Tags": "prod;sev1",
        "System.Reason": "Investigating",
        "System.CommentCount": 4,
        "Microsoft.VSTS.Common.Priority": 1,
        "Microsoft.VSTS.Common.Severity": "1 - Critical",
        "Microsoft.VSTS.Common.ClosedDate": "2026-03-19T08:00:00Z",
        "System.Description": "<p>Hello <strong>world</strong></p>",
      },
    });

    expect(item.id).toBe(123);
    expect(item.assignedTo).toBe("Gytis");
    expect(item.createdBy).toBe("Creator");
    expect(item.changedBy).toBe("Editor");
    expect(item.areaPath).toBe("Project One\\Support");
    expect(item.tags).toBe("prod;sev1");
    expect(item.commentCount).toBe(4);
    expect(item.severity).toBe("1 - Critical");
    expect(item.description).toBe("Hello world");
  });

  it("maps full work items with fields, relations, links, and optional raw payload", () => {
    const item = mapWorkItemFull(
      {
        id: 321,
        rev: 7,
        url: "https://example/items/321",
        commentVersionRef: {
          commentId: 12,
          version: 3,
        },
        _links: {
          self: { href: "https://example/items/321" },
          html: { href: "https://example/html/321" },
        },
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: "https://example/_apis/wit/workItems/456",
            attributes: {
              name: "Child",
            },
          },
        ],
        fields: {
          "System.TeamProject": "Project One",
          "System.Title": "Full bug",
          "System.State": "Active",
          "System.WorkItemType": "Bug",
          "System.AssignedTo": { displayName: "Gytis" },
          "System.Description": "<div>Body</div>",
          Custom: "Value",
        },
      },
      {
        includeRelations: true,
        includeLinks: true,
        includeRaw: true,
      },
    );

    expect(item.id).toBe(321);
    expect(item.rev).toBe(7);
    expect(item.fields.Custom).toBe("Value");
    expect(item.links.self).toBe("https://example/items/321");
    expect(item.relations[0]?.linkedWorkItemId).toBe(456);
    expect(item.commentVersionRef).toEqual({
      commentId: 12,
      version: 3,
    });
    expect(item.raw).toBeDefined();
  });

  it("keeps get_work_item_full payload light unless relations or links are requested", () => {
    const item = mapWorkItemFull({
      id: 77,
      _links: {
        self: { href: "https://example/items/77" },
      },
      relations: [
        {
          rel: "System.LinkTypes.Related",
          url: "https://example/_apis/wit/workItems/78",
        },
      ],
      fields: {
        "System.TeamProject": "Project One",
        "System.Title": "Light payload",
      },
    });

    expect(item.relations).toBeUndefined();
    expect(item.links).toBeUndefined();
    expect(item._links).toBeUndefined();
  });

  it("maps work item comments, updates, and revisions with audit-friendly fields and optional raw payloads", () => {
    const comment = mapWorkItemComment(
      {
        id: 12,
        workItemId: 321,
        text: "Need logs",
        createdBy: { displayName: "Reporter" },
        modifiedBy: { displayName: "Editor" },
        createdDate: "2026-04-01T08:00:00Z",
        modifiedDate: "2026-04-01T09:00:00Z",
      },
      true,
    );
    const update = mapWorkItemUpdate(
      {
        id: 44,
        workItemId: 321,
        rev: 7,
        revisedBy: { displayName: "Editor" },
        revisedDate: "2026-04-01T10:00:00Z",
        fields: {
          "System.State": {
            oldValue: "New",
            newValue: "Active",
          },
          "System.AssignedTo": {
            newValue: "Gytis",
          },
        },
      },
      true,
    );
    const revision = mapWorkItemRevision(
      {
        id: 321,
        rev: 7,
        fields: {
          "System.Title": "Investigate incident",
          "System.State": "Active",
          "System.WorkItemType": "Incident",
          "System.CreatedDate": "2026-04-01T07:00:00Z",
          "System.ChangedDate": "2026-04-01T10:00:00Z",
          "System.ChangedBy": { displayName: "Editor" },
        },
      },
      true,
    );

    expect(comment.commentId).toBe(12);
    expect(comment.workItemId).toBe(321);
    expect(comment.raw).toBeDefined();
    expect(update.updateId).toBe(44);
    expect(update.workItemId).toBe(321);
    expect(update.changedFields).toEqual(["System.State", "System.AssignedTo"]);
    expect(update.raw).toBeDefined();
    expect(revision.workItemId).toBe(321);
    expect(revision.changedBy).toBe("Editor");
    expect(revision.changedDate).toBe("2026-04-01T10:00:00Z");
    expect(revision.state).toBe("Active");
    expect(revision.raw).toBeDefined();
  });

  it("maps work item types with optional raw payloads", () => {
    const item = mapWorkItemType(
      {
        name: "Incident",
        referenceName: "Custom.Incident",
        description: "Track incidents",
        color: "FF0000",
        url: "https://example.invalid/_apis/wit/workItemTypes/Incident",
      },
      true,
    );

    expect(item.name).toBe("Incident");
    expect(item.raw).toEqual({
      name: "Incident",
      referenceName: "Custom.Incident",
      description: "Track incidents",
      color: "FF0000",
      url: "https://example.invalid/_apis/wit/workItemTypes/Incident",
    });
  });
});
