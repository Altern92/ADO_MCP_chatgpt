import { DEFAULT_RUN_TOP } from "../constants.js";
import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type {
  TestCaseSummary,
  TestPlanSummary,
  TestPointAssignmentSummary,
  TestRunSummary,
  TestSuiteSummary,
} from "../models.js";
import {
  asInteger,
  asRecord,
  clampTop,
  ensureArray,
  getConfigurationName,
  getDisplayName,
  getWorkItemProperty,
  mapTestPlan,
  mapTestRun,
  mapTestSuite,
} from "./shared.js";
import { fetchWorkItemsByIds } from "./workItems.js";

function mapPointAssignment(raw: unknown): TestPointAssignmentSummary {
  const record = asRecord(raw);

  return {
    tester: getDisplayName(record.assignedTo),
    configuration: getConfigurationName(record.configuration),
  };
}

function getPointTestCaseId(raw: unknown): number | null {
  return asInteger(asRecord(asRecord(raw).testCase).id);
}

function getPointTestCaseTitle(raw: unknown): string | null {
  const record = asRecord(raw);
  const testCase = asRecord(record.testCase);

  return (
    (typeof testCase.name === "string" ? testCase.name : null) ??
    getWorkItemProperty(record.workItemProperties, "System.Title")
  );
}

function dedupeAssignments(
  assignments: readonly TestPointAssignmentSummary[],
): TestPointAssignmentSummary[] {
  const result: TestPointAssignmentSummary[] = [];
  const seen = new Set<string>();

  for (const assignment of assignments) {
    if (!assignment.tester && !assignment.configuration) {
      continue;
    }

    const key = `${assignment.tester ?? ""}\u0000${assignment.configuration ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(assignment);
  }

  return result;
}

export async function listTestPlans(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
): Promise<TestPlanSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/testplan/plans?api-version=7.1`,
  );

  return ensureArray(response.value).map(mapTestPlan);
}

export async function listTestSuites(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  planId: number,
): Promise<TestSuiteSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/testplan/Plans/${planId}/suites?api-version=7.1`,
  );

  return ensureArray(response.value).map(mapTestSuite);
}

export async function listTestCases(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  planId: number,
  suiteId: number,
): Promise<TestCaseSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const suiteEntriesResponse = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/testplan/suiteentry/${suiteId}?suiteEntryType=TestCase&api-version=7.1`,
  );

  const orderedCaseIds = ensureArray<unknown>(suiteEntriesResponse.value)
    .map((entry) => asInteger(asRecord(entry).id))
    .filter((id): id is number => Number.isInteger(id));

  if (orderedCaseIds.length === 0) {
    return [];
  }

  const pointParams = new URLSearchParams({
    witFields: "System.Title",
    "api-version": "7.1",
  });
  const pointsResponse = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/test/Plans/${planId}/Suites/${suiteId}/points?${pointParams.toString()}`,
  );

  const pointsByCaseId = new Map<number, unknown[]>();
  const titleByCaseId = new Map<number, string>();

  for (const point of ensureArray<unknown>(pointsResponse.value)) {
    const caseId = getPointTestCaseId(point);
    if (caseId === null) {
      continue;
    }

    const existingPoints = pointsByCaseId.get(caseId);
    if (existingPoints) {
      existingPoints.push(point);
    } else {
      pointsByCaseId.set(caseId, [point]);
    }

    if (!titleByCaseId.has(caseId)) {
      const title = getPointTestCaseTitle(point);
      if (title) {
        titleByCaseId.set(caseId, title);
      }
    }
  }

  const missingTitleIds = orderedCaseIds.filter((caseId) => !titleByCaseId.has(caseId));
  if (missingTitleIds.length > 0) {
    const workItems = await fetchWorkItemsByIds(client, missingTitleIds);
    for (const workItem of workItems) {
      if (workItem.title) {
        titleByCaseId.set(workItem.id, workItem.title);
      }
    }
  }

  const uniqueCaseIds = Array.from(new Set(orderedCaseIds));
  return uniqueCaseIds.map((caseId) => ({
    workItemId: caseId,
    workItemName: titleByCaseId.get(caseId) ?? null,
    pointAssignments: dedupeAssignments(
      (pointsByCaseId.get(caseId) ?? []).map(mapPointAssignment),
    ),
  }));
}

export async function listTestRuns(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  top?: number,
): Promise<TestRunSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const normalizedTop = clampTop(top, DEFAULT_RUN_TOP);
  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/test/runs?$top=${normalizedTop}&api-version=7.1`,
  );

  return ensureArray(response.value).map(mapTestRun);
}
