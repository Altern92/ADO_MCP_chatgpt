import { describe, expect, it } from "vitest";
import {
  parseCommitArtifactReference,
  parsePullRequestArtifactReference,
} from "../src/domain/codeIntelligence.js";
import { mapGitCommitStats, mapPullRequestDiffFile } from "../src/domain/shared.js";

describe("code intelligence helpers", () => {
  it("parses pull request artifact links and falls back to the caller project for guid-scoped links", () => {
    const reference = parsePullRequestArtifactReference(
      {
        rel: "ArtifactLink",
        url: "vstfs:///Git/PullRequestId/7f1f1f1f-1111-2222-3333-444444444444%2Frepo-1%2F55",
        attributes: {
          name: "Pull Request",
        },
      },
      "Allowed Project",
    );

    expect(reference).toEqual({
      project: "Allowed Project",
      repository: "repo-1",
      pullRequestId: 55,
    });
  });

  it("parses direct pull request api urls", () => {
    const reference = parsePullRequestArtifactReference(
      {
        rel: "ArtifactLink",
        url: "https://dev.azure.com/example/Allowed%20Project/_apis/git/repositories/repo-1/pullRequests/55",
        attributes: {},
      },
      "Fallback Project",
    );

    expect(reference).toEqual({
      project: "Allowed Project",
      repository: "repo-1",
      pullRequestId: 55,
    });
  });

  it("parses commit artifact links with fallback project resolution", () => {
    const reference = parseCommitArtifactReference(
      {
        rel: "ArtifactLink",
        url: "vstfs:///Git/Commit/7f1f1f1f-1111-2222-3333-444444444444%2Frepo-1%2Fabc123",
        attributes: {
          name: "Fixed in Commit",
        },
      },
      "Allowed Project",
    );

    expect(reference).toEqual({
      project: "Allowed Project",
      repository: "repo-1",
      commitId: "abc123",
    });
  });

  it("maps pull request diff files with caller-controlled patch payload", () => {
    const baseRaw = {
      changeType: "edit",
      item: {
        path: "/src/app.ts",
        gitObjectType: "blob",
        objectId: "abc123",
      },
      originalPath: "/src/old-app.ts",
      additions: 10,
      deletions: 4,
      patch: "@@ -1,2 +1,2 @@",
    };

    const withoutPatch = mapPullRequestDiffFile(baseRaw);
    const withPatch = mapPullRequestDiffFile(baseRaw, {
      includePatch: true,
      includeRaw: true,
    });

    expect(withoutPatch.patch).toBeUndefined();
    expect(withPatch.patch).toBe("@@ -1,2 +1,2 @@");
    expect(withPatch.path).toBe("/src/app.ts");
    expect(withPatch.raw).toEqual(baseRaw);
  });

  it("calculates aggregate commit stats only when additions and deletions are known", () => {
    const stats = mapGitCommitStats([
      {
        path: "/src/app.ts",
        originalPath: null,
        changeType: "edit",
        itemType: "blob",
        objectId: "1",
        additions: 4,
        deletions: 2,
      },
      {
        path: "/src/util.ts",
        originalPath: null,
        changeType: "add",
        itemType: "blob",
        objectId: "2",
        additions: null,
        deletions: null,
      },
    ]);

    expect(stats).toEqual({
      changedFiles: 2,
      additions: null,
      deletions: null,
    });
  });
});
