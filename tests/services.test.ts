import { describe, expect, it, vi } from "vitest";
import { createAzureDevOpsServices } from "../src/domain/index.js";

describe("Azure DevOps services", () => {
  it("lists projects and filters by allowlist", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          { id: "1", name: "Allowed Project", state: "wellFormed", visibility: "private" },
          { id: "2", name: "Blocked Project", state: "wellFormed", visibility: "private" },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const projects = await services.listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("Allowed Project");
  });

  it("searches work items via WIQL and then loads details", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            id: 101,
            url: "https://example/items/101",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Investigate flaky test",
              "System.State": "Active",
              "System.WorkItemType": "Task",
              "System.ChangedDate": "2026-03-18T08:00:00Z",
            },
          },
        ],
      }),
      post: vi.fn().mockResolvedValue({
        workItems: [{ id: 101 }],
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.searchWorkItems({
      project: "Allowed Project",
      assignedToMe: true,
      state: "Active",
      top: 5,
    });

    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(result.workItems).toHaveLength(1);
    expect(result.workItems[0]?.id).toBe(101);
  });

  it("preserves WIQL order when bulk work item details are returned in a different order", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            id: 101,
            url: "https://example/items/101",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Second in WIQL order",
              "System.State": "Active",
              "System.WorkItemType": "Task",
            },
          },
          {
            id: 202,
            url: "https://example/items/202",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "First in WIQL order",
              "System.State": "New",
              "System.WorkItemType": "Bug",
            },
          },
        ],
      }),
      post: vi.fn().mockResolvedValue({
        workItems: [{ id: 202 }, { id: 101 }],
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.searchWorkItems({
      project: "Allowed Project",
      top: 5,
    });

    expect(result.workItems.map((item) => item.id)).toEqual([202, 101]);
  });

  it("searches work items with advanced filters, category resolution, and ordering", async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            {
              name: "Bug Category",
              referenceName: "Microsoft.BugCategory",
              workItemTypes: [
                { name: "Bug", url: "https://example.invalid/_apis/wit/workItemTypes/Bug" },
                {
                  name: "Incident",
                  url: "https://example.invalid/_apis/wit/workItemTypes/Incident",
                },
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          value: [
            {
              id: 101,
              url: "https://example/items/101",
              fields: {
                "System.TeamProject": "Allowed Project",
                "System.Title": "Customer login fails",
                "System.State": "Active",
                "System.WorkItemType": "Bug",
                "System.AssignedTo": { displayName: "Gytis" },
                "System.CreatedBy": { displayName: "Reporter" },
                "System.ChangedBy": { displayName: "Editor" },
                "System.CreatedDate": "2026-03-18T07:00:00Z",
                "System.ChangedDate": "2026-03-18T08:00:00Z",
                "System.AreaPath": "Allowed Project\\Support",
                "System.IterationPath": "Allowed Project\\Sprint 1",
                "System.Tags": "prod;customer escalation",
                "System.Reason": "Investigating",
                "Microsoft.VSTS.Common.Priority": 1,
                "Microsoft.VSTS.Common.Severity": "1 - Critical",
              },
            },
          ],
        }),
      post: vi.fn().mockResolvedValue({
        workItems: [{ id: 101 }],
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.searchWorkItemsAdvanced({
      project: "Allowed Project",
      categoryReferenceNames: ["Microsoft.BugCategory"],
      workItemTypes: ["Bug", "Incident"],
      states: ["Active"],
      assignedTo: "Gytis",
      tagsAll: ["customer escalation"],
      areaPaths: ["Allowed Project\\Support"],
      orderBy: [{ field: "priority", direction: "asc" }],
      top: 3,
    });

    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.post).toHaveBeenCalledWith(
      expect.stringContaining("/Allowed%20Project/_apis/wit/wiql"),
      {
        query: expect.stringContaining(
          "[System.WorkItemType] IN ('Bug', 'Incident')",
        ),
      },
    );
    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      {
        query: expect.stringContaining(
          "[System.Tags] CONTAINS 'customer escalation'",
        ),
      },
    );
    expect(client.post).toHaveBeenCalledWith(
      expect.any(String),
      {
        query: expect.stringContaining(
          "ORDER BY [Microsoft.VSTS.Common.Priority] ASC",
        ),
      },
    );
    expect(result.query.resolvedWorkItemTypes).toEqual(["Bug", "Incident"]);
    expect(result.workItems).toHaveLength(1);
    expect(result.workItems[0]?.areaPath).toBe("Allowed Project\\Support");
  });

  it("preserves advanced WIQL order after the bulk work item lookup", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            id: 101,
            url: "https://example/items/101",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Second in result order",
              "System.State": "Active",
              "System.WorkItemType": "Bug",
            },
          },
          {
            id: 202,
            url: "https://example/items/202",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "First in result order",
              "System.State": "New",
              "System.WorkItemType": "Incident",
            },
          },
        ],
      }),
      post: vi.fn().mockResolvedValue({
        workItems: [{ id: 202 }, { id: 101 }],
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.searchWorkItemsAdvanced({
      project: "Allowed Project",
      states: ["Active", "New"],
      top: 5,
    });

    expect(result.workItems.map((item) => item.id)).toEqual([202, 101]);
  });

  it("loads full work item details with caller-controlled payload sections", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitems/101?%24expand=all&api-version=7.1") {
          return {
            id: 101,
            rev: 9,
            url: "https://example/items/101",
            commentVersionRef: {
              commentId: 55,
              version: 2,
            },
            _links: {
              self: { href: "https://example/items/101" },
              html: { href: "https://example/html/101" },
            },
            relations: [
              {
                rel: "System.LinkTypes.Dependency-Forward",
                url: "https://example/_apis/wit/workItems/202",
                attributes: {
                  name: "Successor",
                },
              },
              {
                rel: "AttachedFile",
                url: "https://example/_apis/wit/attachments/attachment-1",
                attributes: {
                  name: "dump.txt",
                  comment: "Crash dump",
                  resourceSize: 42,
                },
              },
            ],
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Investigate incident",
              "System.State": "Active",
              "System.WorkItemType": "Incident",
              "System.AssignedTo": { displayName: "Gytis" },
              "System.CreatedBy": { displayName: "Reporter" },
              "System.ChangedBy": { displayName: "Editor" },
              "System.CreatedDate": "2026-03-18T07:00:00Z",
              "System.ChangedDate": "2026-03-18T08:00:00Z",
              "System.AreaPath": "Allowed Project\\Support",
              "System.IterationPath": "Allowed Project\\Sprint 1",
              "System.Tags": "prod;sev1",
              "Custom.CustomerName": "Important Co",
            },
          };
        }

        if (
          path ===
          "/_apis/wit/workitems/101/comments?%24top=200&includeDeleted=true&%24expand=renderedText&api-version=7.1-preview.4"
        ) {
          return {
            comments: [
              {
                id: 5001,
                workItemId: 101,
                text: "Need customer logs",
                createdBy: { displayName: "Reporter" },
                createdDate: "2026-03-18T09:00:00Z",
                format: "markdown",
                version: 1,
                url: "https://example/comments/5001",
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/updates?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 77,
                workItemId: 101,
                rev: 10,
                revisedBy: { displayName: "Editor" },
                revisedDate: "2026-03-18T10:00:00Z",
                fields: {
                  "System.State": {
                    oldValue: "New",
                    newValue: "Active",
                  },
                },
                relations: {
                  added: [
                    {
                      rel: "AttachedFile",
                      url: "https://example/_apis/wit/attachments/attachment-1",
                    },
                  ],
                },
                url: "https://example/updates/77",
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/revisions?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 101,
                rev: 9,
                fields: {
                  "System.State": "Active",
                },
                relations: [
                  {
                    rel: "System.LinkTypes.Dependency-Forward",
                    url: "https://example/_apis/wit/workItems/202",
                  },
                ],
                url: "https://example/revisions/9",
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

    const result = await services.getWorkItemFull({
      id: 101,
      project: "Allowed Project",
      expand: "links",
      includeRelations: true,
      includeLinks: true,
      includeComments: true,
      includeUpdates: true,
      includeRevisions: true,
      includeAttachments: true,
      includeRaw: true,
    });

    expect(client.get).toHaveBeenCalledWith(
      "/_apis/wit/workitems/101?%24expand=all&api-version=7.1",
    );
    expect(result.fields["Custom.CustomerName"]).toBe("Important Co");
    expect(result.relations?.[0]?.linkedWorkItemId).toBe(202);
    expect(result.links?.html).toBe("https://example/html/101");
    expect(result.commentVersionRef).toEqual({
      commentId: 55,
      version: 2,
    });
    expect(result.comments?.[0]?.commentId).toBe(5001);
    expect(result.comments?.[0]?.raw).toBeDefined();
    expect(result.updates?.[0]?.changedFields).toEqual(["System.State"]);
    expect(result.updates?.[0]?.relations.added?.[0]?.rel).toBe("AttachedFile");
    expect(result.revisions?.[0]?.rev).toBe(9);
    expect(result.revisions?.[0]?.raw).toBeDefined();
    expect(result.attachments).toEqual([
      expect.objectContaining({
        id: "attachment-1",
        name: "dump.txt",
      }),
    ]);
    expect(result.raw).toBeDefined();
  });

  it("uses a light default get_work_item_full request when no heavy payload flags are requested", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 101,
        rev: 9,
        url: "https://example/items/101",
        fields: {
          "System.TeamProject": "Allowed Project",
          "System.Title": "Investigate incident",
          "Custom.CustomerName": "Important Co",
        },
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.getWorkItemFull({
      id: 101,
    });

    expect(client.get).toHaveBeenCalledWith("/_apis/wit/workitems/101?api-version=7.1");
    expect(result.fields["Custom.CustomerName"]).toBe("Important Co");
    expect(result.relations).toBeUndefined();
    expect(result.links).toBeUndefined();
    expect(result.comments).toBeUndefined();
    expect(result.raw).toBeUndefined();
  });

  it("lists work item link types with normalized traceability metadata", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            referenceName: "System.LinkTypes.Dependency-Forward",
            name: "Successor",
            url: "https://example.invalid/link-types/dependency-forward",
            attributes: {
              topology: "dependency",
              directional: true,
              editable: true,
              enabled: true,
              acyclic: true,
              singleTarget: false,
              usage: "workItemLink",
              oppositeEndReferenceName: "System.LinkTypes.Dependency-Reverse",
            },
          },
          {
            referenceName: "System.LinkTypes.Related",
            name: "Related",
            url: "https://example.invalid/link-types/related",
            attributes: {
              topology: "network",
              directional: false,
              editable: true,
              enabled: true,
              acyclic: false,
              singleTarget: false,
              usage: "workItemLink",
            },
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const linkTypes = await services.listWorkItemLinkTypes();

    expect(linkTypes).toEqual([
      {
        referenceName: "System.LinkTypes.Dependency-Forward",
        name: "Successor",
        oppositeReferenceName: "System.LinkTypes.Dependency-Reverse",
        topology: "dependency",
        category: "dependency",
        direction: "forward",
        enabled: true,
        editable: true,
        acyclic: true,
        directional: true,
        singleTarget: false,
        usage: "workItemLink",
        url: "https://example.invalid/link-types/dependency-forward",
        attributes: {
          topology: "dependency",
          directional: true,
          editable: true,
          enabled: true,
          acyclic: true,
          singleTarget: false,
          usage: "workItemLink",
          oppositeEndReferenceName: "System.LinkTypes.Dependency-Reverse",
        },
      },
      {
        referenceName: "System.LinkTypes.Related",
        name: "Related",
        oppositeReferenceName: null,
        topology: "network",
        category: "related",
        direction: "bidirectional",
        enabled: true,
        editable: true,
        acyclic: false,
        directional: false,
        singleTarget: false,
        usage: "workItemLink",
        url: "https://example.invalid/link-types/related",
        attributes: {
          topology: "network",
          directional: false,
          editable: true,
          enabled: true,
          acyclic: false,
          singleTarget: false,
          usage: "workItemLink",
        },
      },
    ]);
  });

  it("builds a cross-project work item relations graph with skipped relation diagnostics", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "System.LinkTypes.Dependency-Forward",
                name: "Successor",
                attributes: {
                  topology: "dependency",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: true,
                  singleTarget: false,
                  oppositeEndReferenceName: "System.LinkTypes.Dependency-Reverse",
                },
              },
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
              {
                referenceName: "System.LinkTypes.Related",
                name: "Related",
                attributes: {
                  topology: "network",
                  directional: false,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Root incident",
              "System.State": "Active",
              "System.WorkItemType": "Incident",
            },
            relations: [
              {
                rel: "System.LinkTypes.Dependency-Forward",
                url: "https://example.invalid/_apis/wit/workItems/202",
                attributes: { name: "Successor" },
              },
              {
                rel: "ArtifactLink",
                url: "vstfs:///Build/Build/123",
                attributes: { name: "Build" },
              },
              {
                rel: "System.LinkTypes.Related",
                url: "https://example.invalid/_apis/wit/workItems/909",
                attributes: { name: "Related" },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/202?$expand=relations&api-version=7.1") {
          return {
            id: 202,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Dependency task",
              "System.State": "Active",
              "System.WorkItemType": "Task",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
                attributes: { name: "Tested By" },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/303?$expand=relations&api-version=7.1") {
          return {
            id: 303,
            fields: {
              "System.TeamProject": "Shared Project",
              "System.Title": "Regression test case",
              "System.State": "Design",
              "System.WorkItemType": "Test Case",
            },
            relations: [],
          };
        }

        if (path === "/_apis/wit/workitems/909?$expand=relations&api-version=7.1") {
          return {
            id: 909,
            fields: {
              "System.TeamProject": "Blocked Project",
              "System.Title": "Hidden relation",
              "System.State": "Active",
              "System.WorkItemType": "Bug",
            },
            relations: [],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project", "Shared Project"],
    });

    const graph = await services.getWorkItemRelationsGraph({
      project: "Allowed Project",
      workItemId: 101,
      maxDepth: 2,
    });

    expect(graph.nodes.map((node) => node.id)).toEqual([101, 202, 303]);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        sourceId: 101,
        targetId: 202,
        category: "dependency",
      }),
      expect.objectContaining({
        sourceId: 202,
        targetId: 303,
        category: "test",
        isCrossProject: true,
      }),
    ]);
    expect(graph.skippedRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 101,
          reason: "non_work_item_relation",
        }),
        expect.objectContaining({
          sourceId: 101,
          targetId: 909,
          reason: "not_allowed",
        }),
      ]),
    );
    expect(graph.crossProjectNodeCount).toBe(1);
    expect(graph.crossProjectEdgeCount).toBe(1);
  });

  it("builds traceability chains from the normalized relations graph", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "System.LinkTypes.Dependency-Forward",
                name: "Successor",
                attributes: {
                  topology: "dependency",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: true,
                  singleTarget: false,
                  oppositeEndReferenceName: "System.LinkTypes.Dependency-Reverse",
                },
              },
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Root incident",
              "System.State": "Active",
              "System.WorkItemType": "Incident",
            },
            relations: [
              {
                rel: "System.LinkTypes.Dependency-Forward",
                url: "https://example.invalid/_apis/wit/workItems/202",
                attributes: { name: "Successor" },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/202?$expand=relations&api-version=7.1") {
          return {
            id: 202,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Dependency task",
              "System.State": "Active",
              "System.WorkItemType": "Task",
            },
            relations: [
              {
                rel: "System.LinkTypes.Dependency-Reverse",
                url: "https://example.invalid/_apis/wit/workItems/101",
                attributes: { name: "Predecessor" },
              },
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
                attributes: { name: "Tested By" },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/303?$expand=relations&api-version=7.1") {
          return {
            id: 303,
            fields: {
              "System.TeamProject": "Shared Project",
              "System.Title": "Regression test case",
              "System.State": "Design",
              "System.WorkItemType": "Test Case",
            },
            relations: [],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project", "Shared Project"],
    });

    const summary = await services.getTraceabilityChain({
      project: "Allowed Project",
      workItemId: 101,
      maxDepth: 3,
      relationTypes: ["dependency", "test"],
    });

    expect(summary.totalChains).toBe(1);
    expect(summary.chains).toEqual([
      {
        chainId: "101->202->303",
        nodeIds: [101, 202, 303],
        steps: [
          {
            fromId: 101,
            toId: 202,
            referenceName: "System.LinkTypes.Dependency-Forward",
            category: "dependency",
            direction: "forward",
          },
          {
            fromId: 202,
            toId: 303,
            referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
            category: "test",
            direction: "forward",
          },
        ],
        terminalNodeId: 303,
        terminalNodeProject: "Shared Project",
        terminalWorkItemType: "Test Case",
        containsCrossProjectItems: true,
        cycleDetected: true,
        endsAtMaxDepth: false,
      },
    ]);
  });

  it("lists linked work items as a node-centric summary with path context", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "System.LinkTypes.Dependency-Forward",
                name: "Successor",
                attributes: {
                  topology: "dependency",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: true,
                  singleTarget: false,
                  oppositeEndReferenceName: "System.LinkTypes.Dependency-Reverse",
                },
              },
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Root incident",
              "System.State": "Active",
              "System.WorkItemType": "Incident",
            },
            relations: [
              {
                rel: "System.LinkTypes.Dependency-Forward",
                url: "https://example.invalid/_apis/wit/workItems/202",
                attributes: { name: "Successor" },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/202?$expand=relations&api-version=7.1") {
          return {
            id: 202,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Dependency task",
              "System.State": "Active",
              "System.WorkItemType": "Task",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
                attributes: { name: "Tested By" },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/303?$expand=relations&api-version=7.1") {
          return {
            id: 303,
            fields: {
              "System.TeamProject": "Shared Project",
              "System.Title": "Regression test case",
              "System.State": "Design",
              "System.WorkItemType": "Test Case",
            },
            relations: [],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project", "Shared Project"],
    });

    const summary = await services.listLinkedWorkItems({
      project: "Allowed Project",
      workItemId: 101,
      maxDepth: 3,
    });

    expect(summary.root.id).toBe(101);
    expect(summary.totalLinkedWorkItems).toBe(2);
    expect(summary.linkedWorkItems).toEqual([
      expect.objectContaining({
        id: 202,
        pathCount: 1,
        relationTypes: ["Microsoft.VSTS.Common.TestedBy-Forward", "System.LinkTypes.Dependency-Forward"],
      }),
      expect.objectContaining({
        id: 303,
        isCrossProject: true,
        pathCount: 1,
        relationCategories: ["test"],
      }),
    ]);
    expect(summary.linkedWorkItems[1]?.pathsFromRoot).toEqual([
      expect.objectContaining({
        nodeIds: [101, 202, 303],
        terminalNodeId: 303,
        containsCrossProjectItems: true,
      }),
    ]);
  });

  it("lists direct work item test links with optional suite, plan, and recent run enrichment", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
              {
                referenceName: "System.LinkTypes.Related",
                name: "Related",
                attributes: {
                  topology: "network",
                  directional: false,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Root user story",
              "System.State": "Active",
              "System.WorkItemType": "User Story",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
                attributes: { name: "Tested By" },
              },
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/404",
                attributes: { name: "Tested By" },
              },
              {
                rel: "System.LinkTypes.Related",
                url: "https://example.invalid/_apis/wit/workItems/505",
                attributes: { name: "Related" },
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303,404&fields=")) {
          return {
            value: [
              {
                id: 303,
                url: "https://example.invalid/_apis/wit/workItems/303",
                fields: {
                  "System.TeamProject": "Shared Project",
                  "System.Title": "Regression test case",
                  "System.State": "Design",
                  "System.WorkItemType": "Test Case",
                },
              },
              {
                id: 404,
                url: "https://example.invalid/_apis/wit/workItems/404",
                fields: {
                  "System.TeamProject": "Blocked Project",
                  "System.Title": "Hidden test case",
                  "System.State": "Active",
                  "System.WorkItemType": "Test Case",
                },
              },
            ],
          };
        }

        if (path === "/Shared%20Project/_apis/test/runs/7001?api-version=7.1") {
          return {
            id: 7001,
            name: "Shared run 7001",
            state: "Completed",
            totalTests: 4,
            passedTests: 4,
            failedTests: 0,
            completedDate: "2026-04-06T11:00:00Z",
            url: "https://example.invalid/_apis/test/Runs/7001",
          };
        }

        if (path === "/Shared%20Project/_apis/test/runs/7002?api-version=7.1") {
          return {
            id: 7002,
            name: "Shared run 7002",
            state: "Completed",
            totalTests: 4,
            passedTests: 3,
            failedTests: 1,
            completedDate: "2026-04-05T11:00:00Z",
            url: "https://example.invalid/_apis/test/Runs/7002",
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string, body: unknown) => {
        if (path === "/Shared%20Project/_apis/test/points?%24top=200&%24skip=0&api-version=7.1") {
          expect(body).toEqual({
            pointsFilter: {
              testcaseIds: [303],
            },
          });

          return {
            points: [
              {
                id: 9001,
                url: "https://example.invalid/Shared%20Project/_apis/test/Plans/12/Suites/1002/Points/9001",
                testCase: { id: 303, name: "Regression test case" },
                testSuite: { id: 1002, name: "Regression Suite" },
                testPlan: { id: 12, name: "Release Plan" },
                lastRunId: 7001,
              },
              {
                id: 9002,
                url: "https://example.invalid/Shared%20Project/_apis/test/Plans/13/Suites/1003/Points/9002",
                testCase: { id: 303, name: "Regression test case" },
                testSuite: { id: 1003, name: "Smoke Suite" },
                testPlan: { id: 13, name: "Shared Plan" },
                lastRunId: 7002,
              },
            ],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project", "Shared Project"],
    });

    const summary = await services.listWorkItemTestLinks({
      project: "Allowed Project",
      workItemId: 101,
      includeTestCases: true,
      includeSuites: true,
      includePlans: true,
      includeRecentRuns: true,
      includeRaw: true,
    });

    expect(summary.workItem.id).toBe(101);
    expect(summary.totalTestLinks).toBe(1);
    expect(summary.totalTestCases).toBe(1);
    expect(summary.totalSuites).toBe(2);
    expect(summary.totalPlans).toBe(2);
    expect(summary.totalRecentRuns).toBe(2);
    expect(summary.relationTypesEncountered).toEqual([
      "Microsoft.VSTS.Common.TestedBy-Forward",
    ]);
    expect(summary.skippedRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 101,
          targetId: 404,
          reason: "not_allowed",
        }),
      ]),
    );
    expect(summary.testLinks).toEqual([
      expect.objectContaining({
        relationType: "Microsoft.VSTS.Common.TestedBy-Forward",
        relationName: "Tested By",
        testCaseId: 303,
        testCaseTitle: "Regression test case",
        testCaseState: "Design",
        testCaseProject: "Shared Project",
        isCrossProject: true,
        suiteIds: [1002, 1003],
        planIds: [12, 13],
        testCase: expect.objectContaining({
          id: 303,
          workItemType: "Test Case",
        }),
        suites: [
          expect.objectContaining({
            id: 1002,
            planId: 12,
            name: "Regression Suite",
          }),
          expect.objectContaining({
            id: 1003,
            planId: 13,
            name: "Smoke Suite",
          }),
        ],
        plans: [
          expect.objectContaining({
            id: 12,
            name: "Release Plan",
          }),
          expect.objectContaining({
            id: 13,
            name: "Shared Plan",
          }),
        ],
        recentRuns: [
          expect.objectContaining({
            id: 7001,
            pointIds: [9001],
            suiteIds: [1002],
            planIds: [12],
          }),
          expect.objectContaining({
            id: 7002,
            pointIds: [9002],
            suiteIds: [1003],
            planIds: [13],
          }),
        ],
        raw: expect.objectContaining({
          pointPayloads: expect.any(Array),
          recentRunPayloads: expect.any(Array),
        }),
      }),
    ]);
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it("keeps work item test-link payload light when optional include flags are disabled", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Root user story",
              "System.WorkItemType": "User Story",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
                attributes: { name: "Tested By" },
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303&fields=")) {
          return {
            value: [
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Regression test case",
                  "System.State": "Design",
                  "System.WorkItemType": "Test Case",
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

    const summary = await services.listWorkItemTestLinks({
      project: "Allowed Project",
      workItemId: 101,
    });

    expect(summary.testLinks).toEqual([
      expect.objectContaining({
        testCaseId: 303,
        suiteIds: [],
        planIds: [],
        recentRuns: [],
        testCase: undefined,
        suites: undefined,
        plans: undefined,
        raw: undefined,
      }),
    ]);
    expect(client.post).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(3);
  });

  it("rejects blocked work-item test-link access before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.listWorkItemTestLinks({
        project: "Blocked Project",
        workItemId: 101,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("builds user-story test coverage with mixed outcomes, suite and plan rollups, and recent run coverage", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Checkout story",
              "System.State": "Active",
              "System.WorkItemType": "User Story",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
              },
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/304",
              },
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/305",
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303,304,305&fields=")) {
          return {
            value: [
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Happy path test",
                  "System.State": "Ready",
                  "System.WorkItemType": "Test Case",
                },
              },
              {
                id: 304,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Failure test",
                  "System.State": "Ready",
                  "System.WorkItemType": "Test Case",
                },
              },
              {
                id: 305,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Missing execution test",
                  "System.State": "Design",
                  "System.WorkItemType": "Test Case",
                },
              },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/test/runs/7001?api-version=7.1") {
          return {
            id: 7001,
            name: "Run 7001",
            state: "Completed",
            totalTests: 1,
            passedTests: 1,
            failedTests: 0,
            completedDate: "2026-04-07T10:00:00Z",
            plan: { id: 12, name: "Checkout Plan" },
            url: "https://example.invalid/_apis/test/Runs/7001",
          };
        }

        if (path === "/Allowed%20Project/_apis/test/runs/7002?api-version=7.1") {
          return {
            id: 7002,
            name: "Run 7002",
            state: "Completed",
            totalTests: 1,
            passedTests: 0,
            failedTests: 1,
            completedDate: "2026-04-07T11:00:00Z",
            plan: { id: 12, name: "Checkout Plan" },
            url: "https://example.invalid/_apis/test/Runs/7002",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=100&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 1,
                outcome: "Passed",
                completedDate: "2026-04-07T10:00:00Z",
                testCase: { id: 303, name: "Happy path test" },
                testSuite: { id: 1002, name: "Checkout Suite" },
                testPlan: { id: 12, name: "Checkout Plan" },
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7002/results?$top=100&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 2,
                outcome: "Failed",
                completedDate: "2026-04-07T11:00:00Z",
                testCase: { id: 304, name: "Failure test" },
                testSuite: { id: 1003, name: "Resilience Suite" },
                testPlan: { id: 12, name: "Checkout Plan" },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string, body: unknown) => {
        if (path === "/Allowed%20Project/_apis/test/points?%24top=200&%24skip=0&api-version=7.1") {
          expect(body).toEqual({
            pointsFilter: {
              testcaseIds: [303, 304, 305],
            },
          });

          return {
            points: [
              {
                id: 9001,
                url: "https://example.invalid/Allowed%20Project/_apis/test/Plans/12/Suites/1002/Points/9001",
                testCase: { id: 303, name: "Happy path test" },
                testSuite: { id: 1002, name: "Checkout Suite" },
                testPlan: { id: 12, name: "Checkout Plan" },
                lastRunId: 7001,
              },
              {
                id: 9002,
                url: "https://example.invalid/Allowed%20Project/_apis/test/Plans/12/Suites/1003/Points/9002",
                testCase: { id: 304, name: "Failure test" },
                testSuite: { id: 1003, name: "Resilience Suite" },
                testPlan: { id: 12, name: "Checkout Plan" },
                lastRunId: 7002,
              },
            ],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const coverage = await services.getUserStoryTestCoverage({
      project: "Allowed Project",
      workItemId: 101,
      includeSuites: true,
      includePlans: true,
      includeRecentRuns: true,
      includeRaw: true,
    });

    expect(coverage.coverageStatus).toBe("failed");
    expect(coverage.summary).toEqual({
      totalLinkedTestCases: 3,
      withSuites: 2,
      withPlans: 2,
      withRecentRuns: 2,
      passedCount: 1,
      failedCount: 1,
      notExecutedCount: 0,
      unknownCount: 1,
    });
    expect(coverage.linkedTestCases).toEqual([
      expect.objectContaining({
        testCaseId: 303,
        latestOutcome: "passed",
        suiteIds: [1002],
        planIds: [12],
      }),
      expect.objectContaining({
        testCaseId: 304,
        latestOutcome: "failed",
        suiteIds: [1003],
        planIds: [12],
      }),
      expect.objectContaining({
        testCaseId: 305,
        latestOutcome: "unknown",
        suiteIds: [],
        planIds: [],
        recentRuns: [],
      }),
    ]);
    expect(coverage.suiteCoverage).toEqual([
      expect.objectContaining({
        suiteId: 1002,
        coverageStatus: "passed",
      }),
      expect.objectContaining({
        suiteId: 1003,
        coverageStatus: "failed",
      }),
    ]);
    expect(coverage.planCoverage).toEqual([
      expect.objectContaining({
        planId: 12,
        coverageStatus: "failed",
        summary: expect.objectContaining({
          totalLinkedTestCases: 2,
          passedCount: 1,
          failedCount: 1,
        }),
      }),
    ]);
    expect(coverage.recentRuns).toEqual([
      expect.objectContaining({
        id: 7002,
        linkedTestCaseIds: [304],
        coverageStatus: "failed",
      }),
      expect.objectContaining({
        id: 7001,
        linkedTestCaseIds: [303],
        coverageStatus: "passed",
      }),
    ]);
    expect(coverage.raw).toEqual(
      expect.objectContaining({
        workItemTestLinks: expect.objectContaining({
          totalTestLinks: 3,
        }),
      }),
    );
  });

  it("returns a no-tests coverage view when no linked test cases exist", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return { value: [] };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Story without tests",
              "System.WorkItemType": "User Story",
            },
            relations: [],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const coverage = await services.getUserStoryTestCoverage({
      project: "Allowed Project",
      userStoryId: 101,
    });

    expect(coverage.coverageStatus).toBe("no_tests");
    expect(coverage.summary.totalLinkedTestCases).toBe(0);
    expect(coverage.linkedTestCases).toEqual([]);
    expect(coverage.suiteCoverage).toEqual([]);
    expect(coverage.planCoverage).toEqual([]);
    expect(coverage.recentRuns).toEqual([]);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("keeps outcomes unknown when linked test cases have no suite, plan, or recent run context", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Story with unexecuted links",
              "System.WorkItemType": "User Story",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303&fields=")) {
          return {
            value: [
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Unscheduled test",
                  "System.State": "Design",
                  "System.WorkItemType": "Test Case",
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/test/points?%24top=200&%24skip=0&api-version=7.1") {
          return { points: [] };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const coverage = await services.getUserStoryTestCoverage({
      project: "Allowed Project",
      workItemId: 101,
      includeSuites: true,
      includePlans: true,
      includeRecentRuns: true,
    });

    expect(coverage.coverageStatus).toBe("unknown");
    expect(coverage.summary).toEqual({
      totalLinkedTestCases: 1,
      withSuites: 0,
      withPlans: 0,
      withRecentRuns: 0,
      passedCount: 0,
      failedCount: 0,
      notExecutedCount: 0,
      unknownCount: 1,
    });
    expect(coverage.linkedTestCases[0]).toEqual(
      expect.objectContaining({
        testCaseId: 303,
        latestOutcome: "unknown",
        suiteIds: [],
        planIds: [],
        recentRuns: [],
      }),
    );
    expect(coverage.suiteCoverage).toEqual([]);
    expect(coverage.planCoverage).toEqual([]);
    expect(coverage.recentRuns).toEqual([]);
  });

  it("rejects blocked user-story coverage requests before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.getUserStoryTestCoverage({
        project: "Blocked Project",
        workItemId: 101,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("builds a complete requirement traceability report when linked tests are fully covered", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Requirement A",
              "System.WorkItemType": "Requirement",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303&fields=")) {
          return {
            value: [
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Requirement A test",
                  "System.State": "Ready",
                  "System.WorkItemType": "Test Case",
                },
              },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/test/runs/7001?api-version=7.1") {
          return {
            id: 7001,
            name: "Requirement Run",
            state: "Completed",
            totalTests: 1,
            passedTests: 1,
            failedTests: 0,
            completedDate: "2026-04-07T09:00:00Z",
            plan: { id: 12, name: "Requirement Plan" },
            url: "https://example.invalid/_apis/test/Runs/7001",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=100&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 11,
                outcome: "Passed",
                completedDate: "2026-04-07T09:00:00Z",
                testCase: { id: 303, name: "Requirement A test" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                testPlan: { id: 12, name: "Requirement Plan" },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string, body: unknown) => {
        if (path === "/Allowed%20Project/_apis/test/points?%24top=200&%24skip=0&api-version=7.1") {
          expect(body).toEqual({
            pointsFilter: {
              testcaseIds: [303],
            },
          });

          return {
            points: [
              {
                id: 9001,
                url: "https://example.invalid/Allowed%20Project/_apis/test/Plans/12/Suites/1002/Points/9001",
                testCase: { id: 303, name: "Requirement A test" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                testPlan: { id: 12, name: "Requirement Plan" },
                lastRunId: 7001,
              },
            ],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const report = await services.getRequirementTraceabilityReport({
      project: "Allowed Project",
      workItemId: 101,
      includeSuites: true,
      includePlans: true,
      includeRecentRuns: true,
      includeRaw: true,
    });

    expect(report.traceabilityStatus).toBe("complete");
    expect(report.coverageStatus).toBe("passed");
    expect(report.gaps).toEqual({
      hasNoLinkedTestCases: false,
      hasTestCaseWithoutSuite: false,
      hasTestCaseWithoutPlan: false,
      hasTestCaseWithoutRecentRun: false,
      hasFailedTests: false,
      hasUnknownOutcomes: false,
      missingSuiteTestCaseIds: [],
      missingPlanTestCaseIds: [],
      missingRecentRunTestCaseIds: [],
      failedTestCaseIds: [],
      unknownOutcomeTestCaseIds: [],
    });
    expect(report.raw).toEqual(
      expect.objectContaining({
        coverage: expect.objectContaining({
          coverageStatus: "passed",
        }),
      }),
    );
  });

  it("marks requirement traceability as missing_tests when no linked test cases exist", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return { value: [] };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Requirement without tests",
              "System.WorkItemType": "Requirement",
            },
            relations: [],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const report = await services.getRequirementTraceabilityReport({
      project: "Allowed Project",
      workItemId: 101,
    });

    expect(report.traceabilityStatus).toBe("missing_tests");
    expect(report.gaps.hasNoLinkedTestCases).toBe(true);
    expect(report.linkedTestCases).toEqual([]);
  });

  it("marks requirement traceability as missing_execution when linked tests have no suite, plan, or run context", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Requirement without execution",
              "System.WorkItemType": "Requirement",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303&fields=")) {
          return {
            value: [
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Unscheduled test",
                  "System.State": "Design",
                  "System.WorkItemType": "Test Case",
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/test/points?%24top=200&%24skip=0&api-version=7.1") {
          return { points: [] };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const report = await services.getRequirementTraceabilityReport({
      project: "Allowed Project",
      workItemId: 101,
    });

    expect(report.traceabilityStatus).toBe("missing_execution");
    expect(report.gaps).toEqual(
      expect.objectContaining({
        hasTestCaseWithoutSuite: true,
        hasTestCaseWithoutPlan: true,
        hasTestCaseWithoutRecentRun: true,
        missingSuiteTestCaseIds: [303],
        missingPlanTestCaseIds: [303],
        missingRecentRunTestCaseIds: [303],
      }),
    );
  });

  it("marks requirement traceability as partial when linked tests are executed but missing plan context", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Requirement with partial traceability",
              "System.WorkItemType": "Requirement",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303&fields=")) {
          return {
            value: [
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Suite only test",
                  "System.State": "Ready",
                  "System.WorkItemType": "Test Case",
                },
              },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/test/runs/7001?api-version=7.1") {
          return {
            id: 7001,
            name: "Suite only run",
            state: "Completed",
            totalTests: 1,
            passedTests: 1,
            failedTests: 0,
            completedDate: "2026-04-07T08:00:00Z",
            url: "https://example.invalid/_apis/test/Runs/7001",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=100&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 21,
                outcome: "Passed",
                completedDate: "2026-04-07T08:00:00Z",
                testCase: { id: 303, name: "Suite only test" },
                testSuite: { id: 1002, name: "Suite Only" },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/test/points?%24top=200&%24skip=0&api-version=7.1") {
          return {
            points: [
              {
                id: 9001,
                url: "https://example.invalid/Allowed%20Project/_apis/test/Suites/1002/Points/9001",
                testCase: { id: 303, name: "Suite only test" },
                testSuite: { id: 1002, name: "Suite Only" },
                lastRunId: 7001,
              },
            ],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const report = await services.getRequirementTraceabilityReport({
      project: "Allowed Project",
      workItemId: 101,
    });

    expect(report.traceabilityStatus).toBe("partial");
    expect(report.coverageStatus).toBe("passed");
    expect(report.gaps).toEqual(
      expect.objectContaining({
        hasTestCaseWithoutSuite: false,
        hasTestCaseWithoutPlan: true,
        hasTestCaseWithoutRecentRun: false,
        missingPlanTestCaseIds: [303],
      }),
    );
  });

  it("marks requirement traceability as at_risk for failed and unknown outcomes", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return {
            value: [
              {
                referenceName: "Microsoft.VSTS.Common.TestedBy-Forward",
                name: "Tested By",
                attributes: {
                  topology: "network",
                  directional: true,
                  enabled: true,
                  editable: true,
                  acyclic: false,
                  singleTarget: false,
                  oppositeEndReferenceName: "Microsoft.VSTS.Common.TestedBy-Reverse",
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "At risk requirement",
              "System.WorkItemType": "Requirement",
            },
            relations: [
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/303",
              },
              {
                rel: "Microsoft.VSTS.Common.TestedBy-Forward",
                url: "https://example.invalid/_apis/wit/workItems/304",
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=303,304&fields=")) {
          return {
            value: [
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Failing test",
                  "System.State": "Ready",
                  "System.WorkItemType": "Test Case",
                },
              },
              {
                id: 304,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Unknown test",
                  "System.State": "Design",
                  "System.WorkItemType": "Test Case",
                },
              },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/test/runs/7001?api-version=7.1") {
          return {
            id: 7001,
            name: "Failing run",
            state: "Completed",
            totalTests: 1,
            passedTests: 0,
            failedTests: 1,
            completedDate: "2026-04-07T12:00:00Z",
            plan: { id: 12, name: "Risk Plan" },
            url: "https://example.invalid/_apis/test/Runs/7001",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=100&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 31,
                outcome: "Failed",
                completedDate: "2026-04-07T12:00:00Z",
                testCase: { id: 303, name: "Failing test" },
                testSuite: { id: 1002, name: "Risk Suite" },
                testPlan: { id: 12, name: "Risk Plan" },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/test/points?%24top=200&%24skip=0&api-version=7.1") {
          return {
            points: [
              {
                id: 9001,
                url: "https://example.invalid/Allowed%20Project/_apis/test/Plans/12/Suites/1002/Points/9001",
                testCase: { id: 303, name: "Failing test" },
                testSuite: { id: 1002, name: "Risk Suite" },
                testPlan: { id: 12, name: "Risk Plan" },
                lastRunId: 7001,
              },
            ],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const report = await services.getRequirementTraceabilityReport({
      project: "Allowed Project",
      workItemId: 101,
    });

    expect(report.traceabilityStatus).toBe("at_risk");
    expect(report.coverageStatus).toBe("failed");
    expect(report.gaps).toEqual(
      expect.objectContaining({
        hasFailedTests: true,
        hasUnknownOutcomes: true,
        failedTestCaseIds: [303],
        unknownOutcomeTestCaseIds: [304],
      }),
    );
  });

  it("lists work item categories and work item types for a project, including optional raw payloads", async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          value: [
            {
              name: "Bug Category",
              referenceName: "Microsoft.BugCategory",
              defaultWorkItemType: {
                name: "Bug",
                url: "https://example.invalid/_apis/wit/workItemTypes/Bug",
              },
              workItemTypes: [
                {
                  name: "Bug",
                  url: "https://example.invalid/_apis/wit/workItemTypes/Bug",
                },
              ],
              url: "https://example.invalid/_apis/wit/workItemTypeCategories/Microsoft.BugCategory",
            },
          ],
        })
        .mockResolvedValueOnce({
          value: [
            {
              name: "Bug",
              referenceName: "Microsoft.VSTS.WorkItemTypes.Bug",
              description: "Track defects",
              color: "CC293D",
              icon: { id: "icon_bug", url: "https://example.invalid/icon_bug" },
              isDisabled: false,
              states: [
                {
                  name: "Active",
                  color: "007ACC",
                  category: "InProgress",
                },
              ],
              fieldInstances: [
                {
                  name: "Title",
                  referenceName: "System.Title",
                  alwaysRequired: true,
                  url: "https://example.invalid/_apis/wit/fields/System.Title",
                },
              ],
              url: "https://example.invalid/_apis/wit/workItemTypes/Bug",
            },
          ],
        })
        .mockResolvedValueOnce({
          value: [
            {
              name: "Bug Category",
              referenceName: "Microsoft.BugCategory",
              defaultWorkItemType: {
                name: "Bug",
                url: "https://example.invalid/_apis/wit/workItemTypes/Bug",
              },
              workItemTypes: [
                {
                  name: "Bug",
                  url: "https://example.invalid/_apis/wit/workItemTypes/Bug",
                },
              ],
              url: "https://example.invalid/_apis/wit/workItemTypeCategories/Microsoft.BugCategory",
            },
          ],
        }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const categories = await services.listWorkItemCategories("Allowed Project");
    const workItemTypes = await services.listWorkItemTypes({
      project: "Allowed Project",
      includeRaw: true,
    });

    expect(categories).toHaveLength(1);
    expect(categories[0]?.referenceName).toBe("Microsoft.BugCategory");
    expect(workItemTypes).toHaveLength(1);
    expect(workItemTypes[0]?.categoryReferenceName).toBe("Microsoft.BugCategory");
    expect(workItemTypes[0]?.fields[0]?.referenceName).toBe("System.Title");
    expect(workItemTypes[0]?.raw).toEqual(
      expect.objectContaining({
        referenceName: "Microsoft.VSTS.WorkItemTypes.Bug",
      }),
    );
  });

  it("lists repositories and pull requests from mocked Azure DevOps responses", async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce({
          value: [{ id: "repo-1", name: "frontend", defaultBranch: "refs/heads/main" }],
        })
        .mockResolvedValueOnce({
          value: [
            {
              pullRequestId: 22,
              title: "Improve retry logic",
              status: "active",
              createdBy: { displayName: "Gytis" },
              sourceRefName: "refs/heads/feature/retries",
              targetRefName: "refs/heads/main",
              creationDate: "2026-03-18T08:00:00Z",
            },
          ],
        }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const repositories = await services.listRepositories("Allowed Project");
    const pullRequests = await services.listPullRequests(
      "Allowed Project",
      "frontend",
      "active",
    );

    expect(repositories[0]?.name).toBe("frontend");
    expect(pullRequests[0]?.id).toBe(22);
  });

  it("searches pull requests by work item relations and returns analytics-friendly summaries", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitems/101?%24expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Improve retry policy",
              "System.WorkItemType": "User Story",
              "System.State": "Active",
            },
            relations: [
              {
                rel: "ArtifactLink",
                url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
                attributes: {
                  name: "Pull Request",
                },
              },
              {
                rel: "ArtifactLink",
                url: "vstfs:///Git/Commit/repo-1%2Fabc123",
                attributes: {
                  name: "Commit",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            status: "completed",
            createdBy: { displayName: "Gytis" },
            sourceRefName: "refs/heads/feature/retries",
            targetRefName: "refs/heads/main",
            creationDate: "2026-04-07T08:00:00Z",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
            url: "https://example.invalid/pr/55",
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.searchPullRequestsByWorkItem({
      project: "Allowed Project",
      workItemId: 101,
      includeRaw: true,
    });

    expect(summary.total).toBe(1);
    expect(summary.pullRequests[0]).toEqual(
      expect.objectContaining({
        pullRequestId: 55,
        title: "Improve retry logic",
        repository: "frontend",
        project: "Allowed Project",
        status: "completed",
      }),
    );
    expect(summary.pullRequests[0]?.raw).toEqual(
      expect.objectContaining({
        relation: expect.objectContaining({
          rel: "ArtifactLink",
        }),
        pullRequest: expect.objectContaining({
          pullRequestId: 55,
        }),
      }),
    );
  });

  it("skips pull request relations that point to blocked projects", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitems/101?%24expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Improve retry policy",
            },
            relations: [
              {
                rel: "ArtifactLink",
                url: "https://dev.azure.com/example/Blocked%20Project/_apis/git/repositories/repo-1/pullRequests/55",
                attributes: {
                  name: "Pull Request",
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

    const summary = await services.searchPullRequestsByWorkItem({
      project: "Allowed Project",
      workItemId: 101,
    });

    expect(summary.total).toBe(0);
    expect(summary.pullRequests).toEqual([]);
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("returns a full pull request view with linked work items and reviewers", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            description: "Adds transient retry handling.",
            status: "completed",
            mergeStatus: "succeeded",
            createdBy: { displayName: "Gytis" },
            creationDate: "2026-04-07T08:00:00Z",
            closedDate: "2026-04-07T09:00:00Z",
            sourceRefName: "refs/heads/feature/retries",
            targetRefName: "refs/heads/main",
            isDraft: false,
            reviewers: [
              {
                id: "user-1",
                displayName: "Reviewer One",
                uniqueName: "reviewer@example.com",
                vote: 10,
                isRequired: true,
              },
            ],
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
              defaultBranch: "refs/heads/main",
            },
            url: "https://example.invalid/pr/55",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullrequests/55/workitems?api-version=7.1"
        ) {
          return {
            value: [{ id: 101 }, { id: 202 }],
          };
        }

        if (
          path.includes("/_apis/wit/workitems?ids=101,202&fields=") &&
          path.includes("System.TeamProject")
        ) {
          return {
            value: [
              {
                id: 101,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Story linked to PR",
                  "System.State": "Active",
                  "System.WorkItemType": "User Story",
                },
              },
              {
                id: 202,
                fields: {
                  "System.TeamProject": "Blocked Project",
                  "System.Title": "Blocked work item",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
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

    const summary = await services.getPullRequestFull({
      project: "Allowed Project",
      repository: "frontend",
      pullRequestId: 55,
      includeWorkItems: true,
      includeReviewers: true,
      includeRaw: true,
    });

    expect(summary.pullRequestId).toBe(55);
    expect(summary.repository.name).toBe("frontend");
    expect(summary.mergeStatus).toBe("succeeded");
    expect(summary.workItems).toHaveLength(1);
    expect(summary.workItems?.[0]?.id).toBe(101);
    expect(summary.reviewers?.[0]).toEqual(
      expect.objectContaining({
        displayName: "Reviewer One",
        vote: 10,
        isRequired: true,
      }),
    );
    expect(summary.raw).toEqual(
      expect.objectContaining({
        pullRequestId: 55,
      }),
    );
  });

  it("keeps pull request full payload light when linked work items and reviewers are disabled", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            status: "active",
            createdBy: { displayName: "Gytis" },
            creationDate: "2026-04-07T08:00:00Z",
            sourceRefName: "refs/heads/feature/retries",
            targetRefName: "refs/heads/main",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
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

    const summary = await services.getPullRequestFull({
      project: "Allowed Project",
      repository: "frontend",
      pullRequestId: 55,
      includeWorkItems: false,
      includeReviewers: false,
    });

    expect(summary.workItems).toBeUndefined();
    expect(summary.reviewers).toBeUndefined();
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("lists pull request commits with optional raw payloads", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            status: "completed",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55/commits?api-version=7.1"
        ) {
          return {
            value: [
              {
                commitId: "abc123",
                comment: "Add retry middleware",
                commentTruncated: "Add retry middleware",
                author: {
                  name: "Gytis",
                  date: "2026-04-07T08:15:00Z",
                },
                committer: {
                  name: "Gytis",
                },
                url: "https://example.invalid/commit/abc123",
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

    const summary = await services.listPullRequestCommits({
      project: "Allowed Project",
      repository: "frontend",
      pullRequestId: 55,
      includeRaw: true,
    });

    expect(summary.total).toBe(1);
    expect(summary.commits[0]).toEqual(
      expect.objectContaining({
        commitId: "abc123",
        author: "Gytis",
        comment: "Add retry middleware",
      }),
    );
    expect(summary.commits[0]?.raw).toEqual(
      expect.objectContaining({
        commitId: "abc123",
      }),
    );
  });

  it("returns pull request diff summaries without patch content by default", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
            lastMergeSourceCommit: {
              commitId: "source-1",
            },
            lastMergeTargetCommit: {
              commitId: "target-1",
            },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55/iterations?api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 2,
                sourceRefCommit: {
                  commitId: "source-2",
                },
                targetRefCommit: {
                  commitId: "target-2",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55/iterations/2/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changeEntries: [
              {
                changeType: "edit",
                item: {
                  path: "/src/retries.ts",
                  gitObjectType: "blob",
                  objectId: "obj-1",
                },
                additions: 14,
                deletions: 2,
                patch: "@@ -1 +1 @@",
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

    const summary = await services.getPullRequestDiff({
      project: "Allowed Project",
      repository: "frontend",
      pullRequestId: 55,
    });

    expect(summary.iterationId).toBe(2);
    expect(summary.sourceCommitId).toBe("source-2");
    expect(summary.targetCommitId).toBe("target-2");
    expect(summary.files[0]).toEqual(
      expect.objectContaining({
        path: "/src/retries.ts",
        additions: 14,
        deletions: 2,
      }),
    );
    expect(summary.files[0]?.patch).toBeUndefined();
  });

  it("returns pull request diff summaries with patch content and raw pages when requested", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55/iterations?api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 2,
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55/iterations/2/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changeEntries: [
              {
                changeType: "add",
                item: {
                  path: "/src/new-retries.ts",
                  gitObjectType: "blob",
                  objectId: "obj-2",
                },
                patch: "@@ -0,0 +1,20 @@",
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

    const summary = await services.getPullRequestDiff({
      project: "Allowed Project",
      repository: "frontend",
      pullRequestId: 55,
      includePatch: true,
      includeRaw: true,
    });

    expect(summary.files[0]?.patch).toBe("@@ -0,0 +1,20 @@");
    expect(summary.raw).toEqual(
      expect.objectContaining({
        iterations: expect.any(Array),
        changes: expect.any(Array),
      }),
    );
  });

  it("rejects blocked project access before searching pull requests by work item", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.searchPullRequestsByWorkItem({
        project: "Blocked Project",
        workItemId: 101,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("rejects pull request full retrieval when the response repository does not match the requested repository", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            repository: {
              id: "repo-2",
              name: "backend",
              project: {
                name: "Allowed Project",
              },
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

    await expect(
      services.getPullRequestFull({
        project: "Allowed Project",
        repository: "frontend",
        pullRequestId: 55,
      }),
    ).rejects.toThrow(/frontend/);
  });

  it("rejects pull request commit retrieval when the pull request belongs to a blocked project", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Improve retry logic",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Blocked Project",
              },
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

    await expect(
      services.listPullRequestCommits({
        project: "Allowed Project",
        repository: "frontend",
        pullRequestId: 55,
      }),
    ).rejects.toThrow(/Blocked Project/);
  });

  it("loads a full commit view with changed files and stats without patch content by default", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/commits/abc123?api-version=7.1"
        ) {
          return {
            commitId: "abc123",
            comment: "Add retry middleware",
            author: {
              name: "Gytis",
              date: "2026-04-07T08:15:00Z",
            },
            committer: {
              name: "Gytis",
              date: "2026-04-07T08:20:00Z",
            },
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
            url: "https://example.invalid/commit/abc123",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/commits/abc123/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changes: [
              {
                changeType: "edit",
                item: {
                  path: "/src/retries.ts",
                  gitObjectType: "blob",
                  objectId: "obj-1",
                },
                additions: 8,
                deletions: 3,
                patch: "@@ -1 +1 @@",
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

    const summary = await services.getCommitFull({
      project: "Allowed Project",
      repository: "frontend",
      commitId: "abc123",
    });

    expect(summary.commitId).toBe("abc123");
    expect(summary.comment).toBe("Add retry middleware");
    expect(summary.commitDate).toBe("2026-04-07T08:20:00Z");
    expect(summary.changedFiles).toHaveLength(1);
    expect(summary.changedFiles[0]?.patch).toBeUndefined();
    expect(summary.stats).toEqual({
      changedFiles: 1,
      additions: 8,
      deletions: 3,
    });
  });

  it("loads a full commit view with patch content and raw payloads when requested", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/commits/abc123?api-version=7.1"
        ) {
          return {
            commitId: "abc123",
            comment: "Add retry middleware",
            author: {
              name: "Gytis",
              date: "2026-04-07T08:15:00Z",
            },
            committer: {
              name: "Gytis",
              date: "2026-04-07T08:20:00Z",
            },
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
            url: "https://example.invalid/commit/abc123",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/commits/abc123/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changes: [
              {
                changeType: "add",
                item: {
                  path: "/src/new-retries.ts",
                  gitObjectType: "blob",
                  objectId: "obj-2",
                },
                patch: "@@ -0,0 +1,20 @@",
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

    const summary = await services.getCommitFull({
      project: "Allowed Project",
      repository: "frontend",
      commitId: "abc123",
      includePatch: true,
      includeRaw: true,
    });

    expect(summary.changedFiles[0]?.patch).toBe("@@ -0,0 +1,20 @@");
    expect(summary.raw).toEqual(
      expect.objectContaining({
        commit: expect.objectContaining({
          commitId: "abc123",
        }),
        changes: expect.any(Array),
      }),
    );
  });

  it("returns empty commit search results when a work item has no linked pull requests or direct commits", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitems/101?%24expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Work item without code changes",
            },
            relations: [],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.searchCommitsByWorkItem({
      project: "Allowed Project",
      workItemId: 101,
    });

    expect(summary.total).toBe(0);
    expect(summary.commits).toEqual([]);
  });

  it("searches commits by work item across multiple pull requests and deduplicates shared commits", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitems/101?%24expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Story with code changes",
              "System.WorkItemType": "User Story",
              "System.State": "Active",
            },
            relations: [
              {
                rel: "ArtifactLink",
                url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
                attributes: {
                  name: "Pull Request",
                },
              },
              {
                rel: "ArtifactLink",
                url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F56",
                attributes: {
                  name: "Pull Request",
                },
              },
              {
                rel: "ArtifactLink",
                url: "vstfs:///Git/Commit/Allowed%20Project%2Frepo-1%2Fdirect777",
                attributes: {
                  name: "Fixed in Commit",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "PR 55",
            status: "completed",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/56?api-version=7.1"
        ) {
          return {
            pullRequestId: 56,
            title: "PR 56",
            status: "completed",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/55/commits?api-version=7.1"
        ) {
          return {
            value: [
              {
                commitId: "abc111",
                comment: "Add retry guard",
                author: { name: "Gytis", date: "2026-04-07T08:10:00Z" },
                committer: { name: "Gytis", date: "2026-04-07T08:11:00Z" },
                url: "https://example.invalid/commit/abc111",
              },
              {
                commitId: "shared999",
                comment: "Refactor shared http client",
                author: { name: "Gytis", date: "2026-04-07T08:12:00Z" },
                committer: { name: "Gytis", date: "2026-04-07T08:13:00Z" },
                url: "https://example.invalid/commit/shared999",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/56/commits?api-version=7.1"
        ) {
          return {
            value: [
              {
                commitId: "def222",
                comment: "Add retry telemetry",
                author: { name: "Gytis", date: "2026-04-07T08:14:00Z" },
                committer: { name: "Gytis", date: "2026-04-07T08:15:00Z" },
                url: "https://example.invalid/commit/def222",
              },
              {
                commitId: "shared999",
                comment: "Refactor shared http client",
                author: { name: "Gytis", date: "2026-04-07T08:12:00Z" },
                committer: { name: "Gytis", date: "2026-04-07T08:13:00Z" },
                url: "https://example.invalid/commit/shared999",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/abc111?api-version=7.1"
        ) {
          return {
            commitId: "abc111",
            comment: "Add retry guard",
            author: { name: "Gytis", date: "2026-04-07T08:10:00Z" },
            committer: { name: "Gytis", date: "2026-04-07T08:11:00Z" },
            repository: {
              id: "repo-1",
              name: "frontend",
              project: { name: "Allowed Project" },
            },
            url: "https://example.invalid/commit/abc111",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/shared999?api-version=7.1"
        ) {
          return {
            commitId: "shared999",
            comment: "Refactor shared http client",
            author: { name: "Gytis", date: "2026-04-07T08:12:00Z" },
            committer: { name: "Gytis", date: "2026-04-07T08:13:00Z" },
            repository: {
              id: "repo-1",
              name: "frontend",
              project: { name: "Allowed Project" },
            },
            url: "https://example.invalid/commit/shared999",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/def222?api-version=7.1"
        ) {
          return {
            commitId: "def222",
            comment: "Add retry telemetry",
            author: { name: "Gytis", date: "2026-04-07T08:14:00Z" },
            committer: { name: "Gytis", date: "2026-04-07T08:15:00Z" },
            repository: {
              id: "repo-1",
              name: "frontend",
              project: { name: "Allowed Project" },
            },
            url: "https://example.invalid/commit/def222",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/direct777?api-version=7.1"
        ) {
          return {
            commitId: "direct777",
            comment: "Hotfix direct commit",
            author: { name: "Gytis", date: "2026-04-07T08:16:00Z" },
            committer: { name: "Gytis", date: "2026-04-07T08:17:00Z" },
            repository: {
              id: "repo-1",
              name: "frontend",
              project: { name: "Allowed Project" },
            },
            url: "https://example.invalid/commit/direct777",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/abc111/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changes: [
              {
                changeType: "edit",
                item: { path: "/src/a.ts", gitObjectType: "blob", objectId: "1" },
                patch: "@@ a @@",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/shared999/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changes: [
              {
                changeType: "edit",
                item: { path: "/src/shared.ts", gitObjectType: "blob", objectId: "2" },
                patch: "@@ shared @@",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/def222/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changes: [
              {
                changeType: "edit",
                item: { path: "/src/b.ts", gitObjectType: "blob", objectId: "3" },
                patch: "@@ b @@",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/direct777/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changes: [
              {
                changeType: "add",
                item: { path: "/src/direct.ts", gitObjectType: "blob", objectId: "4" },
                patch: "@@ direct @@",
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

    const summary = await services.searchCommitsByWorkItem({
      project: "Allowed Project",
      workItemId: 101,
      includePatch: true,
      includeRaw: true,
    });

    expect(summary.total).toBe(4);
    expect(summary.commits.map((commit) => commit.commitId)).toEqual([
      "direct777",
      "def222",
      "shared999",
      "abc111",
    ]);
    expect(summary.commits.find((commit) => commit.commitId === "shared999")).toEqual(
      expect.objectContaining({
        pullRequestIds: [55, 56],
        repository: "frontend",
        changedFiles: [expect.objectContaining({ patch: "@@ shared @@" })],
      }),
    );
    expect(summary.commits.find((commit) => commit.commitId === "direct777")).toEqual(
      expect.objectContaining({
        pullRequestIds: [],
        changedFiles: [expect.objectContaining({ patch: "@@ direct @@" })],
      }),
    );
  });

  it("rejects full commit retrieval when the response repository does not match the requested repository", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/frontend/commits/abc123?api-version=7.1"
        ) {
          return {
            commitId: "abc123",
            comment: "Add retry middleware",
            author: { name: "Gytis" },
            committer: { name: "Gytis" },
            repository: {
              id: "repo-2",
              name: "backend",
              project: {
                name: "Allowed Project",
              },
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

    await expect(
      services.getCommitFull({
        project: "Allowed Project",
        repository: "frontend",
        commitId: "abc123",
      }),
    ).rejects.toThrow(/frontend/);
  });

  it("rejects commit search requests for blocked projects before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.searchCommitsByWorkItem({
        project: "Blocked Project",
        workItemId: 101,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("returns empty work item search results cleanly", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ workItems: [] }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.searchWorkItems({
      project: "Allowed Project",
      top: 5,
    });

    expect(result.workItems).toEqual([]);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("returns empty advanced search results when category filters resolve to no types", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            name: "Task Category",
            referenceName: "Microsoft.TaskCategory",
            workItemTypes: [
              { name: "Task", url: "https://example.invalid/_apis/wit/workItemTypes/Task" },
            ],
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.searchWorkItemsAdvanced({
      project: "Allowed Project",
      categoryReferenceNames: ["Microsoft.BugCategory"],
      top: 5,
    });

    expect(result.workItems).toEqual([]);
    expect(result.query.resolvedWorkItemTypes).toEqual([]);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("rejects get_work_item when the returned item belongs to a blocked project", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 101,
        fields: {
          "System.TeamProject": "Blocked Project",
          "System.Title": "Wrong project",
        },
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(services.getWorkItem(101)).rejects.toThrow(/Blocked Project/);
  });

  it("rejects get_work_item_full when the returned item belongs to a blocked project before loading side payloads", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 101,
        fields: {
          "System.TeamProject": "Blocked Project",
          "System.Title": "Wrong project",
        },
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.getWorkItemFull({
        id: 101,
        includeComments: true,
        includeUpdates: true,
        includeRevisions: true,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("rejects full work item requests when the supplied project does not match the returned item", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 101,
        fields: {
          "System.TeamProject": "Other Project",
          "System.Title": "Wrong project",
        },
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project", "Other Project"],
    });

    await expect(
      services.getWorkItemFull({
        id: 101,
        project: "Allowed Project",
      }),
    ).rejects.toThrow(/instead of "Allowed Project"/);
  });

  it("rejects traceability graph traversal when the root item belongs to a blocked project", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitemrelationtypes?api-version=7.1") {
          return { value: [] };
        }

        if (path === "/_apis/wit/workitems/101?$expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Blocked Project",
              "System.Title": "Hidden item",
            },
            relations: [],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.getWorkItemRelationsGraph({
        project: "Allowed Project",
        workItemId: 101,
      }),
    ).rejects.toThrow(/not permitted by this connector/);
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it("lists work item comments across continuation pages with optional raw payloads", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/_apis/wit/workitems/101?fields=System.TeamProject,System.Title,System.State,System.WorkItemType,System.AssignedTo,System.CreatedBy,System.ChangedBy,System.CreatedDate,System.ChangedDate,System.AreaPath,System.IterationPath,System.Tags,System.CommentCount,System.Reason,Microsoft.VSTS.Common.Priority,Microsoft.VSTS.Common.Severity,Microsoft.VSTS.Common.ClosedDate,System.Description&api-version=7.1"
        ) {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Investigate incident",
            },
          };
        }

        if (
          path ===
          "/_apis/wit/workitems/101/comments?%24top=1&includeDeleted=true&%24expand=renderedText&api-version=7.1-preview.4"
        ) {
          return {
            totalCount: 2,
            continuationToken: "page-2",
            comments: [
              {
                id: 1,
                workItemId: 101,
                text: "First comment",
              },
            ],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems/101/comments?%24top=1&includeDeleted=true&%24expand=renderedText&api-version=7.1-preview.4&continuationToken=page-2"
        ) {
          return {
            totalCount: 2,
            comments: [
              {
                id: 2,
                workItemId: 101,
                text: "Second comment",
                isDeleted: true,
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

    const result = await services.listWorkItemComments({
      id: 101,
      project: "Allowed Project",
      pageSize: 1,
      includeRaw: true,
    });

    expect(result.totalCount).toBe(2);
    expect(result.returned).toBe(2);
    expect(result.paging).toEqual({
      strategy: "continuation",
      pageSize: 1,
      pagesFetched: 2,
    });
    expect(result.comments.map((comment) => comment.commentId)).toEqual([1, 2]);
    expect(result.comments[1]?.isDeleted).toBe(true);
    expect(result.comments[0]?.raw).toBeDefined();
  });

  it("rejects work item comment history requests when the returned item belongs to a blocked project", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 101,
        fields: {
          "System.TeamProject": "Blocked Project",
          "System.Title": "Hidden item",
        },
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.listWorkItemComments({
        id: 101,
        includeRaw: true,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("lists work item updates across paged history slices", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/_apis/wit/workitems/101?fields=System.TeamProject,System.Title,System.State,System.WorkItemType,System.AssignedTo,System.CreatedBy,System.ChangedBy,System.CreatedDate,System.ChangedDate,System.AreaPath,System.IterationPath,System.Tags,System.CommentCount,System.Reason,Microsoft.VSTS.Common.Priority,Microsoft.VSTS.Common.Severity,Microsoft.VSTS.Common.ClosedDate,System.Description&api-version=7.1"
        ) {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Investigate incident",
            },
          };
        }

        if (path === "/_apis/wit/workitems/101/updates?%24top=2&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 11,
                workItemId: 101,
                revisedBy: { displayName: "Editor One" },
                revisedDate: "2026-04-01T08:00:00Z",
                fields: {
                  "System.State": {
                    oldValue: "New",
                    newValue: "Active",
                  },
                },
              },
              {
                id: 12,
                workItemId: 101,
                revisedBy: { displayName: "Editor Two" },
                revisedDate: "2026-04-01T09:00:00Z",
                fields: {
                  "System.AssignedTo": {
                    newValue: "Gytis",
                  },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/updates?%24top=2&%24skip=2&api-version=7.1") {
          return {
            value: [
              {
                id: 13,
                workItemId: 101,
                revisedBy: { displayName: "Editor Three" },
                revisedDate: "2026-04-01T10:00:00Z",
                fields: {
                  "System.Tags": {
                    newValue: "prod",
                  },
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

    const result = await services.listWorkItemUpdates({
      id: 101,
      pageSize: 2,
      includeRaw: true,
    });

    expect(result.totalCount).toBe(3);
    expect(result.paging.pagesFetched).toBe(2);
    expect(result.updates.map((update) => update.updateId)).toEqual([11, 12, 13]);
    expect(result.updates[0]?.changedFields).toEqual(["System.State"]);
    expect(result.updates[2]?.raw).toBeDefined();
  });

  it("lists work item revisions across paged history slices", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/_apis/wit/workitems/101?fields=System.TeamProject,System.Title,System.State,System.WorkItemType,System.AssignedTo,System.CreatedBy,System.ChangedBy,System.CreatedDate,System.ChangedDate,System.AreaPath,System.IterationPath,System.Tags,System.CommentCount,System.Reason,Microsoft.VSTS.Common.Priority,Microsoft.VSTS.Common.Severity,Microsoft.VSTS.Common.ClosedDate,System.Description&api-version=7.1"
        ) {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Investigate incident",
            },
          };
        }

        if (path === "/_apis/wit/workitems/101/revisions?%24top=2&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 101,
                rev: 1,
                fields: {
                  "System.Title": "Investigate incident",
                  "System.State": "New",
                  "System.WorkItemType": "Incident",
                  "System.CreatedDate": "2026-04-01T07:00:00Z",
                  "System.ChangedDate": "2026-04-01T07:00:00Z",
                  "System.ChangedBy": { displayName: "Reporter" },
                },
              },
              {
                id: 101,
                rev: 2,
                fields: {
                  "System.Title": "Investigate incident",
                  "System.State": "Active",
                  "System.WorkItemType": "Incident",
                  "System.CreatedDate": "2026-04-01T07:00:00Z",
                  "System.ChangedDate": "2026-04-01T08:00:00Z",
                  "System.ChangedBy": { displayName: "Editor" },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/revisions?%24top=2&%24skip=2&api-version=7.1") {
          return {
            value: [
              {
                id: 101,
                rev: 3,
                fields: {
                  "System.Title": "Investigate incident",
                  "System.State": "Resolved",
                  "System.WorkItemType": "Incident",
                  "System.CreatedDate": "2026-04-01T07:00:00Z",
                  "System.ChangedDate": "2026-04-01T09:00:00Z",
                  "System.ChangedBy": { displayName: "Resolver" },
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

    const result = await services.listWorkItemRevisions({
      id: 101,
      pageSize: 2,
      includeRaw: true,
    });

    expect(result.totalCount).toBe(3);
    expect(result.paging.pagesFetched).toBe(2);
    expect(result.revisions.map((revision) => revision.rev)).toEqual([1, 2, 3]);
    expect(result.revisions[2]?.changedBy).toBe("Resolver");
    expect(result.revisions[2]?.state).toBe("Resolved");
    expect(result.revisions[0]?.raw).toBeDefined();
  });

  it("exports fully expanded work items in WIQL order with nested audit sections", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.includes("/_apis/wit/workitemtypecategories?api-version=7.1")) {
          return {
            value: [],
          };
        }

        if (path === "/_apis/wit/workitems?ids=202%2C101&%24expand=all&api-version=7.1") {
          return {
            value: [
              {
                id: 101,
                rev: 2,
                url: "https://example/items/101",
                relations: [
                  {
                    rel: "AttachedFile",
                    url: "https://example/_apis/wit/attachments/a-101",
                    attributes: {
                      name: "dump-101.txt",
                    },
                  },
                ],
                _links: {
                  html: { href: "https://example/html/101" },
                },
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Second item",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                },
              },
              {
                id: 202,
                rev: 3,
                url: "https://example/items/202",
                relations: [
                  {
                    rel: "AttachedFile",
                    url: "https://example/_apis/wit/attachments/a-202",
                    attributes: {
                      name: "dump-202.txt",
                    },
                  },
                ],
                _links: {
                  html: { href: "https://example/html/202" },
                },
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "First item",
                  "System.State": "Resolved",
                  "System.WorkItemType": "Incident",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems/202/comments?%24top=200&includeDeleted=true&%24expand=renderedText&api-version=7.1-preview.4"
        ) {
          return {
            comments: [
              {
                id: 9202,
                workItemId: 202,
                text: "First item comment",
              },
            ],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems/101/comments?%24top=200&includeDeleted=true&%24expand=renderedText&api-version=7.1-preview.4"
        ) {
          return {
            comments: [
              {
                id: 9101,
                workItemId: 101,
                text: "Second item comment",
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/202/updates?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 3202,
                workItemId: 202,
                fields: {
                  "System.State": {
                    oldValue: "Active",
                    newValue: "Resolved",
                  },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/updates?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 3101,
                workItemId: 101,
                fields: {
                  "System.AssignedTo": {
                    newValue: "Gytis",
                  },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/202/revisions?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 202,
                rev: 3,
                fields: {
                  "System.Title": "First item",
                  "System.State": "Resolved",
                  "System.WorkItemType": "Incident",
                  "System.ChangedDate": "2026-04-01T10:00:00Z",
                  "System.ChangedBy": { displayName: "Resolver" },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/revisions?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 101,
                rev: 2,
                fields: {
                  "System.Title": "Second item",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.ChangedDate": "2026-04-01T09:00:00Z",
                  "System.ChangedBy": { displayName: "Editor" },
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn().mockResolvedValue({
        workItems: [{ id: 202 }, { id: 101 }],
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.exportWorkItemsFull({
      project: "Allowed Project",
      states: ["Active", "Resolved"],
      maxItems: 2,
      includeRelations: true,
      includeLinks: true,
      includeComments: true,
      includeUpdates: true,
      includeRevisions: true,
      includeAttachments: true,
      includeRaw: true,
    });

    expect(result.totalMatched).toBe(2);
    expect(result.returned).toBe(2);
    expect(result.workItems.map((item) => item.id)).toEqual([202, 101]);
    expect(result.workItems[0]?.comments?.[0]?.commentId).toBe(9202);
    expect(result.workItems[0]?.updates?.[0]?.changedFields).toEqual(["System.State"]);
    expect(result.workItems[0]?.revisions?.[0]?.changedBy).toBe("Resolver");
    expect(result.workItems[0]?.attachments?.[0]?.name).toBe("dump-202.txt");
    expect(result.workItems[0]?.raw).toBeDefined();
    expect(client.post).toHaveBeenCalledWith(
      expect.stringContaining("/Allowed%20Project/_apis/wit/wiql"),
      {
        query: expect.stringContaining("[System.State] IN ('Active', 'Resolved')"),
      },
    );
  });

  it("chunks bulk work item fetches during full exports while preserving result order", async () => {
    const ids = Array.from({ length: 101 }, (_, index) => index + 1);
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.includes("/_apis/wit/workitemtypecategories?api-version=7.1")) {
          return {
            value: [],
          };
        }

        if (!path.startsWith("/_apis/wit/workitems?ids=")) {
          throw new Error(`Unexpected GET ${path}`);
        }

        const parsed = new URL(`https://example.invalid${path}`);
        const batchIds = (parsed.searchParams.get("ids") ?? "")
          .split(",")
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value));

        return {
          value: [...batchIds]
            .reverse()
            .map((id) => ({
              id,
              fields: {
                "System.TeamProject": "Allowed Project",
                "System.Title": `Work item ${id}`,
                "System.WorkItemType": "Bug",
              },
            })),
        };
      }),
      post: vi.fn().mockResolvedValue({
        workItems: ids.map((id) => ({ id })),
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const result = await services.exportWorkItemsFull({
      project: "Allowed Project",
      maxItems: 101,
    });

    expect(result.returned).toBe(101);
    expect(result.workItems[0]?.id).toBe(1);
    expect(result.workItems[100]?.id).toBe(101);
    expect(
      client.get.mock.calls.filter(([path]) => String(path).startsWith("/_apis/wit/workitems?ids=")),
    ).toHaveLength(2);
  });

  it("loads a full test plan with metadata and optional raw payload", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 12,
        name: "Release Plan",
        state: "Active",
        startDate: "2026-04-01T00:00:00Z",
        endDate: "2026-04-30T00:00:00Z",
        iteration: "Release 1",
        areaPath: "Allowed Project",
        rootSuite: { id: 1001 },
        owner: { displayName: "Plan Owner" },
        createdBy: { displayName: "Creator" },
        createdDate: "2026-03-25T09:00:00Z",
        updatedBy: { displayName: "Editor" },
        updatedDate: "2026-03-28T10:00:00Z",
        revision: 4,
        url: "https://example/plans/12",
        _links: {
          web: { href: "https://example/web/plans/12" },
        },
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const plan = await services.getTestPlan({
      project: "Allowed Project",
      planId: 12,
      includeRaw: true,
    });

    expect(client.get).toHaveBeenCalledWith(
      "/Allowed%20Project/_apis/testplan/Plans/12?api-version=7.1",
    );
    expect(plan.rootSuiteId).toBe(1001);
    expect(plan.owner).toBe("Plan Owner");
    expect(plan.createdBy).toBe("Creator");
    expect(plan._links?.web).toEqual({
      href: "https://example/web/plans/12",
    });
    expect(plan.raw).toBeDefined();
  });

  it("builds a recursive test suite tree across continuation pages and honors maxDepth", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/testplan/Plans/12?api-version=7.1") {
          return {
            id: 12,
            name: "Release Plan",
            rootSuite: { id: 1001 },
          };
        }

        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/suites?api-version=7.1") {
          return {
            continuationToken: "page-2",
            value: [
              { id: 1001, name: "Root Suite", suiteType: "StaticTestSuite" },
              { id: 1002, name: "Child Suite", suiteType: "RequirementTestSuite", parentSuite: { id: 1001 } },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/testplan/Plans/12/suites?api-version=7.1&continuationToken=page-2"
        ) {
          return {
            value: [
              { id: 1003, name: "Grandchild Suite", suiteType: "StaticTestSuite", parentSuite: { id: 1002 } },
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

    const tree = await services.getTestPlanSuitesTree({
      project: "Allowed Project",
      planId: 12,
      maxDepth: 1,
      includeRaw: true,
    });

    expect(tree.rootSuiteId).toBe(1001);
    expect(tree.totalSuites).toBe(2);
    expect(tree.suiteTree).toHaveLength(1);
    expect(tree.suiteTree[0]?.children.map((child) => child.id)).toEqual([1002]);
    expect(tree.suiteTree[0]?.children[0]?.children).toEqual([]);
    expect(tree.suiteTree[0]?.raw).toBeDefined();
  });

  it("loads a full test suite with parent, children, plan context, and raw payload", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/testplan/Plans/12?api-version=7.1") {
          return {
            id: 12,
            name: "Release Plan",
          };
        }

        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/suites?api-version=7.1") {
          return {
            value: [
              { id: 1001, name: "Root Suite", suiteType: "StaticTestSuite" },
              { id: 1002, name: "Requirement Suite", suiteType: "RequirementTestSuite", parentSuite: { id: 1001 } },
              { id: 1003, name: "Nested Suite", suiteType: "StaticTestSuite", parentSuite: { id: 1002 } },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/Suites/1002?api-version=7.1") {
          return {
            id: 1002,
            name: "Requirement Suite",
            suiteType: "RequirementTestSuite",
            parentSuite: { id: 1001 },
            testCaseCount: 4,
            queryString: "Priority = 1",
            inheritDefaultConfigurations: true,
            defaultConfigurations: [{ id: 33, name: "Chrome" }],
            state: "InProgress",
            project: { name: "Allowed Project" },
            _links: {
              web: { href: "https://example/suites/1002" },
            },
            url: "https://example/api/suites/1002",
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const suite = await services.getTestSuite({
      project: "Allowed Project",
      planId: 12,
      suiteId: 1002,
      includeRaw: true,
    });

    expect(suite.planName).toBe("Release Plan");
    expect(suite.parent?.id).toBe(1001);
    expect(suite.children.map((child) => child.id)).toEqual([1003]);
    expect(suite.defaultConfigurations[0]?.name).toBe("Chrome");
    expect(suite.raw).toBeDefined();
  });

  it("lists test points across paged responses with execute-style columns", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/Suites/1002?api-version=7.1") {
          return {
            id: 1002,
            name: "Requirement Suite",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Plans/12/Suites/1002/points?witFields=System.Title&api-version=7.1&$top=2&$skip=0"
        ) {
          return {
            totalCount: 3,
            value: [
              {
                id: 9001,
                outcome: "Passed",
                order: 1,
                state: "Completed",
                isActive: true,
                testCase: { id: 501, name: "Login works" },
                configuration: { id: 33, name: "Chrome" },
                assignedTo: { displayName: "Tester One" },
                lastRunId: 7001,
                lastResultId: 8001,
                lastResultStateChangedDate: "2026-04-05T10:00:00Z",
              },
              {
                id: 9002,
                outcome: "Failed",
                order: 2,
                state: "Completed",
                isActive: true,
                testCase: { id: 502, name: "Logout works" },
                configuration: { id: 34, name: "Edge" },
                assignedTo: { displayName: "Tester Two" },
                lastRunId: 7002,
                lastResultId: 8002,
                lastResultStateChangedDate: "2026-04-05T11:00:00Z",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Plans/12/Suites/1002/points?witFields=System.Title&api-version=7.1&$top=2&$skip=2"
        ) {
          return {
            totalCount: 3,
            value: [
              {
                id: 9003,
                outcome: "NotExecuted",
                order: 3,
                state: "Ready",
                isActive: true,
                testCase: { id: 503, name: "Profile works" },
                configuration: { id: 35, name: "Firefox" },
                assignedTo: { displayName: "Tester Three" },
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

    const points = await services.listTestPoints({
      project: "Allowed Project",
      planId: 12,
      suiteId: 1002,
      pageSize: 2,
      includeRaw: true,
    });

    expect(points.totalCount).toBe(3);
    expect(points.returned).toBe(3);
    expect(points.paging).toEqual({
      strategy: "skip",
      pageSize: 2,
      pagesFetched: 2,
    });
    expect(points.points.map((point) => point.pointId)).toEqual([9001, 9002, 9003]);
    expect(points.points[0]?.tester).toBe("Tester One");
    expect(points.points[0]?.raw).toBeDefined();
  });

  it("lists full suite-context test cases with parsed steps, parameters, shared steps, and linked points", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/testplan/suiteentry/1002?suiteEntryType=TestCase&api-version=7.1"
        ) {
          return {
            value: [{ id: 501 }],
          };
        }

        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/Suites/1002?api-version=7.1") {
          return {
            id: 1002,
            name: "Requirement Suite",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Plans/12/Suites/1002/points?witFields=System.Title&api-version=7.1&$top=2&$skip=0"
        ) {
          return {
            totalCount: 2,
            value: [
              {
                id: 9002,
                order: 2,
                testCase: { id: 501, name: "Login works" },
                configuration: { id: 34, name: "Edge" },
                assignedTo: { displayName: "Tester Two" },
              },
              {
                id: 9001,
                order: 1,
                testCase: { id: 501, name: "Login works" },
                configuration: { id: 33, name: "Chrome" },
                assignedTo: { displayName: "Tester One" },
              },
            ],
          };
        }

        if (
          path.startsWith("/_apis/wit/workitems?ids=501&fields=") &&
          path.includes("Microsoft.VSTS.TCM.Steps")
        ) {
          return {
            value: [
              {
                id: 501,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login works",
                  "System.State": "Design",
                  "System.AssignedTo": { displayName: "Test Designer" },
                  "System.AreaPath": "Allowed Project\\QA",
                  "System.IterationPath": "Allowed Project\\Sprint 5",
                  "Microsoft.VSTS.Common.Priority": 1,
                  "Microsoft.VSTS.TCM.AutomationStatus": "Automated",
                  "Microsoft.VSTS.TCM.Steps":
                    '<steps id="0" last="3"><step id="2" type="ActionStep"><parameterizedString isformatted="true">Open login page</parameterizedString><parameterizedString isformatted="true">Login page is shown</parameterizedString></step><compref id="3" ref="401" /></steps>',
                  "Microsoft.VSTS.TCM.Parameters":
                    '<parameters><param name="@browser" bind="default" /></parameters>',
                  "Microsoft.VSTS.TCM.LocalDataSource":
                    "<NewDataSet><Table1><browser>Chrome</browser></Table1></NewDataSet>",
                },
                url: "https://example/workitems/501",
              },
            ],
          };
        }

        if (
          path.startsWith("/_apis/wit/workitems?ids=401&fields=") &&
          path.includes("System.Title")
        ) {
          return {
            value: [
              {
                id: 401,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Shared login preconditions",
                },
                url: "https://example/workitems/401",
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

    const summary = await services.listTestCasesFull({
      project: "Allowed Project",
      planId: 12,
      suiteId: 1002,
      pageSize: 2,
      includeRaw: true,
    });

    expect(summary.totalCount).toBe(1);
    expect(summary.testCases[0]?.workItemId).toBe(501);
    expect(summary.testCases[0]?.automationStatus).toBe("Automated");
    expect(summary.testCases[0]?.steps).toEqual([
      {
        index: 2,
        kind: "action",
        actionText: "Open login page",
        expectedResult: "Login page is shown",
        sharedStepId: null,
        sharedStepTitle: null,
      },
      {
        index: 3,
        kind: "sharedStep",
        actionText: null,
        expectedResult: null,
        sharedStepId: 401,
        sharedStepTitle: "Shared login preconditions",
      },
    ]);
    expect(summary.testCases[0]?.parameters).toEqual({
      definitions: [
        {
          name: "@browser",
          bind: "default",
        },
      ],
      rows: [
        {
          browser: "Chrome",
        },
      ],
    });
    expect(summary.testCases[0]?.sharedSteps).toEqual([
      {
        workItemId: 401,
        title: "Shared login preconditions",
        url: "https://example/workitems/401",
      },
    ]);
    expect(summary.testCases[0]?.points.map((point) => point.pointId)).toEqual([9001, 9002]);
    expect(summary.testCases[0]?.raw).toBeDefined();
    expect(summary.testCases[0]?.points[0]?.raw).toBeDefined();
  });

  it("rejects blocked test-case full requests before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.listTestCasesFull({
        project: "Blocked Project",
        planId: 12,
        suiteId: 1002,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("loads full test point history across plan runs and result pages", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/Suites/1002?api-version=7.1") {
          return {
            id: 1002,
            name: "Requirement Suite",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Plans/12/Suites/1002/points?witFields=System.Title&api-version=7.1&$top=1&$skip=0"
        ) {
          return {
            totalCount: 1,
            value: [
              {
                id: 9001,
                testCase: { id: 501, name: "Login works" },
                configuration: { id: 33, name: "Chrome" },
                assignedTo: { displayName: "Current Tester" },
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/runs?planIds=12&$top=1&$skip=0&api-version=7.1"
        ) {
          return {
            totalCount: 2,
            value: [{ id: 7001 }],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/runs?planIds=12&$top=1&$skip=1&api-version=7.1"
        ) {
          return {
            totalCount: 2,
            value: [{ id: 7002 }],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=1&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            totalCount: 1,
            value: [
              {
                id: 8001,
                pointId: 9001,
                outcome: "Failed",
                runId: 7001,
                completedDate: "2026-04-06T11:00:00Z",
                runBy: { displayName: "Tester One" },
                testCase: { id: 501, name: "Login works" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                configuration: { id: 33, name: "Chrome" },
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7002/results?$top=1&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            totalCount: 1,
            value: [
              {
                id: 8002,
                pointId: 9001,
                outcome: "Passed",
                runId: 7002,
                completedDate: "2026-04-06T12:00:00Z",
                runBy: { displayName: "Tester Two" },
                testCase: { id: 501, name: "Login works" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                configuration: { id: 33, name: "Chrome" },
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

    const history = await services.getTestPointHistory({
      project: "Allowed Project",
      planId: 12,
      suiteId: 1002,
      pointId: 9001,
      pageSize: 1,
      includeRaw: true,
    });

    expect(history.currentTester).toBe("Current Tester");
    expect(history.history).toHaveLength(2);
    expect(history.history.map((entry) => entry.testRunId)).toEqual([7002, 7001]);
    expect(history.history[0]?.outcome).toBe("Passed");
    expect(history.history[0]?.raw).toBeDefined();
    expect(history.paging.pagesFetched).toBe(5);
  });

  it("loads a full test run with paged results, step-level details, attachments, and raw payloads", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/test/runs/7001?api-version=7.1") {
          return {
            id: 7001,
            name: "Nightly Run",
            state: "Completed",
            totalTests: 2,
            passedTests: 1,
            failedTests: 1,
            result: "Failed",
            runBy: { displayName: "Run Owner" },
            createdDate: "2026-04-06T09:00:00Z",
            completedDate: "2026-04-06T12:00:00Z",
            plan: { id: 12, name: "Release Plan" },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=1&$skip=0&detailsToInclude=Iterations%2CWorkItems&api-version=7.1"
        ) {
          return {
            totalCount: 2,
            value: [
              {
                id: 8001,
                outcome: "Failed",
                state: "Completed",
                runBy: { displayName: "Tester One" },
                testCase: { id: 501, name: "Login works" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                configuration: { id: 33, name: "Chrome" },
                associatedWorkItems: [{ id: 101 }],
                attachments: [{ id: 1, name: "result.txt", url: "https://example/results/1" }],
                iterations: [
                  {
                    actionResults: [
                      {
                        actionPath: "1",
                        actionTitle: "Open login page",
                        expectedResult: "Login page is shown",
                        outcome: "Passed",
                      },
                    ],
                  },
                ],
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=1&$skip=1&detailsToInclude=Iterations%2CWorkItems&api-version=7.1"
        ) {
          return {
            totalCount: 2,
            value: [
              {
                id: 8002,
                outcome: "Passed",
                state: "Completed",
                runBy: { displayName: "Tester Two" },
                testCase: { id: 502, name: "Logout works" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                configuration: { id: 34, name: "Edge" },
              },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/test/Runs/7001/attachments?api-version=7.1") {
          return {
            value: [{ id: 91, name: "run-log.txt", url: "https://example/runs/7001/attachments/91" }],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const run = await services.getTestRunFull({
      project: "Allowed Project",
      runId: 7001,
      pageSize: 1,
      includeRaw: true,
    });

    expect(run.runId).toBe(7001);
    expect(run.results).toHaveLength(2);
    expect(run.paging.pagesFetched).toBe(2);
    expect(run.attachments[0]?.name).toBe("run-log.txt");
    expect(run.results[0]?.steps[0]?.actionText).toBe("Open login page");
    expect(run.results[0]?.linkedWorkItemIds).toEqual([101]);
    expect(run.results[0]?.raw).toBeDefined();
    expect(run.raw).toBeDefined();
  });

  it("exports a full test plan with include flags, selected suites, and raw payloads", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/testplan/Plans/12?api-version=7.1") {
          return {
            id: 12,
            name: "Release Plan",
            rootSuite: { id: 1001 },
          };
        }

        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/suites?api-version=7.1") {
          return {
            value: [
              { id: 1001, name: "Root Suite", suiteType: "StaticTestSuite" },
              { id: 1002, name: "Requirement Suite", suiteType: "RequirementTestSuite", parentSuite: { id: 1001 } },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/Suites/1002?api-version=7.1") {
          return {
            id: 1002,
            name: "Requirement Suite",
            suiteType: "RequirementTestSuite",
            parentSuite: { id: 1001 },
            defaultConfigurations: [{ id: 33, name: "Chrome" }],
            project: { name: "Allowed Project" },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Plans/12/Suites/1002/points?witFields=System.Title&api-version=7.1&$top=1&$skip=0"
        ) {
          return {
            totalCount: 1,
            value: [
              {
                id: 9001,
                testCase: { id: 501, name: "Login works" },
                configuration: { id: 33, name: "Chrome" },
                assignedTo: { displayName: "Current Tester" },
                lastRunId: 7001,
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/runs?planIds=12&$top=1&$skip=0&api-version=7.1"
        ) {
          return {
            totalCount: 1,
            value: [{ id: 7001 }],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=1&$skip=0&detailsToInclude=WorkItems&api-version=7.1"
        ) {
          return {
            totalCount: 1,
            value: [
              {
                id: 8001,
                pointId: 9001,
                outcome: "Passed",
                runId: 7001,
                completedDate: "2026-04-06T12:00:00Z",
                runBy: { displayName: "Tester Two" },
                testCase: { id: 501, name: "Login works" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                configuration: { id: 33, name: "Chrome" },
              },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/test/runs/7001?api-version=7.1") {
          return {
            id: 7001,
            name: "Nightly Run",
            state: "Completed",
            totalTests: 1,
            passedTests: 1,
            failedTests: 0,
            result: "Passed",
            plan: { id: 12, name: "Release Plan" },
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Runs/7001/results?$top=1&$skip=0&detailsToInclude=Iterations%2CWorkItems&api-version=7.1"
        ) {
          return {
            totalCount: 1,
            value: [
              {
                id: 8001,
                pointId: 9001,
                outcome: "Passed",
                runId: 7001,
                testCase: { id: 501, name: "Login works" },
                testSuite: { id: 1002, name: "Requirement Suite" },
                configuration: { id: 33, name: "Chrome" },
                associatedWorkItems: [{ id: 101 }],
                iterations: [],
              },
            ],
          };
        }

        if (path === "/Allowed%20Project/_apis/test/Runs/7001/attachments?api-version=7.1") {
          return {
            value: [],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/testplan/suiteentry/1002?suiteEntryType=TestCase&api-version=7.1"
        ) {
          return {
            value: [{ id: 501 }],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/test/Plans/12/Suites/1002/points?witFields=System.Title&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 9001,
                testCase: { id: 501, name: "Login works" },
                configuration: { id: 33, name: "Chrome" },
                assignedTo: { displayName: "Current Tester" },
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

    const exportSummary = await services.exportTestPlanFull({
      project: "Allowed Project",
      planId: 12,
      suiteIds: [1002],
      maxDepth: 2,
      pageSize: 1,
      includePointHistory: true,
      includeRuns: true,
      includeTestCases: true,
      includeRaw: true,
    });

    expect(exportSummary.plan.raw).toBeDefined();
    expect(exportSummary.suiteTree.map((suite) => suite.id)).toEqual([1002]);
    expect(exportSummary.suitesById["1002"]?.raw).toBeDefined();
    expect(exportSummary.pointsBySuiteId["1002"]?.[0]?.pointId).toBe(9001);
    expect(exportSummary.pointHistoryByPointId?.["9001"]?.history).toHaveLength(1);
    expect(exportSummary.runsById?.["7001"]?.results[0]?.linkedWorkItemIds).toEqual([101]);
    expect(exportSummary.testCasesById?.["501"]?.workItemName).toBe("Login works");
  });

  it("can export a minimal test plan structure when optional sections are disabled", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/testplan/Plans/12?api-version=7.1") {
          return {
            id: 12,
            name: "Release Plan",
            rootSuite: { id: 1001 },
          };
        }

        if (path === "/Allowed%20Project/_apis/testplan/Plans/12/suites?api-version=7.1") {
          return {
            value: [{ id: 1001, name: "Root Suite", suiteType: "StaticTestSuite" }],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const exportSummary = await services.exportTestPlanFull({
      project: "Allowed Project",
      planId: 12,
      includeSuites: false,
      includePoints: false,
    });

    expect(exportSummary.suiteTree).toEqual([]);
    expect(exportSummary.suitesById).toEqual({});
    expect(exportSummary.pointsBySuiteId).toEqual({});
    expect(exportSummary.pointHistoryByPointId).toBeUndefined();
    expect(exportSummary.runsById).toBeUndefined();
  });

  it("rejects blocked test-plan access before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.getTestPlan({
        project: "Blocked Project",
        planId: 12,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("rejects blocked test-run access before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.getTestRunFull({
        project: "Blocked Project",
        runId: 7001,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("lists work item fields with explicit selectors, search filtering, and raw payloads", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            name: "Title",
            referenceName: "System.Title",
            type: "string",
            readOnly: false,
            supportedOperations: [{ name: "Contains", referenceName: "SupportedOperations.Contains" }],
          },
          {
            name: "Assigned To",
            referenceName: "System.AssignedTo",
            type: "string",
            isIdentity: true,
            supportedOperations: [{ name: "Equals", referenceName: "SupportedOperations.Equals" }],
          },
          {
            name: "Priority",
            referenceName: "Microsoft.VSTS.Common.Priority",
            type: "integer",
            isPicklist: true,
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.listWorkItemFields({
      project: "Allowed Project",
      names: ["Assigned To"],
      referenceNames: ["System.Title"],
      search: "system",
      includeRaw: true,
    });

    expect(client.get).toHaveBeenCalledWith(
      "/Allowed%20Project/_apis/wit/fields?api-version=7.1",
    );
    expect(summary.fields.map((field) => field.referenceName)).toEqual([
      "System.AssignedTo",
      "System.Title",
    ]);
    expect(summary.fields[0]?.isIdentity).toBe(true);
    expect(summary.fields[0]?.raw).toBeDefined();
  });

  it("lists area paths in tree mode and preserves nested children", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 1,
        name: "Allowed Project",
        path: "Allowed Project",
        children: [
          {
            id: 2,
            name: "Platform",
            path: "Allowed Project\\Platform",
            children: [{ id: 3, name: "API" }],
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.listAreaPaths({
      project: "Allowed Project",
      depth: 2,
      mode: "tree",
      includeRaw: true,
    });

    expect(client.get).toHaveBeenCalledWith(
      "/Allowed%20Project/_apis/wit/classificationnodes/areas?$depth=2&api-version=7.1",
    );
    expect(summary.total).toBe(3);
    expect(summary.paths[0]?.children[0]?.children[0]?.path).toBe("Allowed Project\\Platform\\API");
    expect(summary.paths[0]?.raw).toBeDefined();
  });

  it("lists iteration paths in flat mode with date metadata", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        id: 11,
        name: "Allowed Project",
        path: "Allowed Project",
        children: [
          {
            id: 12,
            name: "Sprint 1",
            path: "Allowed Project\\Sprint 1",
            attributes: {
              startDate: "2026-04-01T00:00:00Z",
              finishDate: "2026-04-14T00:00:00Z",
            },
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.listIterationPaths({
      project: "Allowed Project",
      depth: 3,
      mode: "flat",
    });

    expect(summary.paths.map((path) => path.path)).toEqual([
      "Allowed Project",
      "Allowed Project\\Sprint 1",
    ]);
    expect(summary.paths[1]?.startDate).toBe("2026-04-01T00:00:00Z");
    expect(summary.paths[1]?.children).toEqual([]);
  });

  it("lists tags with search, top limits, and raw payloads", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          { name: "customer", url: "https://example/tags/customer" },
          { name: "customer escalation", url: "https://example/tags/customer-escalation" },
          { name: "prod", url: "https://example/tags/prod" },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.listTags({
      project: "Allowed Project",
      search: "customer",
      top: 1,
      includeRaw: true,
    });

    expect(summary.total).toBe(1);
    expect(summary.tags[0]?.name).toBe("customer");
    expect(summary.tags[0]?.raw).toEqual({
      name: "customer",
      url: "https://example/tags/customer",
    });
  });

  it("resolves identities, ranks exact matches first, and keeps raw payloads caller-controlled", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            id: "2",
            providerDisplayName: "Bob Alice",
            uniqueName: "bob@example.com",
            descriptor: "descriptor-bob",
          },
          {
            id: "1",
            providerDisplayName: "Alice Johnson",
            uniqueName: "alice.johnson@example.com",
            descriptor: "descriptor-alice",
            properties: {
              Mail: { $value: "alice.johnson@example.com" },
            },
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.resolveIdentity({
      query: "alice",
      project: "Allowed Project",
      top: 2,
      includeRaw: true,
    });

    expect(client.get).toHaveBeenCalledWith(
      "/Allowed%20Project/_apis/Identities?searchFilter=General&filterValue=alice&queryMembership=None&api-version=7.1",
    );
    expect(summary.identities.map((identity) => identity.id)).toEqual(["1", "2"]);
    expect(summary.identities[0]?.raw).toBeDefined();
  });

  it("rejects blocked discovery access before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.listAreaPaths({
        project: "Blocked Project",
      }),
    ).rejects.toThrow(/Blocked Project/);
    await expect(
      services.resolveIdentity({
        query: "alice",
        project: "Blocked Project",
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("lists saved queries with tree mode, WIQL expansion, and raw payloads", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            id: "folder-1",
            name: "Shared Queries",
            path: "Shared Queries",
            isFolder: true,
            hasChildren: true,
            children: [
              {
                id: "query-1",
                name: "Active Bugs",
                path: "Shared Queries/Active Bugs",
                isFolder: false,
                queryType: "flat",
                wiql: "Select [System.Id] From WorkItems",
              },
            ],
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.listSavedQueries({
      project: "Allowed Project",
      depth: 2,
      mode: "tree",
      includeWiql: true,
      includeRaw: true,
    });

    expect(client.get).toHaveBeenCalledWith(
      "/Allowed%20Project/_apis/wit/queries?$depth=2&$expand=wiql&api-version=7.1",
    );
    expect(summary.total).toBe(2);
    expect(summary.queries[0]?.children[0]?.wiql).toContain("Select");
    expect(summary.queries[0]?.raw).toBeDefined();
  });

  it("lists saved queries in flat mode", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        value: [
          {
            id: "folder-1",
            name: "Shared Queries",
            path: "Shared Queries",
            isFolder: true,
            hasChildren: true,
            children: [
              {
                id: "query-1",
                name: "Active Bugs",
                path: "Shared Queries/Active Bugs",
                isFolder: false,
                queryType: "flat",
              },
            ],
          },
        ],
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.listSavedQueries({
      project: "Allowed Project",
      mode: "flat",
    });

    expect(summary.queries.map((query) => query.path)).toEqual([
      "Shared Queries",
      "Shared Queries/Active Bugs",
    ]);
  });

  it("runs a saved query by id and returns ordered work item ids with top limits", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/wit/queries/query-1?api-version=7.1&%24expand=wiql"
        ) {
          return {
            id: "query-1",
            name: "Active Bugs",
            path: "Shared Queries/Active Bugs",
            isFolder: false,
            queryType: "flat",
            wiql: "Select [System.Id] From WorkItems Order By [System.ChangedDate] Desc",
          };
        }

        if (path === "/Allowed%20Project/_apis/wit/wiql/query-1?api-version=7.1") {
          return {
            workItems: [{ id: 303 }, { id: 202 }, { id: 101 }],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.runSavedQuery({
      project: "Allowed Project",
      queryId: "query-1",
      top: 2,
    });

    expect(summary.query.id).toBe("query-1");
    expect(summary.total).toBe(3);
    expect(summary.returned).toBe(2);
    expect(summary.workItemIds).toEqual([303, 202]);
    expect(summary.workItems).toBeUndefined();
  });

  it("runs a saved query by path, resolves its id, and optionally loads expanded work items", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/wit/queries?$depth=20&$expand=minimal&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: "folder-1",
                name: "Shared Queries",
                path: "Shared Queries",
                isFolder: true,
                hasChildren: true,
                children: [
                  {
                    id: "query-2",
                    name: "Ready For QA",
                    path: "Shared Queries/Ready For QA",
                    isFolder: false,
                    queryType: "flat",
                  },
                ],
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/wit/queries/query-2?api-version=7.1&%24expand=wiql"
        ) {
          return {
            id: "query-2",
            name: "Ready For QA",
            path: "Shared Queries/Ready For QA",
            isFolder: false,
            queryType: "flat",
            wiql: "Select [System.Id] From WorkItems Where [System.State] = 'Ready for QA'",
          };
        }

        if (path === "/Allowed%20Project/_apis/wit/wiql/query-2?api-version=7.1") {
          return {
            workItems: [{ id: 202 }, { id: 101 }],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems?ids=202%2C101&%24expand=relations&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 101,
                rev: 7,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Second in raw response",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                },
                relations: [{ rel: "System.LinkTypes.Related", url: "https://example/items/1" }],
              },
              {
                id: 202,
                rev: 9,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "First in raw response",
                  "System.State": "Ready for QA",
                  "System.WorkItemType": "User Story",
                },
                relations: [{ rel: "System.LinkTypes.Hierarchy-Forward", url: "https://example/items/2" }],
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

    const summary = await services.runSavedQuery({
      project: "Allowed Project",
      path: "Shared Queries/Ready For QA",
      includeWorkItems: true,
      expand: "relations",
      includeRaw: true,
    });

    expect(summary.query.id).toBe("query-2");
    expect(summary.wiql).toContain("Ready for QA");
    expect(summary.workItemIds).toEqual([202, 101]);
    expect(summary.workItems?.map((item) => item.id)).toEqual([202, 101]);
    expect(summary.workItems?.[0]?.relations).toHaveLength(1);
    expect(summary.workItems?.[0]?.raw).toBeDefined();
    expect(summary.raw).toEqual(
      expect.objectContaining({
        execution: {
          workItems: [{ id: 202 }, { id: 101 }],
        },
      }),
    );
  });

  it("rejects blocked saved-query access before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.listSavedQueries({
        project: "Blocked Project",
      }),
    ).rejects.toThrow(/Blocked Project/);
    await expect(
      services.runSavedQuery({
        project: "Blocked Project",
        queryId: "query-1",
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("exports a work item delta from changedSince and can enrich it with updates and revisions", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/_apis/wit/workitems?ids=202%2C101&%24expand=relations&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 101,
                rev: 2,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Second item",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.ChangedDate": "2026-04-02T10:00:00Z",
                },
                relations: [],
              },
              {
                id: 202,
                rev: 3,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "First item",
                  "System.State": "Resolved",
                  "System.WorkItemType": "Incident",
                  "System.ChangedDate": "2026-04-03T10:00:00Z",
                },
                relations: [],
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/202/updates?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 1,
                workItemId: 202,
                rev: 3,
                revisedDate: "2026-04-03T10:00:00Z",
                revisedBy: { displayName: "Resolver" },
                fields: {
                  "System.State": {
                    newValue: "Resolved",
                  },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/updates?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 1,
                workItemId: 101,
                rev: 2,
                revisedDate: "2026-04-02T10:00:00Z",
                revisedBy: { displayName: "Editor" },
                fields: {
                  "System.State": {
                    newValue: "Active",
                  },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/202/revisions?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 202,
                rev: 3,
                fields: {
                  "System.Title": "First item",
                  "System.State": "Resolved",
                  "System.WorkItemType": "Incident",
                  "System.ChangedDate": "2026-04-03T10:00:00Z",
                  "System.ChangedBy": { displayName: "Resolver" },
                },
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101/revisions?%24top=200&%24skip=0&api-version=7.1") {
          return {
            value: [
              {
                id: 101,
                rev: 2,
                fields: {
                  "System.Title": "Second item",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.ChangedDate": "2026-04-02T10:00:00Z",
                  "System.ChangedBy": { displayName: "Editor" },
                },
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn().mockResolvedValue({
        workItems: [{ id: 202 }, { id: 101 }],
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.exportWorkItemsDelta({
      project: "Allowed Project",
      changedSince: "2026-04-01",
      maxItems: 2,
      expand: "relations",
      includeWorkItems: true,
      includeUpdates: true,
      includeRevisions: true,
      includeRaw: true,
    });

    expect(summary.changedSince).toBe("2026-04-01");
    expect(summary.total).toBe(2);
    expect(summary.workItemIds).toEqual([202, 101]);
    expect(summary.workItems?.map((item) => item.id)).toEqual([202, 101]);
    expect(summary.updatesByWorkItemId?.["202"]?.[0]).toEqual(
      expect.objectContaining({
        workItemId: 202,
        changedFields: ["System.State"],
      }),
    );
    expect(summary.revisionsByWorkItemId?.["101"]?.[0]).toEqual(
      expect.objectContaining({
        workItemId: 101,
        changedBy: "Editor",
      }),
    );
    expect(summary.raw).toEqual(
      expect.objectContaining({
        query: expect.any(Object),
      }),
    );
    expect(client.post).toHaveBeenCalledWith(
      expect.stringContaining("/Allowed%20Project/_apis/wit/wiql"),
      {
        query: expect.stringContaining("[System.ChangedDate] >= '2026-04-01'"),
      },
    );
  });

  it("exports a traceability dataset from a saved query scope and reuses work item, PR, and commit building blocks", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (
          path ===
          "/Allowed%20Project/_apis/wit/queries?$depth=20&$expand=minimal&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: "folder-1",
                name: "Shared Queries",
                path: "Shared Queries",
                isFolder: true,
                hasChildren: true,
                children: [
                  {
                    id: "query-2",
                    name: "Ready For QA",
                    path: "Shared Queries/Ready For QA",
                    isFolder: false,
                    queryType: "flat",
                  },
                ],
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/wit/queries/query-2?api-version=7.1&%24expand=wiql"
        ) {
          return {
            id: "query-2",
            name: "Ready For QA",
            path: "Shared Queries/Ready For QA",
            isFolder: false,
            queryType: "flat",
            wiql: "Select [System.Id] From WorkItems Where [System.State] = 'Ready for QA'",
          };
        }

        if (path === "/Allowed%20Project/_apis/wit/wiql/query-2?api-version=7.1") {
          return {
            workItems: [{ id: 101 }],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems?ids=101&%24expand=relations&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 101,
                rev: 5,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Ready for QA story",
                  "System.State": "Ready for QA",
                  "System.WorkItemType": "User Story",
                },
                relations: [
                  {
                    rel: "ArtifactLink",
                    url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
                    attributes: {
                      name: "Pull Request",
                    },
                  },
                ],
              },
            ],
          };
        }

        if (path === "/_apis/wit/workitems/101?%24expand=relations&api-version=7.1") {
          return {
            id: 101,
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Ready for QA story",
              "System.WorkItemType": "User Story",
              "System.State": "Ready for QA",
            },
            relations: [
              {
                rel: "ArtifactLink",
                url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
                attributes: {
                  name: "Pull Request",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/55?api-version=7.1"
        ) {
          return {
            pullRequestId: 55,
            title: "Ready for QA implementation",
            status: "completed",
            createdBy: { displayName: "Gytis" },
            sourceRefName: "refs/heads/feature/qa",
            targetRefName: "refs/heads/main",
            creationDate: "2026-04-07T08:00:00Z",
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
            url: "https://example.invalid/pr/55",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/55/commits?api-version=7.1"
        ) {
          return {
            value: [
              {
                commitId: "abc123",
                comment: "Implement QA flow",
                author: { name: "Gytis", date: "2026-04-07T08:15:00Z" },
                committer: { name: "Gytis", date: "2026-04-07T08:20:00Z" },
                url: "https://example.invalid/commit/abc123",
              },
            ],
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/abc123?api-version=7.1"
        ) {
          return {
            commitId: "abc123",
            comment: "Implement QA flow",
            author: { name: "Gytis", date: "2026-04-07T08:15:00Z" },
            committer: { name: "Gytis", date: "2026-04-07T08:20:00Z" },
            repository: {
              id: "repo-1",
              name: "frontend",
              project: {
                name: "Allowed Project",
              },
            },
            url: "https://example.invalid/commit/abc123",
          };
        }

        if (
          path ===
          "/Allowed%20Project/_apis/git/repositories/repo-1/commits/abc123/changes?$skip=0&$top=200&api-version=7.1"
        ) {
          return {
            changes: [
              {
                changeType: "edit",
                item: {
                  path: "/src/qa.ts",
                  gitObjectType: "blob",
                  objectId: "obj-1",
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

    const summary = await services.exportTraceabilityDataset({
      project: "Allowed Project",
      path: "Shared Queries/Ready For QA",
      maxItems: 10,
      expand: "relations",
      includeWorkItems: true,
      includePullRequests: true,
      includeCommits: true,
      includeRaw: true,
    });

    expect(summary.scope.source).toBe("saved_query");
    expect(summary.scope.savedQuery?.id).toBe("query-2");
    expect(summary.workItemIds).toEqual([101]);
    expect(summary.workItems?.[0]?.id).toBe(101);
    expect(summary.pullRequestsByWorkItemId?.["101"]?.[0]?.pullRequestId).toBe(55);
    expect(summary.commitsByWorkItemId?.["101"]?.[0]?.commitId).toBe("abc123");
    expect(summary.raw).toEqual(
      expect.objectContaining({
        scope: expect.objectContaining({
          savedQuery: expect.objectContaining({
            id: "query-2",
          }),
        }),
      }),
    );
  });

  it("rejects blocked export access before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.exportWorkItemsDelta({
        project: "Blocked Project",
        changedSince: "2026-04-01",
      }),
    ).rejects.toThrow(/Blocked Project/);
    await expect(
      services.exportTraceabilityDataset({
        project: "Blocked Project",
        maxItems: 10,
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
  });

  it("finds similar work items with explainable reasons", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitems/101?%24expand=relations&api-version=7.1") {
          return {
            id: 101,
            rev: 3,
            url: "https://example.invalid/workitems/101",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Login save fails on validation error",
              "System.State": "Active",
              "System.WorkItemType": "Bug",
              "System.AssignedTo": {
                displayName: "Gytis",
              },
              "System.CreatedBy": {
                displayName: "Gytis",
              },
              "System.AreaPath": "Allowed Project\\Frontend",
              "System.IterationPath": "Allowed Project\\Sprint 1",
              "System.Tags": "frontend; login; urgent",
              "System.Description":
                "<p>Saving the login form fails after backend validation errors.</p>",
              "Custom.Component": "frontend",
            },
            relations: [
              {
                rel: "ArtifactLink",
                url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
                attributes: {
                  name: "Pull Request",
                },
              },
            ],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=101,202,303&fields=")) {
          return {
            value: [
              {
                id: 101,
                url: "https://example.invalid/workitems/101",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login; urgent",
                  "System.Description":
                    "<p>Saving the login form fails after backend validation errors.</p>",
                },
              },
              {
                id: 202,
                url: "https://example.invalid/workitems/202",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login form save failure after validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login",
                  "System.Description":
                    "<p>The login form save flow fails after validation errors.</p>",
                },
              },
              {
                id: 303,
                url: "https://example.invalid/workitems/303",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Nightly ETL refresh finishes late",
                  "System.State": "Active",
                  "System.WorkItemType": "Task",
                  "System.AreaPath": "Allowed Project\\Data",
                  "System.IterationPath": "Allowed Project\\Sprint 9",
                  "System.Tags": "etl; warehouse",
                  "System.Description":
                    "<p>Nightly ETL refresh finishes late because of an infrastructure dependency.</p>",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems?ids=101%2C202%2C303&%24expand=relations&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 101,
                rev: 3,
                url: "https://example.invalid/workitems/101",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AssignedTo": {
                    displayName: "Gytis",
                  },
                  "System.CreatedBy": {
                    displayName: "Gytis",
                  },
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login; urgent",
                  "System.Description":
                    "<p>Saving the login form fails after backend validation errors.</p>",
                  "Custom.Component": "frontend",
                },
                relations: [
                  {
                    rel: "ArtifactLink",
                    url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
                    attributes: {
                      name: "Pull Request",
                    },
                  },
                ],
              },
              {
                id: 202,
                rev: 2,
                url: "https://example.invalid/workitems/202",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login form save failure after validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AssignedTo": {
                    displayName: "Gytis",
                  },
                  "System.CreatedBy": {
                    displayName: "Gytis",
                  },
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login",
                  "System.Description":
                    "<p>The login form save flow fails after validation errors.</p>",
                  "Custom.Component": "frontend",
                },
                relations: [
                  {
                    rel: "ArtifactLink",
                    url: "vstfs:///Git/PullRequestId/Allowed%20Project%2Frepo-1%2F55",
                    attributes: {
                      name: "Pull Request",
                    },
                  },
                ],
              },
              {
                id: 303,
                rev: 1,
                url: "https://example.invalid/workitems/303",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Nightly ETL refresh finishes late",
                  "System.State": "Active",
                  "System.WorkItemType": "Task",
                  "System.AssignedTo": {
                    displayName: "Another User",
                  },
                  "System.CreatedBy": {
                    displayName: "Another User",
                  },
                  "System.AreaPath": "Allowed Project\\Data",
                  "System.IterationPath": "Allowed Project\\Sprint 9",
                  "System.Tags": "etl; warehouse",
                  "System.Description":
                    "<p>Nightly ETL refresh finishes late because of an infrastructure dependency.</p>",
                  "Custom.Component": "data",
                },
                relations: [],
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/wit/wiql?api-version=7.1&$top=5") {
          return {
            workItems: [{ id: 101 }, { id: 202 }, { id: 303 }],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.findSimilarWorkItems({
      project: "Allowed Project",
      workItemId: 101,
      fieldNames: ["Custom.Component"],
      maxCandidates: 5,
      top: 3,
      includeRaw: true,
    });

    expect(summary.workItemId).toBe(101);
    expect(summary.total).toBe(1);
    expect(summary.candidates[0]).toEqual(
      expect.objectContaining({
        candidateId: 202,
        similarityScore: expect.any(Number),
        reasons: expect.arrayContaining([
          expect.objectContaining({ kind: "title" }),
          expect.objectContaining({ kind: "description" }),
        ]),
        raw: expect.objectContaining({
          candidate: expect.objectContaining({ id: 202 }),
        }),
      }),
    );
  });

  it("finds duplicate candidates with deterministic signals", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/_apis/wit/workitems/101?%24expand=relations&api-version=7.1") {
          return {
            id: 101,
            rev: 3,
            url: "https://example.invalid/workitems/101",
            fields: {
              "System.TeamProject": "Allowed Project",
              "System.Title": "Login save fails on validation error",
              "System.State": "Active",
              "System.WorkItemType": "Bug",
              "System.AreaPath": "Allowed Project\\Frontend",
              "System.IterationPath": "Allowed Project\\Sprint 1",
              "System.Tags": "frontend; login; urgent",
              "System.Description":
                "<p>Saving the login form fails after backend validation errors.</p>",
            },
            relations: [],
          };
        }

        if (path.startsWith("/_apis/wit/workitems?ids=101,202,404&fields=")) {
          return {
            value: [
              {
                id: 101,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                },
              },
              {
                id: 202,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                },
              },
              {
                id: 404,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Warehouse ETL refresh is delayed",
                  "System.State": "Active",
                  "System.WorkItemType": "Task",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems?ids=101%2C202%2C404&%24expand=relations&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 101,
                rev: 3,
                url: "https://example.invalid/workitems/101",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login; urgent",
                  "System.Description":
                    "<p>Saving the login form fails after backend validation errors.</p>",
                },
                relations: [],
              },
              {
                id: 202,
                rev: 2,
                url: "https://example.invalid/workitems/202",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login",
                  "System.Description":
                    "<p>Saving the login form fails after backend validation errors.</p>",
                },
                relations: [],
              },
              {
                id: 404,
                rev: 1,
                url: "https://example.invalid/workitems/404",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Warehouse ETL refresh is delayed",
                  "System.State": "Active",
                  "System.WorkItemType": "Task",
                  "System.AreaPath": "Allowed Project\\Data",
                  "System.IterationPath": "Allowed Project\\Sprint 9",
                  "System.Tags": "etl; warehouse",
                  "System.Description":
                    "<p>Nightly ETL refresh finishes late because of an infrastructure dependency.</p>",
                },
                relations: [],
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/wit/wiql?api-version=7.1&$top=5") {
          return {
            workItems: [{ id: 101 }, { id: 202 }, { id: 404 }],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.findDuplicateCandidates({
      project: "Allowed Project",
      sourceWorkItemId: 101,
      maxCandidates: 5,
      top: 3,
      includeRaw: true,
    });

    expect(summary.total).toBe(1);
    expect(summary.candidates[0]).toEqual(
      expect.objectContaining({
        candidateId: 202,
        duplicateScore: expect.any(Number),
        signals: expect.objectContaining({
          sameWorkItemType: true,
        }),
      }),
    );
  });

  it("clusters work items by similarity across a search scope", async () => {
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.startsWith("/_apis/wit/workitems?ids=101,202,303&fields=")) {
          return {
            value: [
              {
                id: 101,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                },
              },
              {
                id: 202,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login form save failure after validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                },
              },
              {
                id: 303,
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Warehouse ETL refresh is delayed",
                  "System.State": "Active",
                  "System.WorkItemType": "Task",
                },
              },
            ],
          };
        }

        if (
          path ===
          "/_apis/wit/workitems?ids=101%2C202%2C303&%24expand=relations&api-version=7.1"
        ) {
          return {
            value: [
              {
                id: 101,
                rev: 3,
                url: "https://example.invalid/workitems/101",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login save fails on validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login; urgent",
                  "System.Description":
                    "<p>Saving the login form fails after backend validation errors.</p>",
                },
                relations: [],
              },
              {
                id: 202,
                rev: 2,
                url: "https://example.invalid/workitems/202",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Login form save failure after validation error",
                  "System.State": "Active",
                  "System.WorkItemType": "Bug",
                  "System.AreaPath": "Allowed Project\\Frontend",
                  "System.IterationPath": "Allowed Project\\Sprint 1",
                  "System.Tags": "frontend; login",
                  "System.Description":
                    "<p>The login form save flow fails after validation errors.</p>",
                },
                relations: [],
              },
              {
                id: 303,
                rev: 1,
                url: "https://example.invalid/workitems/303",
                fields: {
                  "System.TeamProject": "Allowed Project",
                  "System.Title": "Warehouse ETL refresh is delayed",
                  "System.State": "Active",
                  "System.WorkItemType": "Task",
                  "System.AreaPath": "Allowed Project\\Data",
                  "System.IterationPath": "Allowed Project\\Sprint 9",
                  "System.Tags": "etl; warehouse",
                  "System.Description":
                    "<p>Nightly ETL refresh finishes late because of an infrastructure dependency.</p>",
                },
                relations: [],
              },
            ],
          };
        }

        throw new Error(`Unexpected GET ${path}`);
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/Allowed%20Project/_apis/wit/wiql?api-version=7.1&$top=6") {
          return {
            workItems: [{ id: 101 }, { id: 202 }, { id: 303 }],
          };
        }

        throw new Error(`Unexpected POST ${path}`);
      }),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    const summary = await services.clusterWorkItemsBySimilarity({
      project: "Allowed Project",
      maxItems: 6,
      minScore: 0.35,
      includeRaw: true,
    });

    expect(summary.totalClusters).toBe(1);
    expect(summary.clusters[0]?.memberIds).toEqual([101, 202]);
    expect(summary.clusters[0]?.raw).toEqual(
      expect.objectContaining({
        members: expect.any(Array),
        edges: expect.any(Array),
      }),
    );
  });

  it("rejects blocked similarity scopes before issuing Azure DevOps requests", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const services = createAzureDevOpsServices(client, {
      azdoProjectAllowlist: ["Allowed Project"],
    });

    await expect(
      services.findSimilarWorkItems({
        project: "Allowed Project",
        workItemId: 101,
        candidateProjects: ["Blocked Project"],
      }),
    ).rejects.toThrow(/Blocked Project/);
    await expect(
      services.clusterWorkItemsBySimilarity({
        project: "Allowed Project",
        projects: ["Blocked Project"],
      }),
    ).rejects.toThrow(/Blocked Project/);
    expect(client.get).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });
});
