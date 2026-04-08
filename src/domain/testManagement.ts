import { DEFAULT_RUN_TOP } from "../constants.js";
import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type {
  ExportedTestPlanFull,
  TestCaseFullSummary,
  TestCasesFullList,
  TestCaseSummary,
  TestManagementPagingSummary,
  TestPlanFull,
  TestPlanSuitesTree,
  TestPlanSummary,
  TestPointHistory,
  TestPointSummary,
  TestPointsList,
  TestRunFull,
  TestRunSummary,
  TestSuiteFull,
  TestSuiteSummary,
  TestSuiteTreeNode,
} from "../models.js";
import {
  asInteger,
  asRecord,
  asString,
  clampTop,
  ensureArray,
  getConfigurationName,
  getDisplayName,
  getWorkItemProperty,
  mapTestAttachment,
  mapTestCaseFull,
  mapTestPlan,
  mapTestPlanFull,
  mapTestPlanSuitesTree,
  mapTestPoint,
  mapTestPointHistory,
  mapTestPointHistoryEntry,
  mapTestPointsList,
  mapTestRun,
  mapTestRunFull,
  mapTestRunResult,
  mapTestSuite,
  mapTestSuiteChildSummary,
  mapTestSuiteFull,
  mapTestSuiteTreeNode,
} from "./shared.js";
import { fetchWorkItemsByIds } from "./workItems.js";

const DEFAULT_COLLECTION_PAGE_SIZE = 100;
const MAX_COLLECTION_PAGE_SIZE = 200;
const TEST_CASE_WORK_ITEM_BULK_BATCH_SIZE = 100;
const TEST_CASE_WORK_ITEM_FIELDS = [
  "System.TeamProject",
  "System.Title",
  "System.State",
  "System.AssignedTo",
  "System.AreaPath",
  "System.IterationPath",
  "Microsoft.VSTS.Common.Priority",
  "Microsoft.VSTS.TCM.AutomationStatus",
  "Microsoft.VSTS.TCM.Steps",
  "Microsoft.VSTS.TCM.Parameters",
  "Microsoft.VSTS.TCM.LocalDataSource",
] as const;

type ProjectScopedConfig = Pick<AppConfig, "azdoProjectAllowlist">;

type PagedCollectionResult = {
  readonly items: unknown[];
  readonly paging: TestManagementPagingSummary;
  readonly totalCount?: number;
};

export interface GetTestPlanInput {
  readonly project: string;
  readonly planId: number;
  readonly includeRaw?: boolean;
}

export interface GetTestPlanSuitesTreeInput {
  readonly project: string;
  readonly planId: number;
  readonly maxDepth?: number;
  readonly includeRaw?: boolean;
}

export interface GetTestSuiteInput {
  readonly project: string;
  readonly planId: number;
  readonly suiteId: number;
  readonly includeRaw?: boolean;
}

export interface ListTestPointsInput {
  readonly project: string;
  readonly planId: number;
  readonly suiteId: number;
  readonly pageSize?: number;
  readonly includeRaw?: boolean;
}

export interface GetTestPointHistoryInput extends ListTestPointsInput {
  readonly pointId: number;
}

export interface GetTestRunFullInput {
  readonly project: string;
  readonly runId: number;
  readonly pageSize?: number;
  readonly includeAttachments?: boolean;
  readonly includeSteps?: boolean;
  readonly includeRaw?: boolean;
}

export interface ExportTestPlanFullInput {
  readonly project: string;
  readonly planId: number;
  readonly includeSuites?: boolean;
  readonly includePoints?: boolean;
  readonly includePointHistory?: boolean;
  readonly includeRuns?: boolean;
  readonly includeTestCases?: boolean;
  readonly includeRaw?: boolean;
  readonly maxDepth?: number;
  readonly suiteIds?: readonly number[];
  readonly pageSize?: number;
}

export interface ListTestCasesFullInput {
  readonly project: string;
  readonly planId: number;
  readonly suiteId: number;
  readonly pageSize?: number;
  readonly includeRaw?: boolean;
}

type SuiteRecordLookup = {
  readonly rawSuites: readonly unknown[];
  readonly suitesById: Map<number, unknown>;
};

function chunkArray<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push([...values.slice(index, index + size)]);
  }

  return chunks;
}

function clampPageSize(value: number | undefined, defaultValue = DEFAULT_COLLECTION_PAGE_SIZE): number {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(1, Math.min(MAX_COLLECTION_PAGE_SIZE, Math.floor(value)));
}

