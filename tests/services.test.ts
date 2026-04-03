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
});
