import { describe, expect, it } from "vitest";
import { buildTestSuiteTree } from "../src/domain/testManagement.js";
import {
  parseTestCaseParameters,
  parseTestCaseStepsField,
} from "../src/domain/shared.js";

describe("test management helpers", () => {
  it("builds a recursive suite tree and respects maxDepth", () => {
    const suiteTree = buildTestSuiteTree(
      [
        { id: 1, name: "Root", suiteType: "StaticTestSuite" },
        { id: 2, name: "Child", suiteType: "RequirementTestSuite", parentSuite: { id: 1 } },
        { id: 3, name: "Grandchild", suiteType: "StaticTestSuite", parentSuite: { id: 2 } },
      ],
      12,
      {
        rootSuiteId: 1,
        maxDepth: 1,
      },
    );

    expect(suiteTree).toHaveLength(1);
    expect(suiteTree[0]?.id).toBe(1);
    expect(suiteTree[0]?.children.map((child) => child.id)).toEqual([2]);
    expect(suiteTree[0]?.children[0]?.children).toEqual([]);
  });

  it("can export a subtree rooted at selected suite IDs and carry raw payloads", () => {
    const suiteTree = buildTestSuiteTree(
      [
        { id: 1, name: "Root", suiteType: "StaticTestSuite" },
        { id: 2, name: "Selected", suiteType: "RequirementTestSuite", parentSuite: { id: 1 } },
        { id: 3, name: "Nested", suiteType: "StaticTestSuite", parentSuite: { id: 2 } },
      ],
      44,
      {
        suiteIds: [2],
        includeRaw: true,
      },
    );

    expect(suiteTree).toHaveLength(1);
    expect(suiteTree[0]?.id).toBe(2);
    expect(suiteTree[0]?.children.map((child) => child.id)).toEqual([3]);
    expect(suiteTree[0]?.raw).toEqual(
      expect.objectContaining({
        id: 2,
        name: "Selected",
      }),
    );
  });

  it("parses test case steps, shared step references, and parameter data", () => {
    const steps = parseTestCaseStepsField(
      '<steps id="0" last="3"><step id="2" type="ActionStep"><parameterizedString isformatted="true">Open login page</parameterizedString><parameterizedString isformatted="true">Login page is shown</parameterizedString></step><compref id="3" ref="401" /></steps>',
      new Map([
        [
          401,
          {
            workItemId: 401,
            title: "Shared login preconditions",
            url: "https://example/shared/401",
          },
        ],
      ]),
    );
    const parameters = parseTestCaseParameters(
      '<parameters><param name="@browser" bind="default" /><param name="@user" /></parameters>',
      "<NewDataSet><Table1><browser>Chrome</browser><user>alice</user></Table1></NewDataSet>",
    );

    expect(steps).toEqual([
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
    expect(parameters).toEqual({
      definitions: [
        {
          name: "@browser",
          bind: "default",
        },
        {
          name: "@user",
          bind: null,
        },
      ],
      rows: [
        {
          browser: "Chrome",
          user: "alice",
        },
      ],
    });
  });
});
