import { describe, expect, it } from "vitest";
import {
  buildAreaPathCatalog,
  buildIterationPathCatalog,
  rankResolvedIdentities,
} from "../src/domain/discovery.js";

describe("discovery helpers", () => {
  it("can build area path catalogs in both tree and flat modes", () => {
    const rawTree = {
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
    };

    const tree = buildAreaPathCatalog(rawTree, {
      project: "Allowed Project",
      mode: "tree",
      depth: 2,
      includeRaw: true,
    });
    const flat = buildAreaPathCatalog(rawTree, {
      project: "Allowed Project",
      mode: "flat",
      depth: 2,
    });

    expect(tree.total).toBe(3);
    expect(tree.paths[0]?.children[0]?.children[0]?.path).toBe("Allowed Project\\Platform\\API");
    expect(tree.paths[0]?.raw).toEqual(rawTree);
    expect(flat.paths.map((path) => path.path)).toEqual([
      "Allowed Project",
      "Allowed Project\\Platform",
      "Allowed Project\\Platform\\API",
    ]);
    expect(flat.paths.every((path) => path.children.length === 0)).toBe(true);
  });

  it("can build iteration path catalogs with date metadata and depth pruning", () => {
    const rawTree = {
      id: 11,
      name: "Allowed Project",
      path: "Allowed Project",
      children: [
        {
          id: 12,
          name: "Sprint 1",
          attributes: {
            startDate: "2026-04-01T00:00:00Z",
            finishDate: "2026-04-14T00:00:00Z",
          },
          children: [{ id: 13, name: "Sprint 1.1" }],
        },
      ],
    };

    const catalog = buildIterationPathCatalog(rawTree, {
      project: "Allowed Project",
      mode: "tree",
      depth: 1,
    });

    expect(catalog.total).toBe(2);
    expect(catalog.paths[0]?.children[0]?.name).toBe("Sprint 1");
    expect(catalog.paths[0]?.children[0]?.startDate).toBe("2026-04-01T00:00:00Z");
    expect(catalog.paths[0]?.children[0]?.children).toEqual([]);
  });

  it("ranks identity matches with exact and starts-with matches ahead of loose contains matches", () => {
    const ranked = rankResolvedIdentities("alice", [
      {
        displayName: "Bob Alice",
        uniqueName: "bob@example.com",
        descriptor: "descriptor-bob",
        id: "2",
        url: null,
      },
      {
        displayName: "Alice Johnson",
        uniqueName: "alice.johnson@example.com",
        descriptor: "descriptor-alice",
        id: "1",
        url: null,
      },
      {
        displayName: "Mallory",
        uniqueName: "mallory@example.com",
        descriptor: "descriptor-mallory",
        id: "3",
        url: null,
      },
    ]);

    expect(ranked.map((identity) => identity.id)).toEqual(["1", "2"]);
  });
});
