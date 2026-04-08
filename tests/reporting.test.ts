import { describe, expect, it } from "vitest";
import {
  buildSavedQueriesCatalog,
  extractSavedQueryWorkItemIds,
  resolveSavedQueryFromCatalog,
} from "../src/domain/reporting.js";

describe("reporting helpers", () => {
  it("builds saved query catalogs in tree and flat modes", () => {
    const rawHierarchy = {
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
    };

    const tree = buildSavedQueriesCatalog(rawHierarchy, {
      project: "Allowed Project",
      mode: "tree",
      includeWiql: true,
      includeRaw: true,
    });
    const flat = buildSavedQueriesCatalog(rawHierarchy, {
      project: "Allowed Project",
      mode: "flat",
      includeWiql: true,
    });

    expect(tree.total).toBe(2);
    expect(tree.queries[0]?.children[0]?.wiql).toContain("Select");
    expect(tree.queries[0]?.raw).toEqual(rawHierarchy.value[0]);
    expect(flat.queries.map((query) => query.path)).toEqual([
      "Shared Queries",
      "Shared Queries/Active Bugs",
    ]);
    expect(flat.queries.every((query) => query.children.length === 0)).toBe(true);
  });

  it("resolves saved queries by path and extracts ids from relation results when needed", () => {
    const catalog = buildSavedQueriesCatalog(
      {
        value: [
          {
            id: "query-1",
            name: "Tree Query",
            path: "Shared Queries/Tree Query",
            isFolder: false,
            queryType: "tree",
          },
        ],
      },
      {
        project: "Allowed Project",
        mode: "flat",
      },
    );

    const resolved = resolveSavedQueryFromCatalog(catalog, " shared queries/tree query ");
    const ids = extractSavedQueryWorkItemIds({
      workItemRelations: [
        { source: { id: 101 }, target: { id: 202 } },
        { source: { id: 101 }, target: { id: 303 } },
      ],
    });

    expect(resolved?.id).toBe("query-1");
    expect(ids).toEqual([101, 202, 303]);
  });
});