function encodeProject(project: string): string {
  return encodeURIComponent(project);
}

function getResponseCollection(raw: unknown, preferredKeys: readonly string[] = ["value"]): unknown[] {
  const record = asRecord(raw);

  for (const key of preferredKeys) {
    const collection = ensureArray(record[key]);
    if (collection.length > 0 || Array.isArray(record[key])) {
      return collection;
    }
  }

  return [];
}

function getContinuationToken(raw: unknown): string | null {
  const record = asRecord(raw);

  return (
    asString(record.continuationToken) ??
    asString(record.nextContinuationToken) ??
    asString(record.nextToken)
  );
}

function getResponseTotalCount(raw: unknown): number | undefined {
  const record = asRecord(raw);

  return (
    asInteger(record.totalCount) ??
    asInteger(record.count) ??
    asInteger(record.total) ??
    undefined
  );
}

function getRawWorkItemId(raw: unknown): number | null {
  return asInteger(asRecord(raw).id);
}

function sameProject(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function assertExpectedProject(
  entityLabel: string,
  entityId: number,
  actualProject: string | null | undefined,
  expectedProject: string | undefined,
): void {
  if (!expectedProject || sameProject(actualProject, expectedProject)) {
    return;
  }

  throw new Error(
    actualProject
      ? `${entityLabel} ${entityId} belongs to project "${actualProject}" instead of "${expectedProject}".`
      : `${entityLabel} ${entityId} project is not available and cannot be matched to "${expectedProject}".`,
  );
}

function getSuiteProject(raw: unknown): string | null {
  const record = asRecord(raw);
  return (
    (typeof record.project === "string" ? asString(record.project) : null) ??
    asString(asRecord(record.project).name)
  );
}

function getPointProject(raw: unknown): string | null {
  const record = asRecord(raw);
  return (
    asString(record.projectName) ??
    asString(asRecord(record.project).name) ??
    getWorkItemProperty(record.workItemProperties, "System.TeamProject")
  );
}

function normalizePoint(raw: unknown, suiteName: string | null): TestPointSummary {
  const point = mapTestPoint(raw);

  return point.testSuiteTitle || !suiteName
    ? point
    : {
        ...point,
        testSuiteTitle: suiteName,
      };
}

function getPointId(raw: unknown): number | null {
  return asInteger(asRecord(raw).id);
}

function getPointLastRunId(point: TestPointSummary): number | null {
  return point.lastRunId ?? null;
}

function getResultPointId(raw: unknown): number | null {
  const record = asRecord(raw);
  return (
    asInteger(record.pointId) ??
    asInteger(record.testPointId) ??
    asInteger(asRecord(record.testPoint).id)
  );
}

function getDateSortValue(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getWorkItemProject(raw: unknown): string | null {
  return asString(asRecord(asRecord(raw).fields)["System.TeamProject"]);
}

async function fetchAllWithContinuation(
  client: AzureDevOpsClientLike,
  pathFactory: (continuationToken?: string) => string,
  preferredKeys: readonly string[],
  pageSize: number,
): Promise<PagedCollectionResult> {
  const items: unknown[] = [];
  let continuationToken: string | undefined;
  let strategy: TestManagementPagingSummary["strategy"] = "none";
  let pagesFetched = 0;
  let totalCount: number | undefined;

  do {
    const response = await client.get<unknown>(pathFactory(continuationToken));
    const pageItems = getResponseCollection(response, preferredKeys);
    const nextToken = getContinuationToken(response);

    pagesFetched += 1;
    items.push(...pageItems);
    totalCount ??= getResponseTotalCount(response);

    if (nextToken) {
      strategy = "continuation";
      continuationToken = nextToken;
    } else {
      continuationToken = undefined;
    }
  } while (continuationToken);

  return {
    items,
    paging: {
      strategy,
      pageSize,
      pagesFetched,
    },
    totalCount,
  };
}

async function fetchAllBySkip(
  client: AzureDevOpsClientLike,
  pathFactory: (skip: number, pageSize: number) => string,
  preferredKeys: readonly string[],
  pageSize: number,
): Promise<PagedCollectionResult> {
  const items: unknown[] = [];
  let skip = 0;
  let pagesFetched = 0;
  let totalCount: number | undefined;

  while (true) {
    const response = await client.get<unknown>(pathFactory(skip, pageSize));
    const pageItems = getResponseCollection(response, preferredKeys);

    pagesFetched += 1;
    totalCount ??= getResponseTotalCount(response);
    items.push(...pageItems);

    if (pageItems.length === 0) {
      break;
    }

    if (totalCount !== undefined && items.length >= totalCount) {
      break;
    }

    if (pageItems.length < pageSize) {
      break;
    }

    skip += pageItems.length;
  }

  return {
    items,
    paging: {
      strategy: pagesFetched > 1 ? "skip" : "none",
      pageSize,
      pagesFetched,
    },
    totalCount,
  };
}

async function fetchTestPlanRaw(
  client: AzureDevOpsClientLike,
  project: string,
  planId: number,
): Promise<unknown> {
  return client.get<unknown>(
    `/${encodeProject(project)}/_apis/testplan/Plans/${planId}?api-version=7.1`,
  );
}

async function fetchOrderedTestCaseIds(
  client: AzureDevOpsClientLike,
  project: string,
  suiteId: number,
): Promise<number[]> {
  const suiteEntriesResponse = await client.get<{ value?: unknown[] }>(
    `/${encodeProject(project)}/_apis/testplan/suiteentry/${suiteId}?suiteEntryType=TestCase&api-version=7.1`,
  );

  return ensureArray<unknown>(suiteEntriesResponse.value)
    .map((entry) => asInteger(asRecord(entry).id))
    .filter((id): id is number => Number.isInteger(id));
}

async function fetchTestSuitesRaw(
  client: AzureDevOpsClientLike,
  project: string,
  planId: number,
): Promise<PagedCollectionResult> {
  return fetchAllWithContinuation(
    client,
    (continuationToken) => {
      const params = new URLSearchParams({
        "api-version": "7.1",
      });

      if (continuationToken) {
        params.set("continuationToken", continuationToken);
      }

      return `/${encodeProject(project)}/_apis/testplan/Plans/${planId}/suites?${params.toString()}`;
    },
    ["value"],
    DEFAULT_COLLECTION_PAGE_SIZE,
  );
}

async function buildSuiteLookup(
  client: AzureDevOpsClientLike,
  project: string,
  planId: number,
): Promise<SuiteRecordLookup> {
  const { items } = await fetchTestSuitesRaw(client, project, planId);
  const suitesById = new Map<number, unknown>();

  for (const rawSuite of items) {
    const id = asInteger(asRecord(rawSuite).id);
    if (id !== null) {
      suitesById.set(id, rawSuite);
    }
  }

  return {
    rawSuites: items,
    suitesById,
  };
}

function getRawSuiteParentId(rawSuite: unknown): number | null {
  const record = asRecord(rawSuite);
  return asInteger(asRecord(record.parentSuite).id) ?? asInteger(record.parentSuiteId);
}

export function buildTestSuiteTree(
  rawSuites: readonly unknown[],
  planId: number,
  options: {
    readonly rootSuiteId?: number | null;
    readonly maxDepth?: number;
    readonly suiteIds?: readonly number[];
    readonly includeRaw?: boolean;
  } = {},
): TestSuiteTreeNode[] {
  const includeRaw = options.includeRaw === true;
  const suitesById = new Map<number, unknown>();
  const childIdsByParent = new Map<number | null, number[]>();

  for (const rawSuite of rawSuites) {
    const suiteId = asInteger(asRecord(rawSuite).id);
    if (suiteId === null) {
      continue;
    }

    const parentSuiteId = getRawSuiteParentId(rawSuite);
    suitesById.set(suiteId, rawSuite);

    const childIds = childIdsByParent.get(parentSuiteId) ?? [];
    childIds.push(suiteId);
    childIdsByParent.set(parentSuiteId, childIds);
  }

  const selectedRoots =
    options.suiteIds && options.suiteIds.length > 0
      ? options.suiteIds.filter((suiteId) => suitesById.has(suiteId))
      : options.rootSuiteId && suitesById.has(options.rootSuiteId)
        ? [options.rootSuiteId]
        : childIdsByParent.get(null) ?? [];

  const buildNode = (suiteId: number, depth: number): TestSuiteTreeNode => {
    const rawSuite = suitesById.get(suiteId);
    if (!rawSuite) {
      throw new Error(`Missing suite ${suiteId} while building suite tree.`);
    }

    const shouldExpandChildren =
      options.maxDepth === undefined || depth < options.maxDepth;
    const childSuiteIds = shouldExpandChildren
      ? childIdsByParent.get(suiteId) ?? []
      : [];

    const children = childSuiteIds.map((childId) => buildNode(childId, depth + 1));
    return mapTestSuiteTreeNode(rawSuite, planId, children, includeRaw);
  };

  return selectedRoots.map((suiteId) => buildNode(suiteId, 0));
}

function collectSuiteTreeIds(suiteTree: readonly TestSuiteTreeNode[]): number[] {
  const ids: number[] = [];

  const visit = (suite: TestSuiteTreeNode) => {
    ids.push(suite.id);
    for (const child of suite.children) {
      visit(child);
    }
  };

  for (const suite of suiteTree) {
    visit(suite);
  }

  return ids;
}

function buildSuiteChildrenLookup(
  rawSuites: readonly unknown[],
): Map<number | null, TestSuiteSummary[]> {
  const lookup = new Map<number | null, TestSuiteSummary[]>();

  for (const rawSuite of rawSuites) {
    const summary = mapTestSuite(rawSuite);
    const childList = lookup.get(summary.parentSuiteId) ?? [];
    childList.push(summary);
    lookup.set(summary.parentSuiteId, childList);
  }

  return lookup;
}

async function fetchTestSuiteDetailRaw(
  client: AzureDevOpsClientLike,
  project: string,
  planId: number,
  suiteId: number,
): Promise<unknown> {
  return client.get<unknown>(
    `/${encodeProject(project)}/_apis/testplan/Plans/${planId}/Suites/${suiteId}?api-version=7.1`,
  );
}

async function fetchTestPointsRaw(
  client: AzureDevOpsClientLike,
  project: string,
  planId: number,
  suiteId: number,
  pageSize: number,
): Promise<PagedCollectionResult> {
  return fetchAllBySkip(
    client,
    (skip, top) =>
      `/${encodeProject(project)}/_apis/test/Plans/${planId}/Suites/${suiteId}/points?witFields=System.Title&api-version=7.1&$top=${top}&$skip=${skip}`,
    ["value"],
    pageSize,
  );
}

async function fetchPlanRunsRaw(
  client: AzureDevOpsClientLike,
  project: string,
  planId: number,
  pageSize: number,
): Promise<PagedCollectionResult> {
  return fetchAllBySkip(
    client,
    (skip, top) =>
      `/${encodeProject(project)}/_apis/test/runs?planIds=${planId}&$top=${top}&$skip=${skip}&api-version=7.1`,
    ["value"],
    pageSize,
  );
}

async function fetchRunResultsRaw(
  client: AzureDevOpsClientLike,
  project: string,
  runId: number,
  pageSize: number,
  includeSteps: boolean,
): Promise<PagedCollectionResult> {
  const detailsToInclude = includeSteps ? "Iterations,WorkItems" : "WorkItems";

  return fetchAllBySkip(
    client,
    (skip, top) =>
      `/${encodeProject(project)}/_apis/test/Runs/${runId}/results?$top=${top}&$skip=${skip}&detailsToInclude=${encodeURIComponent(detailsToInclude)}&api-version=7.1`,
    ["value", "results"],
    pageSize,
  );
}

async function fetchRunAttachmentsRaw(
  client: AzureDevOpsClientLike,
  project: string,
  runId: number,
): Promise<unknown[]> {
  const response = await client.get<unknown>(
    `/${encodeProject(project)}/_apis/test/Runs/${runId}/attachments?api-version=7.1`,
  );

  return getResponseCollection(response, ["value", "attachments"]);
}

async function fetchRawTestCaseWorkItemsByIds(
  client: AzureDevOpsClientLike,
  ids: readonly number[],
): Promise<unknown[]> {
  if (ids.length === 0) {
    return [];
  }

  const encodedFields = TEST_CASE_WORK_ITEM_FIELDS.map(encodeURIComponent).join(",");
  const rawWorkItems: unknown[] = [];

  for (const batchIds of chunkArray(ids, TEST_CASE_WORK_ITEM_BULK_BATCH_SIZE)) {
    const response = await client.get<{ value?: unknown[] }>(
      `/_apis/wit/workitems?ids=${batchIds.join(",")}&fields=${encodedFields}&api-version=7.1`,
    );

    const workItemsById = new Map(
      ensureArray(response.value)
        .map((item) => [getRawWorkItemId(item), item] as const)
        .filter((entry): entry is readonly [number, unknown] => entry[0] !== null),
    );

    rawWorkItems.push(
      ...batchIds
        .map((id) => workItemsById.get(id))
        .filter((item): item is unknown => item !== undefined),
    );
  }

  const workItemsById = new Map(
    rawWorkItems
      .map((item) => [getRawWorkItemId(item), item] as const)
      .filter((entry): entry is readonly [number, unknown] => entry[0] !== null),
  );

  return ids
    .map((id) => workItemsById.get(id))
    .filter((item): item is unknown => item !== undefined);
}

function mergePagingSummaries(
  summaries: readonly TestManagementPagingSummary[],
  pageSize: number,
): TestManagementPagingSummary {
  if (summaries.length === 0) {
    return {
      strategy: "none",
      pageSize,
      pagesFetched: 0,
    };
  }

  return {
    strategy: summaries.some((summary) => summary.strategy === "continuation")
      ? "continuation"
      : summaries.some((summary) => summary.strategy === "skip")
        ? "skip"
        : "none",
    pageSize,
    pagesFetched: summaries.reduce((total, summary) => total + summary.pagesFetched, 0),
  };
}

export async function listTestPlans(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  project: string,
): Promise<TestPlanSummary[]> {
  assertProjectAllowed(project, config);

  const response = await client.get<{ value?: unknown[] }>(
    `/${encodeProject(project)}/_apis/testplan/plans?api-version=7.1`,
  );

  return ensureArray(response.value).map(mapTestPlan);
}

export async function getTestPlan(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: GetTestPlanInput,
): Promise<TestPlanFull> {
  assertProjectAllowed(input.project, config);

  const rawPlan = await fetchTestPlanRaw(client, input.project, input.planId);
  return mapTestPlanFull(rawPlan, input.includeRaw === true);
}

export async function listTestSuites(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  project: string,
  planId: number,
): Promise<TestSuiteSummary[]> {
  assertProjectAllowed(project, config);

  const { items } = await fetchTestSuitesRaw(client, project, planId);
  return items.map(mapTestSuite);
}

export async function getTestPlanSuitesTree(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: GetTestPlanSuitesTreeInput,
): Promise<TestPlanSuitesTree> {
  assertProjectAllowed(input.project, config);

  const [rawPlan, suiteLookup] = await Promise.all([
    fetchTestPlanRaw(client, input.project, input.planId),
    buildSuiteLookup(client, input.project, input.planId),
  ]);

  const plan = mapTestPlanFull(rawPlan, false);
  const suiteTree = buildTestSuiteTree(suiteLookup.rawSuites, input.planId, {
    rootSuiteId: plan.rootSuiteId,
    maxDepth: input.maxDepth,
    includeRaw: input.includeRaw,
  });

  return mapTestPlanSuitesTree(input.project, input.planId, plan.rootSuiteId, suiteTree);
}

export async function getTestSuite(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: GetTestSuiteInput,
): Promise<TestSuiteFull> {
  assertProjectAllowed(input.project, config);

  const [rawPlan, suiteLookup, rawSuite] = await Promise.all([
    fetchTestPlanRaw(client, input.project, input.planId),
    buildSuiteLookup(client, input.project, input.planId),
    fetchTestSuiteDetailRaw(client, input.project, input.planId, input.suiteId),
  ]);

  const plan = mapTestPlanFull(rawPlan, false);
  const suiteSummary = mapTestSuite(rawSuite);
  const childrenLookup = buildSuiteChildrenLookup(suiteLookup.rawSuites);
  const parentRaw =
    suiteSummary.parentSuiteId !== null
      ? suiteLookup.suitesById.get(suiteSummary.parentSuiteId) ?? null
      : null;

  const projectName = getSuiteProject(rawSuite);
  if (projectName) {
    assertExpectedProject("Test suite", input.suiteId, projectName, input.project);
  }

  return mapTestSuiteFull(rawSuite, {
    planId: input.planId,
    planName: plan.name,
    parent: parentRaw ? mapTestSuiteChildSummary(parentRaw) : null,
    children: (childrenLookup.get(input.suiteId) ?? []).map((suite) => ({
      id: suite.id,
      name: suite.name,
      suiteType: suite.suiteType,
      testCaseCount: suite.testCaseCount,
      url: asString(asRecord(suiteLookup.suitesById.get(suite.id)).url),
    })),
    includeRaw: input.includeRaw,
  });
}

function mapPointAssignment(raw: unknown): { tester: string | null; configuration: string | null } {
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
  assignments: readonly { tester: string | null; configuration: string | null }[],
): { tester: string | null; configuration: string | null }[] {
  const result: { tester: string | null; configuration: string | null }[] = [];
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

export async function listTestCases(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  project: string,
  planId: number,
  suiteId: number,
): Promise<TestCaseSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeProject(project);
  const orderedCaseIds = await fetchOrderedTestCaseIds(client, project, suiteId);

  if (orderedCaseIds.length === 0) {
    return [];
  }

  const pointsResponse = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/test/Plans/${planId}/Suites/${suiteId}/points?witFields=System.Title&api-version=7.1`,
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

export async function listTestCasesFull(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ListTestCasesFullInput,
): Promise<TestCasesFullList> {
  assertProjectAllowed(input.project, config);

  const orderedCaseIds = await fetchOrderedTestCaseIds(client, input.project, input.suiteId);
  if (orderedCaseIds.length === 0) {
    return {
      project: input.project,
      planId: input.planId,
      suiteId: input.suiteId,
      totalCount: 0,
      testCases: [],
    };
  }

  const uniqueCaseIds = Array.from(new Set(orderedCaseIds));
  const pointsList = await listTestPoints(client, config, {
    project: input.project,
    planId: input.planId,
    suiteId: input.suiteId,
    pageSize: input.pageSize,
    includeRaw: input.includeRaw,
  });
  const pointsByCaseId = new Map<number, TestPointSummary[]>();

  for (const point of pointsList.points) {
    if (point.testCaseId === null) {
      continue;
    }

    const points = pointsByCaseId.get(point.testCaseId) ?? [];
    points.push(point);
    pointsByCaseId.set(point.testCaseId, points);
  }

  const rawTestCases = await fetchRawTestCaseWorkItemsByIds(client, uniqueCaseIds);
  const rawTestCasesById = new Map(
    rawTestCases
      .map((rawTestCase) => [getRawWorkItemId(rawTestCase), rawTestCase] as const)
      .filter((entry): entry is readonly [number, unknown] => entry[0] !== null),
  );

  for (const [caseId, rawTestCase] of rawTestCasesById) {
    assertExpectedProject("Test case", caseId, getWorkItemProject(rawTestCase), input.project);
  }

  const sharedStepIds = [
    ...new Set(
      rawTestCases.flatMap((rawTestCase) =>
        mapTestCaseFull(rawTestCase, {
          points: [],
        }).sharedSteps.map((sharedStep) => sharedStep.workItemId),
      ),
    ),
  ];
  const sharedStepWorkItems = await fetchWorkItemsByIds(client, sharedStepIds);
  const sharedStepsById = new Map(
    sharedStepWorkItems.map((sharedStep) => [
      sharedStep.id,
      {
        workItemId: sharedStep.id,
        title: sharedStep.title,
        url: sharedStep.url,
      },
    ] as const),
  );

  const testCases = uniqueCaseIds
    .map((caseId) => {
      const rawTestCase = rawTestCasesById.get(caseId);
      if (!rawTestCase) {
        return null;
      }

      const points = [...(pointsByCaseId.get(caseId) ?? [])].sort(
        (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER),
      );

      return mapTestCaseFull(rawTestCase, {
        points,
        sharedStepsById,
        includeRaw: input.includeRaw,
      });
    })
    .filter((testCase): testCase is TestCaseFullSummary => testCase !== null);

  return {
    project: input.project,
    planId: input.planId,
    suiteId: input.suiteId,
    totalCount: testCases.length,
    testCases,
  };
}

export async function listTestPoints(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ListTestPointsInput,
): Promise<TestPointsList> {
  assertProjectAllowed(input.project, config);

  const pageSize = clampPageSize(input.pageSize);
  const [suite, pointsResponse] = await Promise.all([
    fetchTestSuiteDetailRaw(client, input.project, input.planId, input.suiteId).catch(() => null),
    fetchTestPointsRaw(client, input.project, input.planId, input.suiteId, pageSize),
  ]);

  const suiteName = suite ? mapTestSuite(suite).name : null;
  const points = pointsResponse.items.map((rawPoint) => {
    const projectName = getPointProject(rawPoint);
    if (projectName) {
      assertExpectedProject("Test point", getPointId(rawPoint) ?? 0, projectName, input.project);
    }

    const normalized = normalizePoint(rawPoint, suiteName);
    return input.includeRaw ? { ...normalized, raw: rawPoint } : normalized;
  });

  return mapTestPointsList(
    input.project,
    input.planId,
    input.suiteId,
    pointsResponse.paging,
    points,
    pointsResponse.totalCount,
  );
}

export async function getTestPointHistory(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: GetTestPointHistoryInput,
): Promise<TestPointHistory> {
  assertProjectAllowed(input.project, config);

  const pageSize = clampPageSize(input.pageSize);
  const pointsList = await listTestPoints(client, config, input);
  const point = pointsList.points.find((candidate) => candidate.pointId === input.pointId) ?? null;
  const planRuns = await fetchPlanRunsRaw(client, input.project, input.planId, pageSize);
  const historyEntries = [];
  const pagingSummaries = [pointsList.paging, planRuns.paging];

  for (const rawRun of planRuns.items) {
    const runId = asInteger(asRecord(rawRun).id);
    if (runId === null) {
      continue;
    }

    const runResults = await fetchRunResultsRaw(client, input.project, runId, pageSize, false);
    pagingSummaries.push(runResults.paging);

    for (const rawResult of runResults.items) {
      if (getResultPointId(rawResult) !== input.pointId) {
        continue;
      }

      historyEntries.push(mapTestPointHistoryEntry(rawResult, input.includeRaw === true));
    }
  }

  historyEntries.sort((left, right) => {
    const dateDelta =
      getDateSortValue(right.timeCompleted) - getDateSortValue(left.timeCompleted);
    if (dateDelta !== 0) {
      return dateDelta;
    }

    return (right.testRunId ?? 0) - (left.testRunId ?? 0);
  });

  return mapTestPointHistory(
    input.project,
    input.planId,
    input.suiteId,
    input.pointId,
    point,
    historyEntries,
    mergePagingSummaries(pagingSummaries, pageSize),
  );
}

export async function listTestRuns(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  project: string,
  top?: number,
): Promise<TestRunSummary[]> {
  assertProjectAllowed(project, config);

  const normalizedTop = clampTop(top, DEFAULT_RUN_TOP);
  const response = await client.get<{ value?: unknown[] }>(
    `/${encodeProject(project)}/_apis/test/runs?$top=${normalizedTop}&api-version=7.1`,
  );

  return ensureArray(response.value).map(mapTestRun);
}

export async function getTestRunFull(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: GetTestRunFullInput,
): Promise<TestRunFull> {
  assertProjectAllowed(input.project, config);

  const pageSize = clampPageSize(input.pageSize);
  const includeSteps = input.includeSteps !== false;
  const includeAttachments = input.includeAttachments !== false;

  const [rawRun, rawResults, rawAttachments] = await Promise.all([
    client.get<unknown>(
      `/${encodeProject(input.project)}/_apis/test/runs/${input.runId}?api-version=7.1`,
    ),
    fetchRunResultsRaw(client, input.project, input.runId, pageSize, includeSteps),
    includeAttachments
      ? fetchRunAttachmentsRaw(client, input.project, input.runId)
      : Promise.resolve([] as unknown[]),
  ]);

  const results = rawResults.items.map((rawResult) =>
    mapTestRunResult(rawResult, input.includeRaw === true),
  );
  const attachments = rawAttachments.map((attachment) =>
    mapTestAttachment(attachment, input.includeRaw === true),
  );

  return mapTestRunFull(rawRun, {
    results,
    attachments,
    paging: rawResults.paging,
    includeRaw: input.includeRaw,
  });
}

function asRecordMap<T>(entries: readonly (readonly [string, T])[]): Record<string, T> {
  return Object.fromEntries(entries) as Record<string, T>;
}

export async function exportTestPlanFull(
  client: AzureDevOpsClientLike,
  config: ProjectScopedConfig,
  input: ExportTestPlanFullInput,
): Promise<ExportedTestPlanFull> {
  assertProjectAllowed(input.project, config);

  const includeSuites = input.includeSuites !== false;
  const includePoints = input.includePoints !== false || input.includePointHistory === true;
  const includeRuns = input.includeRuns === true;
  const includeTestCases = input.includeTestCases === true;
  const includePointHistory = input.includePointHistory === true;
  const includeRaw = input.includeRaw === true;
  const pageSize = clampPageSize(input.pageSize);

  const [plan, suiteLookup] = await Promise.all([
    getTestPlan(client, config, {
      project: input.project,
      planId: input.planId,
      includeRaw,
    }),
    buildSuiteLookup(client, input.project, input.planId),
  ]);

  const suiteTree = includeSuites
    ? buildTestSuiteTree(suiteLookup.rawSuites, input.planId, {
        rootSuiteId: plan.rootSuiteId,
        maxDepth: input.maxDepth,
        suiteIds: input.suiteIds,
        includeRaw,
      })
    : [];
  const selectedSuiteIds =
    includeSuites && suiteTree.length > 0
      ? collectSuiteTreeIds(suiteTree)
      : input.suiteIds?.length
        ? input.suiteIds.filter((suiteId) => suiteLookup.suitesById.has(suiteId))
        : plan.rootSuiteId !== null
          ? collectSuiteTreeIds(
              buildTestSuiteTree(suiteLookup.rawSuites, input.planId, {
                rootSuiteId: plan.rootSuiteId,
                maxDepth: input.maxDepth,
              }),
            )
          : [];

  const childrenLookup = buildSuiteChildrenLookup(suiteLookup.rawSuites);
  const suiteEntries = selectedSuiteIds.map((suiteId) => {
    const rawSuite = suiteLookup.suitesById.get(suiteId);
    if (!rawSuite) {
      throw new Error(`Test suite ${suiteId} was not found in plan ${input.planId}.`);
    }

    const summary = mapTestSuite(rawSuite);
    const parentRaw =
      summary.parentSuiteId !== null
        ? suiteLookup.suitesById.get(summary.parentSuiteId) ?? null
        : null;

    return [
      String(suiteId),
      mapTestSuiteFull(rawSuite, {
        planId: input.planId,
        planName: plan.name,
        parent: parentRaw ? mapTestSuiteChildSummary(parentRaw) : null,
        children: (childrenLookup.get(suiteId) ?? []).map((child) => ({
          id: child.id,
          name: child.name,
          suiteType: child.suiteType,
          testCaseCount: child.testCaseCount,
          url: asString(asRecord(suiteLookup.suitesById.get(child.id)).url),
        })),
        includeRaw,
      }),
    ] as const;
  });

  const pointsBySuiteEntries: Array<readonly [string, readonly TestPointSummary[]]> = [];
  const pointHistoryEntries: Array<readonly [string, TestPointHistory]> = [];
  const testCaseEntries: Array<readonly [string, TestCaseSummary]> = [];
  const runIds = new Set<number>();

  if (includePoints || includePointHistory || includeRuns || includeTestCases) {
    for (const suiteId of selectedSuiteIds) {
      let suitePoints: readonly TestPointSummary[] = [];

      if (includePoints || includePointHistory || includeRuns) {
        const points = await listTestPoints(client, config, {
          project: input.project,
          planId: input.planId,
          suiteId,
          pageSize,
          includeRaw,
        });
        suitePoints = points.points;
        pointsBySuiteEntries.push([String(suiteId), suitePoints]);

        for (const point of suitePoints) {
          const lastRunId = getPointLastRunId(point);
          if (lastRunId !== null) {
            runIds.add(lastRunId);
          }
        }

        if (includePointHistory) {
          for (const point of suitePoints) {
            const history = await getTestPointHistory(client, config, {
              project: input.project,
              planId: input.planId,
              suiteId,
              pointId: point.pointId,
              pageSize,
              includeRaw,
            });

            pointHistoryEntries.push([String(point.pointId), history]);
            for (const historyEntry of history.history) {
              if (historyEntry.testRunId !== null) {
                runIds.add(historyEntry.testRunId);
              }
            }
          }
        }
      }

      if (includeTestCases) {
        const testCases = await listTestCases(client, config, input.project, input.planId, suiteId);
        for (const testCase of testCases) {
          testCaseEntries.push([String(testCase.workItemId), testCase]);
        }
      }
    }
  }

  const runsByIdEntries: Array<readonly [string, TestRunFull]> = [];
  if (includeRuns) {
    for (const runId of [...runIds].sort((left, right) => left - right)) {
      const run = await getTestRunFull(client, config, {
        project: input.project,
        runId,
        pageSize,
        includeRaw,
      });
      runsByIdEntries.push([String(runId), run]);
    }
  }

  return {
    project: input.project,
    planId: input.planId,
    plan,
    suiteTree,
    suitesById: includeSuites ? asRecordMap(suiteEntries) : {},
    pointsBySuiteId:
      includePoints || includePointHistory || includeRuns ? asRecordMap(pointsBySuiteEntries) : {},
    pointHistoryByPointId: includePointHistory ? asRecordMap(pointHistoryEntries) : undefined,
    runsById: includeRuns ? asRecordMap(runsByIdEntries) : undefined,
    testCasesById: includeTestCases ? asRecordMap(testCaseEntries) : undefined,
  };
}
