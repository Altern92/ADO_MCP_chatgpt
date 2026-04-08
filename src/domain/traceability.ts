import { assertProjectAllowed, isProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import { AzureDevOpsApiError } from "../errors.js";
import type {
  LinkedWorkItemsSummary,
  LinkedWorkItemSummary,
  RequirementTraceabilityGaps,
  RequirementTraceabilityReport,
  RequirementTraceabilityStatus,
  TestCoverageOutcome,
  TestRunFull,
  WorkItemSummary,
  WorkItemTestLinkPlanSummary,
  WorkItemTestLinkRecentRunSummary,
  WorkItemTestLinkSuiteSummary,
  WorkItemTestLinkSummary,
  WorkItemTestLinksSummary,
  UserStoryLinkedTestCaseCoverage,
  UserStoryPlanCoverageSummary,
  UserStoryRecentRunCoverageSummary,
  UserStorySuiteCoverageSummary,
  UserStoryTestCoverage,
  UserStoryTestCoverageStatus,
  UserStoryTestCoverageSummary,
  TraceabilityChain,
  TraceabilityChainStep,
  TraceabilityGraphEdge,
  TraceabilityGraphNode,
  TraceabilityRelationDirection,
  TraceabilityChainSummary,
  TraceabilitySkippedRelation,
  WorkItemFull,
  WorkItemRelationSummary,
  WorkItemLinkTypeSummary,
  WorkItemRelationsGraph,
} from "../models.js";
import {
  asInteger,
  asBoolean,
  asRecord,
  asString,
  ensureArray,
  mapWorkItem,
  mapWorkItemFull,
  mapTestRun,
} from "./shared.js";
import { getTestRunFull } from "./testManagement.js";
import { fetchWorkItemsByIds } from "./workItems.js";

const DEFAULT_TRACEABILITY_DEPTH = 2;
const MAX_TRACEABILITY_DEPTH = 5;
const DEFAULT_TEST_POINTS_QUERY_PAGE_SIZE = 200;

export interface TraceabilityGraphInput {
  readonly project: string;
  readonly workItemId: number;
  readonly maxDepth?: number;
  readonly relationTypes?: readonly string[];
}

export interface GetTraceabilityChainInput extends TraceabilityGraphInput {}
export interface ListLinkedWorkItemsInput extends TraceabilityGraphInput {}
export interface ListWorkItemTestLinksInput {
  readonly project: string;
  readonly workItemId: number;
  readonly includeTestCases?: boolean;
  readonly includeSuites?: boolean;
  readonly includePlans?: boolean;
  readonly includeRecentRuns?: boolean;
  readonly includeRaw?: boolean;
}
export interface GetUserStoryTestCoverageInput {
  readonly project: string;
  readonly workItemId?: number;
  readonly userStoryId?: number;
  readonly includeSuites?: boolean;
  readonly includePlans?: boolean;
  readonly includeRecentRuns?: boolean;
  readonly includeRaw?: boolean;
}
export interface GetRequirementTraceabilityReportInput {
  readonly project: string;
  readonly workItemId: number;
  readonly includeSuites?: boolean;
  readonly includePlans?: boolean;
  readonly includeRecentRuns?: boolean;
  readonly includeRaw?: boolean;
}

function normalizeProject(project: string): string {
  return project.trim();
}

function normalizeDepth(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_TRACEABILITY_DEPTH;
  }

  return Math.max(0, Math.min(MAX_TRACEABILITY_DEPTH, Math.floor(value)));
}

function normalizeRelationTypeFilter(values: readonly string[] | undefined): string[] {
  const normalized = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      continue;
    }

    normalized.add(trimmed);
  }

  return [...normalized];
}

function normalizeProjectKey(project: string | null | undefined): string {
  return project?.trim().toLowerCase() ?? "";
}

function isVisibleWorkItemProject(
  project: string | null | undefined,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): boolean {
  if (config.azdoProjectAllowlist.length === 0) {
    return true;
  }

  return isProjectAllowed(project ?? undefined, config);
}

function sameProject(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizeProjectKey(left) === normalizeProjectKey(right);
}

function extractLinkedWorkItemId(url: string | null): number | null {
  if (!url) {
    return null;
  }

  const match = /\/workitems\/(\d+)(?:[/?]|$)/i.exec(url);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

export function normalizeRelationCategory(referenceName: string, topology?: string | null): string {
  const normalizedReferenceName = referenceName.trim().toLowerCase();

  if (normalizedReferenceName.includes("hierarchy")) {
    return "hierarchy";
  }

  if (normalizedReferenceName.includes("dependency")) {
    return "dependency";
  }

  if (normalizedReferenceName.includes("duplicate")) {
    return "duplicate";
  }

  if (
    normalizedReferenceName.includes("testedby") ||
    normalizedReferenceName.includes("tested by") ||
    normalizedReferenceName.includes("tests")
  ) {
    return "test";
  }

  if (normalizedReferenceName.includes("related")) {
    return "related";
  }

  if (
    normalizedReferenceName.includes("hyperlink") ||
    normalizedReferenceName.includes("artifactlink") ||
    normalizedReferenceName.includes("attachedfile")
  ) {
    return "external";
  }

  if (normalizedReferenceName.includes("remote")) {
    return "remote";
  }

  const normalizedTopology = topology?.trim().toLowerCase();
  if (normalizedTopology) {
    return normalizedTopology;
  }

  return "other";
}

export function normalizeRelationDirection(
  referenceName: string,
  directional: boolean,
): TraceabilityRelationDirection {
  const normalizedReferenceName = referenceName.trim().toLowerCase();

  if (normalizedReferenceName.endsWith("-forward")) {
    return "forward";
  }

  if (normalizedReferenceName.endsWith("-reverse")) {
    return "reverse";
  }

  if (!directional) {
    return "bidirectional";
  }

  return "unknown";
}

function mapWorkItemLinkType(raw: unknown): WorkItemLinkTypeSummary {
  const record = asRecord(raw);
  const attributes = { ...asRecord(record.attributes) };
  const referenceName = asString(record.referenceName) ?? "";
  const topology = asString(attributes.topology);
  const directional = asBoolean(attributes.directional);

  return {
    referenceName,
    name: asString(record.name) ?? referenceName,
    oppositeReferenceName:
      asString(attributes.oppositeEndReferenceName) ??
      asString(record.oppositeEndReferenceName),
    topology,
    category: normalizeRelationCategory(referenceName, topology),
    direction: normalizeRelationDirection(referenceName, directional),
    enabled: asBoolean(attributes.enabled),
    editable: asBoolean(attributes.editable),
    acyclic: asBoolean(attributes.acyclic),
    directional,
    singleTarget: asBoolean(attributes.singleTarget),
    usage: asString(attributes.usage),
    url: asString(record.url),
    attributes,
  };
}

async function loadWorkItemLinkTypeMap(
  client: AzureDevOpsClientLike,
): Promise<Map<string, WorkItemLinkTypeSummary>> {
  const response = await client.get<{ value?: unknown[] }>(
    "/_apis/wit/workitemrelationtypes?api-version=7.1",
  );

  return new Map(
    ensureArray(response.value)
      .map(mapWorkItemLinkType)
      .map((linkType) => [linkType.referenceName.toLowerCase(), linkType] as const),
  );
}

async function listWorkItemLinkTypesInternal(
  client: AzureDevOpsClientLike,
): Promise<WorkItemLinkTypeSummary[]> {
  const relationTypeMap = await loadWorkItemLinkTypeMap(client);
  return [...relationTypeMap.values()].sort((left, right) =>
    left.referenceName.localeCompare(right.referenceName),
  );
}

async function loadWorkItemWithRelations(
  client: AzureDevOpsClientLike,
  id: number,
): Promise<WorkItemFull> {
  const raw = await client.get<unknown>(
    `/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`,
  );

  return mapWorkItemFull(raw, {
    includeRelations: true,
  });
}

function matchesRelationTypeFilter(
  filters: readonly string[],
  referenceName: string | null,
  category: string,
  relationName: string | null,
): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedReferenceName = referenceName?.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();
  const normalizedRelationName = relationName?.trim().toLowerCase();

  return filters.some(
    (filter) =>
      filter === normalizedReferenceName ||
      filter === normalizedCategory ||
      filter === normalizedRelationName,
  );
}

type TraversalBuildResult = {
  readonly graph: WorkItemRelationsGraph;
  readonly nodesById: Map<number, TraceabilityGraphNode>;
  readonly edgesBySourceId: Map<number, TraceabilityGraphEdge[]>;
};

async function buildRelationsGraphInternal(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: TraceabilityGraphInput,
): Promise<TraversalBuildResult> {
  const project = normalizeProject(input.project);
  const workItemId = input.workItemId;
  const maxDepth = normalizeDepth(input.maxDepth);
  const relationTypeFilter = normalizeRelationTypeFilter(input.relationTypes);
  assertProjectAllowed(project, config);

  const relationTypeMap = await loadWorkItemLinkTypeMap(client);
  const root = await loadWorkItemWithRelations(client, workItemId);

  if (!isVisibleWorkItemProject(root.project, config)) {
    throw new Error(
      `Work item ${workItemId} belongs to project "${root.project ?? "unknown"}" which is not permitted by this connector.`,
    );
  }

  if (!sameProject(root.project, project)) {
    throw new Error(
      root.project
        ? `Work item ${workItemId} belongs to project "${root.project}" instead of "${project}".`
        : `Work item ${workItemId} project is not available and cannot be matched to "${project}".`,
    );
  }

  const loadedItems = new Map<number, WorkItemFull>([[root.id, root]]);
  const nodeDepths = new Map<number, number>([[root.id, 0]]);
  const queue: number[] = [root.id];
  const queuedIds = new Set<number>([root.id]);
  const processedIds = new Set<number>();
  const skippedRelations: TraceabilitySkippedRelation[] = [];
  const edgeMap = new Map<string, TraceabilityGraphEdge>();
  const relationTypesEncountered = new Set<string>();
  const nodesById = new Map<number, TraceabilityGraphNode>();
  let exploredEdgeCount = 0;
  let truncatedAtDepth = false;

  while (queue.length > 0) {
    const currentId = queue.shift() ?? 0;
    queuedIds.delete(currentId);
    if (processedIds.has(currentId)) {
      continue;
    }
    processedIds.add(currentId);
    const current = loadedItems.get(currentId);
    if (!current) {
      continue;
    }

    const currentDepth = nodeDepths.get(currentId) ?? 0;
    const currentNode: TraceabilityGraphNode = {
      ...mapWorkItem(current),
      depth: currentDepth,
      isRoot: currentId === root.id,
    };
    nodesById.set(currentId, currentNode);

    if (currentDepth >= maxDepth) {
      if (
        ensureArray<WorkItemRelationSummary>(current.relations).some(
          (relation) => relation.linkedWorkItemId !== null,
        )
      ) {
        truncatedAtDepth = true;
      }
      continue;
    }

    for (const relation of ensureArray<WorkItemRelationSummary>(current.relations)) {
      exploredEdgeCount += 1;

      const referenceName = relation.rel;
      const targetId = relation.linkedWorkItemId ?? extractLinkedWorkItemId(relation.url);
      const relationType = referenceName
        ? relationTypeMap.get(referenceName.toLowerCase())
        : undefined;
      const category = relationType?.category ?? normalizeRelationCategory(referenceName ?? "");
      const relationName = relationType?.name ?? referenceName;

      if (!matchesRelationTypeFilter(relationTypeFilter, referenceName, category, relationName)) {
        skippedRelations.push({
          sourceId: current.id,
          sourceProject: current.project,
          referenceName,
          targetId,
          reason: "filtered_out",
        });
        continue;
      }

      if (targetId === null) {
        skippedRelations.push({
          sourceId: current.id,
          sourceProject: current.project,
          referenceName,
          targetId: null,
          reason: "non_work_item_relation",
        });
        continue;
      }

      let target = loadedItems.get(targetId);
      let loadedNow = false;
      if (!target) {
        try {
          target = await loadWorkItemWithRelations(client, targetId);
        } catch (error) {
          if (error instanceof AzureDevOpsApiError && error.azureStatus === 404) {
            skippedRelations.push({
              sourceId: current.id,
              sourceProject: current.project,
              referenceName,
              targetId,
              reason: "not_found",
            });
            continue;
          }

          throw error;
        }

        if (!isVisibleWorkItemProject(target.project, config)) {
          skippedRelations.push({
            sourceId: current.id,
            sourceProject: current.project,
            referenceName,
            targetId,
            reason: "not_allowed",
          });
          continue;
        }

        loadedItems.set(targetId, target);
        nodeDepths.set(targetId, currentDepth + 1);
        loadedNow = true;
      }

      const nextDepth = nodeDepths.get(targetId) ?? currentDepth + 1;
      const targetNode: TraceabilityGraphNode = {
        ...mapWorkItem(target),
        depth: nextDepth,
        isRoot: targetId === root.id,
      };
      nodesById.set(targetId, targetNode);

      const edge: TraceabilityGraphEdge = {
        sourceId: current.id,
        targetId,
        sourceProject: current.project,
        targetProject: target.project,
        referenceName: referenceName ?? "unknown",
        name: relationType?.name ?? relationName,
        oppositeReferenceName: relationType?.oppositeReferenceName ?? null,
        topology: relationType?.topology ?? null,
        category,
        direction:
          relationType?.direction ??
          normalizeRelationDirection(referenceName ?? "unknown", false),
        isCrossProject: !sameProject(current.project, target.project),
        attributes: relation.attributes,
      };

      edgeMap.set(
        `${edge.sourceId}|${edge.targetId}|${edge.referenceName}`,
        edge,
      );
      relationTypesEncountered.add(edge.referenceName);

      if (
        loadedNow &&
        nextDepth <= maxDepth &&
        !queuedIds.has(targetId) &&
        !processedIds.has(targetId)
      ) {
        queue.push(targetId);
        queuedIds.add(targetId);
      }
    }
  }

  const nodes = [...nodesById.values()].sort(
    (left, right) => left.depth - right.depth || left.id - right.id,
  );
  const edges = [...edgeMap.values()].sort(
    (left, right) =>
      left.sourceId - right.sourceId ||
      left.targetId - right.targetId ||
      left.referenceName.localeCompare(right.referenceName),
  );
  const edgesBySourceId = new Map<number, TraceabilityGraphEdge[]>();

  for (const edge of edges) {
    const currentEdges = edgesBySourceId.get(edge.sourceId) ?? [];
    currentEdges.push(edge);
    edgesBySourceId.set(edge.sourceId, currentEdges);
  }

  const crossProjectNodeCount = nodes.filter((node) => !sameProject(node.project, root.project))
    .length;
  const crossProjectEdgeCount = edges.filter((edge) => edge.isCrossProject).length;

  return {
    graph: {
      rootId: root.id,
      rootProject: root.project,
      maxDepth,
      relationTypeFilter,
      nodes,
      edges,
      skippedRelations,
      relationTypesEncountered: [...relationTypesEncountered].sort(),
      crossProjectNodeCount,
      crossProjectEdgeCount,
      traversal: {
        visitedNodeCount: nodes.length,
        exploredEdgeCount,
        skippedRelationCount: skippedRelations.length,
        truncatedAtDepth,
      },
    },
    nodesById,
    edgesBySourceId,
  };
}

function mapChainStep(edge: TraceabilityGraphEdge): TraceabilityChainStep {
  return {
    fromId: edge.sourceId,
    toId: edge.targetId,
    referenceName: edge.referenceName,
    category: edge.category,
    direction: edge.direction,
  };
}

export function buildTraceabilityChainsFromGraph(
  graph: WorkItemRelationsGraph,
): TraceabilityChain[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const edgesBySourceId = new Map<number, TraceabilityGraphEdge[]>();

  for (const edge of graph.edges) {
    const currentEdges = edgesBySourceId.get(edge.sourceId) ?? [];
    currentEdges.push(edge);
    edgesBySourceId.set(edge.sourceId, currentEdges);
  }

  const root = nodesById.get(graph.rootId);
  if (!root) {
    return [];
  }

  const chains: TraceabilityChain[] = [];

  function visit(
    currentId: number,
    pathNodeIds: number[],
    pathSteps: TraceabilityChainStep[],
    seenNodeIds: Set<number>,
    cycleDetected: boolean,
  ): void {
    const outgoingEdges = edgesBySourceId.get(currentId) ?? [];
    const cycleOnCurrentNode = outgoingEdges.some((edge) => seenNodeIds.has(edge.targetId));
    const nextEdges = outgoingEdges.filter((edge) => seenNodeIds.has(edge.targetId) === false);
    const currentCycleDetected = cycleDetected || cycleOnCurrentNode;

    if (nextEdges.length === 0) {
      const terminalNode = nodesById.get(currentId);
      chains.push({
        chainId: pathNodeIds.join("->"),
        nodeIds: [...pathNodeIds],
        steps: [...pathSteps],
        terminalNodeId: currentId,
        terminalNodeProject: terminalNode?.project ?? null,
        terminalWorkItemType: terminalNode?.workItemType ?? null,
        containsCrossProjectItems: pathNodeIds.some((nodeId) => {
          const node = nodesById.get(nodeId);
          return !sameProject(node?.project, graph.rootProject);
        }),
        cycleDetected: currentCycleDetected,
        endsAtMaxDepth: (terminalNode?.depth ?? 0) >= graph.maxDepth,
      });
      return;
    }

    for (const edge of nextEdges) {
      seenNodeIds.add(edge.targetId);
      visit(
        edge.targetId,
        [...pathNodeIds, edge.targetId],
        [...pathSteps, mapChainStep(edge)],
        seenNodeIds,
        currentCycleDetected,
      );
      seenNodeIds.delete(edge.targetId);
    }
  }

  visit(root.id, [root.id], [], new Set<number>([root.id]), false);

  return chains.sort((left, right) =>
    left.chainId.localeCompare(right.chainId),
  );
}

export function buildLinkedWorkItemsSummaryFromGraph(
  graph: WorkItemRelationsGraph,
): LinkedWorkItemsSummary {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const root = nodesById.get(graph.rootId);

  if (!root) {
    throw new Error(`Traceability graph root ${graph.rootId} is missing from the node set.`);
  }

  const outgoingBySourceId = new Map<number, TraceabilityGraphEdge[]>();
  const incomingByTargetId = new Map<number, TraceabilityGraphEdge[]>();

  for (const edge of graph.edges) {
    const outgoingEdges = outgoingBySourceId.get(edge.sourceId) ?? [];
    outgoingEdges.push(edge);
    outgoingBySourceId.set(edge.sourceId, outgoingEdges);

    const incomingEdges = incomingByTargetId.get(edge.targetId) ?? [];
    incomingEdges.push(edge);
    incomingByTargetId.set(edge.targetId, incomingEdges);
  }

  const pathSignaturesByTerminalId = new Map<number, Set<string>>();
  const pathsByTerminalId = new Map<number, TraceabilityChain[]>();

  function addPath(path: TraceabilityChain): void {
    const signature = [
      path.chainId,
      ...path.steps.map(
        (step) => `${step.fromId}:${step.toId}:${step.referenceName}:${step.direction}`,
      ),
    ].join("|");
    const existingSignatures = pathSignaturesByTerminalId.get(path.terminalNodeId) ?? new Set();
    if (existingSignatures.has(signature)) {
      return;
    }

    existingSignatures.add(signature);
    pathSignaturesByTerminalId.set(path.terminalNodeId, existingSignatures);

    const existingPaths = pathsByTerminalId.get(path.terminalNodeId) ?? [];
    existingPaths.push(path);
    pathsByTerminalId.set(path.terminalNodeId, existingPaths);
  }

  function visit(
    currentId: number,
    pathNodeIds: number[],
    pathSteps: TraceabilityChainStep[],
    seenNodeIds: Set<number>,
    cycleDetected: boolean,
  ): void {
    const outgoingEdges = outgoingBySourceId.get(currentId) ?? [];
    const cycleOnCurrentNode = outgoingEdges.some((edge) => seenNodeIds.has(edge.targetId));
    const nextEdges = outgoingEdges.filter((edge) => seenNodeIds.has(edge.targetId) === false);
    const currentCycleDetected = cycleDetected || cycleOnCurrentNode;
    const currentNode = nodesById.get(currentId);

    if (currentNode && currentId !== graph.rootId && pathSteps.length > 0) {
      addPath({
        chainId: pathNodeIds.join("->"),
        nodeIds: [...pathNodeIds],
        steps: [...pathSteps],
        terminalNodeId: currentNode.id,
        terminalNodeProject: currentNode.project,
        terminalWorkItemType: currentNode.workItemType,
        containsCrossProjectItems: pathNodeIds.some((nodeId) => {
          const node = nodesById.get(nodeId);
          return !sameProject(node?.project, graph.rootProject);
        }),
        cycleDetected: currentCycleDetected,
        endsAtMaxDepth: currentNode.depth >= graph.maxDepth,
      });
    }

    for (const edge of nextEdges) {
      const nextSeenNodeIds = new Set(seenNodeIds);
      nextSeenNodeIds.add(edge.targetId);
      visit(
        edge.targetId,
        [...pathNodeIds, edge.targetId],
        [...pathSteps, mapChainStep(edge)],
        nextSeenNodeIds,
        currentCycleDetected,
      );
    }
  }

  visit(root.id, [root.id], [], new Set([root.id]), false);

  const linkedWorkItems: LinkedWorkItemSummary[] = graph.nodes
    .filter((node) => node.isRoot === false)
    .map((node) => {
      const incomingRelations = [...(incomingByTargetId.get(node.id) ?? [])];
      const outgoingRelations = [...(outgoingBySourceId.get(node.id) ?? [])];
      const relationTypes = new Set<string>();
      const relationCategories = new Set<string>();

      for (const edge of [...incomingRelations, ...outgoingRelations]) {
        relationTypes.add(edge.referenceName);
        relationCategories.add(edge.category);
      }

      const pathsFromRoot = [...(pathsByTerminalId.get(node.id) ?? [])].sort((left, right) =>
        left.chainId.localeCompare(right.chainId),
      );

      return {
        ...node,
        isCrossProject: !sameProject(node.project, graph.rootProject),
        pathCount: pathsFromRoot.length,
        relationTypes: [...relationTypes].sort(),
        relationCategories: [...relationCategories].sort(),
        incomingRelations,
        outgoingRelations,
        pathsFromRoot,
      };
    })
    .sort((left, right) => left.depth - right.depth || left.id - right.id);

  return {
    rootId: graph.rootId,
    rootProject: graph.rootProject,
    root,
    maxDepth: graph.maxDepth,
    relationTypeFilter: graph.relationTypeFilter,
    linkedWorkItems,
    totalLinkedWorkItems: linkedWorkItems.length,
    edges: graph.edges,
    skippedRelations: graph.skippedRelations,
    relationTypesEncountered: graph.relationTypesEncountered,
    crossProjectNodeCount: graph.crossProjectNodeCount,
    crossProjectEdgeCount: graph.crossProjectEdgeCount,
    traversal: graph.traversal,
  };
}

type DirectTestRelationCandidate = {
  readonly relation: WorkItemRelationSummary;
  readonly relationType: string;
  readonly relationName: string | null;
  readonly relationCategory: string;
  readonly relationDirection: TraceabilityRelationDirection;
  readonly testCaseId: number;
};

type PointQueryRecord = {
  readonly project: string;
  readonly testCaseId: number | null;
  readonly pointId: number | null;
  readonly suiteId: number | null;
  readonly suiteName: string | null;
  readonly planId: number | null;
  readonly planName: string | null;
  readonly lastRunId: number | null;
  readonly url: string | null;
  readonly raw?: unknown;
};

type RunLinkContext = {
  readonly pointIds: Set<number>;
  readonly suiteIds: Set<number>;
  readonly planIds: Set<number>;
};

type TestCaseLinkEnrichment = {
  readonly suiteIds: Set<number>;
  readonly suitesById: Map<number, WorkItemTestLinkSuiteSummary>;
  readonly planIds: Set<number>;
  readonly plansById: Map<number, WorkItemTestLinkPlanSummary>;
  readonly runContextById: Map<number, RunLinkContext>;
  readonly rawPoints: unknown[];
};

function extractIdFromUrlSegment(url: string | null, segment: string): number | null {
  if (!url) {
    return null;
  }

  const match = new RegExp(`/${segment}/(\\d+)(?:[/?]|$)`, "i").exec(url);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function getTestPointTestCaseId(raw: unknown): number | null {
  const record = asRecord(raw);
  return asInteger(asRecord(record.testCase).id) ?? asInteger(record.testCaseId);
}

function getTestPointPlanId(raw: unknown, url: string | null): number | null {
  const record = asRecord(raw);

  return (
    asInteger(asRecord(record.testPlan).id) ??
    asInteger(asRecord(record.plan).id) ??
    asInteger(record.planId) ??
    extractIdFromUrlSegment(url, "Plans")
  );
}

function getTestPointSuiteId(raw: unknown, url: string | null): number | null {
  const record = asRecord(raw);

  return (
    asInteger(asRecord(record.testSuite).id) ??
    asInteger(asRecord(record.suite).id) ??
    asInteger(record.suiteId) ??
    extractIdFromUrlSegment(url, "Suites")
  );
}

function mapPointQueryRecord(
  raw: unknown,
  project: string,
  includeRaw: boolean,
): PointQueryRecord {
  const record = asRecord(raw);
  const url = asString(record.url);

  return {
    project,
    testCaseId: getTestPointTestCaseId(record),
    pointId: asInteger(record.id) ?? extractIdFromUrlSegment(url, "Points"),
    suiteId: getTestPointSuiteId(record, url),
    suiteName: asString(asRecord(record.testSuite).name) ?? asString(asRecord(record.suite).name),
    planId: getTestPointPlanId(record, url),
    planName: asString(asRecord(record.testPlan).name) ?? asString(asRecord(record.plan).name),
    lastRunId: asInteger(record.lastRunId) ?? asInteger(asRecord(record.lastTestRun).id),
    url,
    raw: includeRaw ? raw : undefined,
  };
}

function sortIds(values: Iterable<number>): number[] {
  return [...values].sort((left, right) => left - right);
}

function getDateSortValue(value: string | null | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

async function fetchTestPointsByTestCaseIds(
  client: AzureDevOpsClientLike,
  project: string,
  testCaseIds: readonly number[],
  pageSize = DEFAULT_TEST_POINTS_QUERY_PAGE_SIZE,
): Promise<unknown[]> {
  if (testCaseIds.length === 0) {
    return [];
  }

  const items: unknown[] = [];
  let skip = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set("$top", String(pageSize));
    params.set("$skip", String(skip));
    params.set("api-version", "7.1");

    const response = await client.post<{ points?: unknown[]; value?: unknown[] }>(
      `/${encodeURIComponent(project)}/_apis/test/points?${params.toString()}`,
      {
        pointsFilter: {
          testcaseIds: [...testCaseIds],
        },
      },
    );

    const page = ensureArray(response.points ?? response.value);
    if (page.length === 0) {
      break;
    }

    items.push(...page);
    if (page.length < pageSize) {
      break;
    }

    skip += page.length;
  }

  return items;
}

async function fetchRecentRunsById(
  client: AzureDevOpsClientLike,
  project: string,
  runIds: readonly number[],
): Promise<Map<number, unknown>> {
  const runsById = new Map<number, unknown>();

  for (const runId of [...new Set(runIds)].sort((left, right) => left - right)) {
    const rawRun = await client.get<unknown>(
      `/${encodeURIComponent(project)}/_apis/test/runs/${runId}?api-version=7.1`,
    );
    runsById.set(runId, rawRun);
  }

  return runsById;
}

function getOrCreateTestCaseLinkEnrichment(
  enrichmentByCaseId: Map<number, TestCaseLinkEnrichment>,
  testCaseId: number,
): TestCaseLinkEnrichment {
  const existing = enrichmentByCaseId.get(testCaseId);
  if (existing) {
    return existing;
  }

  const created: TestCaseLinkEnrichment = {
    suiteIds: new Set<number>(),
    suitesById: new Map<number, WorkItemTestLinkSuiteSummary>(),
    planIds: new Set<number>(),
    plansById: new Map<number, WorkItemTestLinkPlanSummary>(),
    runContextById: new Map<number, RunLinkContext>(),
    rawPoints: [],
  };
  enrichmentByCaseId.set(testCaseId, created);
  return created;
}

function mapRecentRunSummary(
  rawRun: unknown,
  project: string,
  context: RunLinkContext,
  includeRaw: boolean,
): WorkItemTestLinkRecentRunSummary {
  const record = asRecord(rawRun);

  return {
    ...mapTestRun(rawRun),
    project,
    pointIds: sortIds(context.pointIds),
    suiteIds: sortIds(context.suiteIds),
    planIds: sortIds(context.planIds),
    url: asString(record.url),
    raw: includeRaw ? rawRun : undefined,
  };
}

async function buildTestCaseEnrichmentById(
  client: AzureDevOpsClientLike,
  testCases: readonly WorkItemSummary[],
  options: {
    readonly includeSuites: boolean;
    readonly includePlans: boolean;
    readonly includeRecentRuns: boolean;
    readonly includeRaw: boolean;
  },
): Promise<Map<number, TestCaseLinkEnrichment>> {
  const enrichmentByCaseId = new Map<number, TestCaseLinkEnrichment>();

  if (!(options.includeSuites || options.includePlans || options.includeRecentRuns)) {
    return enrichmentByCaseId;
  }

  const caseIdsByProject = new Map<string, number[]>();
  for (const testCase of testCases) {
    const caseProject = normalizeProject(testCase.project ?? "");
    if (!caseProject) {
      continue;
    }

    const currentIds = caseIdsByProject.get(caseProject) ?? [];
    currentIds.push(testCase.id);
    caseIdsByProject.set(caseProject, currentIds);
  }

  for (const [project, caseIds] of caseIdsByProject) {
    const rawPoints = await fetchTestPointsByTestCaseIds(client, project, caseIds);

    for (const rawPoint of rawPoints) {
      const point = mapPointQueryRecord(rawPoint, project, options.includeRaw);
      if (point.testCaseId === null) {
        continue;
      }

      const enrichment = getOrCreateTestCaseLinkEnrichment(enrichmentByCaseId, point.testCaseId);
      if (options.includeRaw) {
        enrichment.rawPoints.push(rawPoint);
      }

      if (point.suiteId !== null) {
        enrichment.suiteIds.add(point.suiteId);

        if (options.includeSuites && enrichment.suitesById.has(point.suiteId) === false) {
          enrichment.suitesById.set(point.suiteId, {
            id: point.suiteId,
            name: point.suiteName,
            planId: point.planId,
            planName: point.planName,
            project,
            url: point.url,
            raw: options.includeRaw ? rawPoint : undefined,
          });
        }
      }

      if (point.planId !== null) {
        enrichment.planIds.add(point.planId);

        if (options.includePlans && enrichment.plansById.has(point.planId) === false) {
          enrichment.plansById.set(point.planId, {
            id: point.planId,
            name: point.planName,
            project,
            url: point.url,
            raw: options.includeRaw ? rawPoint : undefined,
          });
        }
      }

      if (options.includeRecentRuns && point.lastRunId !== null) {
        const runContext = enrichment.runContextById.get(point.lastRunId) ?? {
          pointIds: new Set<number>(),
          suiteIds: new Set<number>(),
          planIds: new Set<number>(),
        };

        if (point.pointId !== null) {
          runContext.pointIds.add(point.pointId);
        }
        if (point.suiteId !== null) {
          runContext.suiteIds.add(point.suiteId);
        }
        if (point.planId !== null) {
          runContext.planIds.add(point.planId);
        }

        enrichment.runContextById.set(point.lastRunId, runContext);
      }
    }

  }

  return enrichmentByCaseId;
}

function toSortedSuites(
  suitesById: Map<number, WorkItemTestLinkSuiteSummary>,
): WorkItemTestLinkSuiteSummary[] {
  return [...suitesById.values()].sort((left, right) => left.id - right.id);
}

function toSortedPlans(
  plansById: Map<number, WorkItemTestLinkPlanSummary>,
): WorkItemTestLinkPlanSummary[] {
  return [...plansById.values()].sort((left, right) => left.id - right.id);
}

function normalizeCoverageOutcome(value: string | null | undefined): TestCoverageOutcome {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized === "passed" || normalized === "pass") {
    return "passed";
  }

  if (
    normalized === "failed" ||
    normalized === "fail" ||
    normalized === "error" ||
    normalized === "timeout" ||
    normalized === "aborted"
  ) {
    return "failed";
  }

  if (
    normalized === "notexecuted" ||
    normalized === "not executed" ||
    normalized === "not run" ||
    normalized === "paused" ||
    normalized === "blocked"
  ) {
    return "not_executed";
  }

  return "unknown";
}

function deriveCoverageStatus(summary: UserStoryTestCoverageSummary): UserStoryTestCoverageStatus {
  if (summary.totalLinkedTestCases === 0) {
    return "no_tests";
  }

  if (summary.failedCount > 0) {
    return "failed";
  }

  if (summary.notExecutedCount > 0) {
    return "not_executed";
  }

  if (summary.passedCount === summary.totalLinkedTestCases) {
    return "passed";
  }

  if (summary.unknownCount === summary.totalLinkedTestCases) {
    return "unknown";
  }

  return "partial";
}

function buildCoverageSummary(
  linkedTestCases: readonly Pick<
    UserStoryLinkedTestCaseCoverage,
    "suiteIds" | "planIds" | "recentRuns" | "latestOutcome"
  >[],
): UserStoryTestCoverageSummary {
  return {
    totalLinkedTestCases: linkedTestCases.length,
    withSuites: linkedTestCases.filter((testCase) => testCase.suiteIds.length > 0).length,
    withPlans: linkedTestCases.filter((testCase) => testCase.planIds.length > 0).length,
    withRecentRuns: linkedTestCases.filter((testCase) => testCase.recentRuns.length > 0).length,
    passedCount: linkedTestCases.filter((testCase) => testCase.latestOutcome === "passed").length,
    failedCount: linkedTestCases.filter((testCase) => testCase.latestOutcome === "failed").length,
    notExecutedCount: linkedTestCases.filter((testCase) => testCase.latestOutcome === "not_executed").length,
    unknownCount: linkedTestCases.filter((testCase) => testCase.latestOutcome === "unknown").length,
  };
}

function buildRequirementTraceabilityGaps(
  linkedTestCases: readonly UserStoryLinkedTestCaseCoverage[],
): RequirementTraceabilityGaps {
  const missingSuiteTestCaseIds = linkedTestCases
    .filter((testCase) => testCase.suiteIds.length === 0)
    .map((testCase) => testCase.testCaseId)
    .sort((left, right) => left - right);
  const missingPlanTestCaseIds = linkedTestCases
    .filter((testCase) => testCase.planIds.length === 0)
    .map((testCase) => testCase.testCaseId)
    .sort((left, right) => left - right);
  const missingRecentRunTestCaseIds = linkedTestCases
    .filter((testCase) => testCase.recentRuns.length === 0)
    .map((testCase) => testCase.testCaseId)
    .sort((left, right) => left - right);
  const failedTestCaseIds = linkedTestCases
    .filter((testCase) => testCase.latestOutcome === "failed")
    .map((testCase) => testCase.testCaseId)
    .sort((left, right) => left - right);
  const unknownOutcomeTestCaseIds = linkedTestCases
    .filter((testCase) => testCase.latestOutcome === "unknown")
    .map((testCase) => testCase.testCaseId)
    .sort((left, right) => left - right);

  return {
    hasNoLinkedTestCases: linkedTestCases.length === 0,
    hasTestCaseWithoutSuite: missingSuiteTestCaseIds.length > 0,
    hasTestCaseWithoutPlan: missingPlanTestCaseIds.length > 0,
    hasTestCaseWithoutRecentRun: missingRecentRunTestCaseIds.length > 0,
    hasFailedTests: failedTestCaseIds.length > 0,
    hasUnknownOutcomes: unknownOutcomeTestCaseIds.length > 0,
    missingSuiteTestCaseIds,
    missingPlanTestCaseIds,
    missingRecentRunTestCaseIds,
    failedTestCaseIds,
    unknownOutcomeTestCaseIds,
  };
}

function deriveRequirementTraceabilityStatus(
  coverageStatus: UserStoryTestCoverageStatus,
  gaps: RequirementTraceabilityGaps,
): RequirementTraceabilityStatus {
  if (gaps.hasNoLinkedTestCases) {
    return "missing_tests";
  }

  if (gaps.hasFailedTests) {
    return "at_risk";
  }

  if (coverageStatus === "not_executed" || gaps.hasTestCaseWithoutRecentRun) {
    return "missing_execution";
  }

  if (gaps.hasTestCaseWithoutSuite || gaps.hasTestCaseWithoutPlan || coverageStatus === "partial") {
    return "partial";
  }

  if (gaps.hasUnknownOutcomes) {
    return "at_risk";
  }

  return "complete";
}

function selectLatestResultForTestCase(
  run: TestRunFull,
  testCaseId: number,
): { readonly outcome: TestCoverageOutcome; readonly completedDate: string | null } | null {
  const matchingResults = run.results
    .filter((result) => result.testCase?.id === testCaseId)
    .sort((left, right) => {
      const dateDelta =
        getDateSortValue(right.completedDate ?? right.startedDate) -
        getDateSortValue(left.completedDate ?? left.startedDate);
      if (dateDelta !== 0) {
        return dateDelta;
      }

      return right.id - left.id;
    });

  const latestResult = matchingResults[0];
  if (!latestResult) {
    return null;
  }

  return {
    outcome: normalizeCoverageOutcome(latestResult.outcome ?? run.outcome ?? run.result),
    completedDate: latestResult.completedDate ?? latestResult.startedDate,
  };
}

function selectLatestOutcomeForLinkedTestCase(
  link: WorkItemTestLinkSummary,
  runByKey: Map<string, TestRunFull>,
): TestCoverageOutcome {
  const candidates = link.recentRuns
    .map((run) => {
      const runFull = runByKey.get(`${run.project}\u0000${run.id}`);
      if (!runFull) {
        return null;
      }

      const latestResult = selectLatestResultForTestCase(runFull, link.testCaseId);
      if (!latestResult) {
        return null;
      }

      return latestResult;
    })
    .filter((candidate): candidate is { readonly outcome: TestCoverageOutcome; readonly completedDate: string | null } => candidate !== null)
    .sort((left, right) => getDateSortValue(right.completedDate) - getDateSortValue(left.completedDate));

  return candidates[0]?.outcome ?? "unknown";
}

async function buildRecentRunsByCaseId(
  client: AzureDevOpsClientLike,
  testCases: readonly WorkItemSummary[],
  enrichmentByCaseId: Map<number, TestCaseLinkEnrichment>,
  includeRaw: boolean,
): Promise<Map<number, WorkItemTestLinkRecentRunSummary[]>> {
  const recentRunsByCaseId = new Map<number, WorkItemTestLinkRecentRunSummary[]>();
  const caseIdsByProject = new Map<string, number[]>();

  for (const testCase of testCases) {
    const caseProject = normalizeProject(testCase.project ?? "");
    if (!caseProject) {
      continue;
    }

    const enrichment = enrichmentByCaseId.get(testCase.id);
    if (!enrichment || enrichment.runContextById.size === 0) {
      continue;
    }

    const currentIds = caseIdsByProject.get(caseProject) ?? [];
    currentIds.push(testCase.id);
    caseIdsByProject.set(caseProject, currentIds);
  }

  for (const [project, caseIds] of caseIdsByProject) {
    const runIds = [
      ...new Set(
        caseIds.flatMap((caseId) => [...(enrichmentByCaseId.get(caseId)?.runContextById.keys() ?? [])]),
      ),
    ];
    const runsById = await fetchRecentRunsById(client, project, runIds);

    for (const caseId of caseIds) {
      const enrichment = enrichmentByCaseId.get(caseId);
      if (!enrichment) {
        continue;
      }

      const recentRuns = [...enrichment.runContextById.entries()]
        .map(([runId, context]) => {
          const rawRun = runsById.get(runId);
          if (!rawRun) {
            return null;
          }

          return mapRecentRunSummary(rawRun, project, context, includeRaw);
        })
        .filter((run): run is WorkItemTestLinkRecentRunSummary => run !== null)
        .sort((left, right) => {
          const dateDelta =
            getDateSortValue(right.completedDate ?? right.startedDate) -
            getDateSortValue(left.completedDate ?? left.startedDate);
          if (dateDelta !== 0) {
            return dateDelta;
          }

          return right.id - left.id;
        });

      recentRunsByCaseId.set(caseId, recentRuns);
    }
  }

  return recentRunsByCaseId;
}

export async function listWorkItemTestLinks(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: ListWorkItemTestLinksInput,
): Promise<WorkItemTestLinksSummary> {
  const project = normalizeProject(input.project);
  assertProjectAllowed(project, config);

  const includeTestCases = input.includeTestCases === true;
  const includeSuites = input.includeSuites === true;
  const includePlans = input.includePlans === true;
  const includeRecentRuns = input.includeRecentRuns === true;
  const includeRaw = input.includeRaw === true;

  const relationTypeMap = await loadWorkItemLinkTypeMap(client);
  const root = await loadWorkItemWithRelations(client, input.workItemId);

  if (!isVisibleWorkItemProject(root.project, config)) {
    throw new Error(
      `Work item ${input.workItemId} belongs to project "${root.project ?? "unknown"}" which is not permitted by this connector.`,
    );
  }

  if (!sameProject(root.project, project)) {
    throw new Error(
      root.project
        ? `Work item ${input.workItemId} belongs to project "${root.project}" instead of "${project}".`
        : `Work item ${input.workItemId} project is not available and cannot be matched to "${project}".`,
    );
  }

  const skippedRelations: TraceabilitySkippedRelation[] = [];
  const directTestRelations: DirectTestRelationCandidate[] = [];

  for (const relation of ensureArray<WorkItemRelationSummary>(root.relations)) {
    const referenceName = relation.rel;
    const relationType = referenceName
      ? relationTypeMap.get(referenceName.toLowerCase())
      : undefined;
    const relationCategory = relationType?.category ?? normalizeRelationCategory(referenceName ?? "");

    if (relationCategory !== "test") {
      continue;
    }

    const testCaseId = relation.linkedWorkItemId ?? extractLinkedWorkItemId(relation.url);
    if (testCaseId === null) {
      skippedRelations.push({
        sourceId: root.id,
        sourceProject: root.project,
        referenceName,
        targetId: null,
        reason: "non_work_item_relation",
      });
      continue;
    }

    directTestRelations.push({
      relation,
      relationType: referenceName ?? "unknown",
      relationName:
        relationType?.name ??
        asString(asRecord(relation.attributes).name) ??
        referenceName,
      relationCategory,
      relationDirection:
        relationType?.direction ?? normalizeRelationDirection(referenceName ?? "unknown", false),
      testCaseId,
    });
  }

  if (directTestRelations.length === 0) {
    return {
      project,
      workItemId: root.id,
      workItem: mapWorkItem(root),
      testLinks: [],
      totalTestLinks: 0,
      totalTestCases: 0,
      totalSuites: 0,
      totalPlans: 0,
      totalRecentRuns: 0,
      relationTypesEncountered: [],
      skippedRelations,
    };
  }

  const uniqueTestCaseIds = [...new Set(directTestRelations.map((relation) => relation.testCaseId))];
  const fetchedTestCases = await fetchWorkItemsByIds(client, uniqueTestCaseIds);
  const fetchedTestCasesById = new Map(fetchedTestCases.map((testCase) => [testCase.id, testCase] as const));
  const visibleTestCasesById = new Map<number, WorkItemSummary>();

  for (const relation of directTestRelations) {
    const linkedTestCase = fetchedTestCasesById.get(relation.testCaseId);

    if (!linkedTestCase) {
      skippedRelations.push({
        sourceId: root.id,
        sourceProject: root.project,
        referenceName: relation.relationType,
        targetId: relation.testCaseId,
        reason: "not_found",
      });
      continue;
    }

    if (!isVisibleWorkItemProject(linkedTestCase.project, config)) {
      skippedRelations.push({
        sourceId: root.id,
        sourceProject: root.project,
        referenceName: relation.relationType,
        targetId: relation.testCaseId,
        reason: "not_allowed",
      });
      continue;
    }

    if ((linkedTestCase.workItemType ?? "").trim().toLowerCase() !== "test case") {
      skippedRelations.push({
        sourceId: root.id,
        sourceProject: root.project,
        referenceName: relation.relationType,
        targetId: relation.testCaseId,
        reason: "filtered_out",
      });
      continue;
    }

    visibleTestCasesById.set(linkedTestCase.id, linkedTestCase);
  }

  const visibleTestCases = uniqueTestCaseIds
    .map((testCaseId) => visibleTestCasesById.get(testCaseId) ?? null)
    .filter((testCase): testCase is WorkItemSummary => testCase !== null);

  const enrichmentByCaseId = await buildTestCaseEnrichmentById(client, visibleTestCases, {
    includeSuites,
    includePlans,
    includeRecentRuns,
    includeRaw,
  });
  const recentRunsByCaseId = includeRecentRuns
    ? await buildRecentRunsByCaseId(client, visibleTestCases, enrichmentByCaseId, includeRaw)
    : new Map<number, WorkItemTestLinkRecentRunSummary[]>();

  const relationTypesEncountered = new Set<string>();
  const suiteIdsEncountered = new Set<number>();
  const planIdsEncountered = new Set<number>();
  const recentRunIdsEncountered = new Set<number>();

  const testLinks = directTestRelations
    .map((relation) => {
      const testCase = visibleTestCasesById.get(relation.testCaseId);
      if (!testCase) {
        return null;
      }

      const enrichment = enrichmentByCaseId.get(relation.testCaseId);
      const suiteIds = sortIds(enrichment?.suiteIds ?? []);
      const planIds = sortIds(enrichment?.planIds ?? []);
      const recentRuns = includeRecentRuns
        ? [...(recentRunsByCaseId.get(relation.testCaseId) ?? [])]
        : [];

      relationTypesEncountered.add(relation.relationType);
      for (const suiteId of suiteIds) {
        suiteIdsEncountered.add(suiteId);
      }
      for (const planId of planIds) {
        planIdsEncountered.add(planId);
      }
      for (const run of recentRuns) {
        recentRunIdsEncountered.add(run.id);
      }

      return {
        relationType: relation.relationType,
        relationName: relation.relationName,
        relationCategory: relation.relationCategory,
        relationDirection: relation.relationDirection,
        testCaseId: testCase.id,
        testCaseTitle: testCase.title,
        testCaseState: testCase.state,
        testCaseProject: testCase.project,
        isCrossProject: !sameProject(testCase.project, root.project),
        suiteIds,
        planIds,
        recentRuns,
        testCase: includeTestCases ? testCase : undefined,
        suites: includeSuites && enrichment ? toSortedSuites(enrichment.suitesById) : undefined,
        plans: includePlans && enrichment ? toSortedPlans(enrichment.plansById) : undefined,
        raw: includeRaw
          ? {
              relation: relation.relation,
              pointPayloads: enrichment?.rawPoints ?? [],
              recentRunPayloads: recentRuns.map((run) => run.raw).filter((run) => run !== undefined),
            }
          : undefined,
      };
    })
    .filter((testLink) => testLink !== null) as WorkItemTestLinkSummary[];

  return {
    project,
    workItemId: root.id,
    workItem: mapWorkItem(root),
    testLinks,
    totalTestLinks: testLinks.length,
    totalTestCases: visibleTestCasesById.size,
    totalSuites: suiteIdsEncountered.size,
    totalPlans: planIdsEncountered.size,
    totalRecentRuns: recentRunIdsEncountered.size,
    relationTypesEncountered: [...relationTypesEncountered].sort(),
    skippedRelations,
  };
}

function resolveCoverageWorkItemId(input: GetUserStoryTestCoverageInput): number {
  if (input.workItemId !== undefined && input.userStoryId !== undefined && input.workItemId !== input.userStoryId) {
    throw new Error(
      `Received conflicting work item identifiers: workItemId=${input.workItemId} and userStoryId=${input.userStoryId}.`,
    );
  }

  const resolvedId = input.workItemId ?? input.userStoryId;
  if (resolvedId === undefined) {
    throw new Error("Either workItemId or userStoryId must be provided.");
  }

  return resolvedId;
}

async function loadCoverageRunsByKey(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  testLinks: readonly WorkItemTestLinkSummary[],
  includeRaw: boolean,
): Promise<Map<string, TestRunFull>> {
  const runRefs = new Map<string, { readonly project: string; readonly runId: number }>();

  for (const testLink of testLinks) {
    for (const run of testLink.recentRuns) {
      runRefs.set(`${run.project}\u0000${run.id}`, {
        project: run.project,
        runId: run.id,
      });
    }
  }

  const runsByKey = new Map<string, TestRunFull>();

  for (const [key, runRef] of runRefs) {
    const run = await getTestRunFull(client, config, {
      project: runRef.project,
      runId: runRef.runId,
      includeAttachments: false,
      includeSteps: false,
      includeRaw,
    });
    runsByKey.set(key, run);
  }

  return runsByKey;
}

function buildSuiteCoverage(
  linkedTestCases: readonly UserStoryLinkedTestCaseCoverage[],
  testLinks: readonly WorkItemTestLinkSummary[],
): UserStorySuiteCoverageSummary[] {
  const linkByTestCaseId = new Map(testLinks.map((link) => [link.testCaseId, link] as const));
  const coverageBySuiteKey = new Map<
    string,
    {
      readonly suiteId: number;
      readonly suiteName: string | null;
      readonly planId: number | null;
      readonly planName: string | null;
      readonly project: string | null;
      readonly linkedTestCaseIds: Set<number>;
      readonly recentRunIds: Set<number>;
      readonly linkedCases: UserStoryLinkedTestCaseCoverage[];
    }
  >();

  for (const linkedCase of linkedTestCases) {
    const sourceLink = linkByTestCaseId.get(linkedCase.testCaseId);
    for (const suite of sourceLink?.suites ?? []) {
      const key = `${suite.project ?? ""}\u0000${suite.id}`;
      const existing = coverageBySuiteKey.get(key) ?? {
        suiteId: suite.id,
        suiteName: suite.name,
        planId: suite.planId,
        planName: suite.planName,
        project: suite.project,
        linkedTestCaseIds: new Set<number>(),
        recentRunIds: new Set<number>(),
        linkedCases: [],
      };

      if (existing.linkedTestCaseIds.has(linkedCase.testCaseId) === false) {
        existing.linkedCases.push(linkedCase);
      }

      existing.linkedTestCaseIds.add(linkedCase.testCaseId);
      for (const run of linkedCase.recentRuns.filter((run) => run.suiteIds.includes(suite.id))) {
        existing.recentRunIds.add(run.id);
      }

      coverageBySuiteKey.set(key, existing);
    }
  }

  return [...coverageBySuiteKey.values()]
    .map((coverage) => {
      const summary = buildCoverageSummary(coverage.linkedCases);
      return {
        suiteId: coverage.suiteId,
        suiteName: coverage.suiteName,
        planId: coverage.planId,
        planName: coverage.planName,
        project: coverage.project,
        linkedTestCaseIds: sortIds(coverage.linkedTestCaseIds),
        recentRunIds: sortIds(coverage.recentRunIds),
        summary,
        coverageStatus: deriveCoverageStatus(summary),
      };
    })
    .sort((left, right) => left.suiteId - right.suiteId);
}

function buildPlanCoverage(
  linkedTestCases: readonly UserStoryLinkedTestCaseCoverage[],
  testLinks: readonly WorkItemTestLinkSummary[],
): UserStoryPlanCoverageSummary[] {
  const linkByTestCaseId = new Map(testLinks.map((link) => [link.testCaseId, link] as const));
  const coverageByPlanKey = new Map<
    string,
    {
      readonly planId: number;
      readonly planName: string | null;
      readonly project: string | null;
      readonly linkedTestCaseIds: Set<number>;
      readonly recentRunIds: Set<number>;
      readonly linkedCases: UserStoryLinkedTestCaseCoverage[];
    }
  >();

  for (const linkedCase of linkedTestCases) {
    const sourceLink = linkByTestCaseId.get(linkedCase.testCaseId);
    for (const plan of sourceLink?.plans ?? []) {
      const key = `${plan.project ?? ""}\u0000${plan.id}`;
      const existing = coverageByPlanKey.get(key) ?? {
        planId: plan.id,
        planName: plan.name,
        project: plan.project,
        linkedTestCaseIds: new Set<number>(),
        recentRunIds: new Set<number>(),
        linkedCases: [],
      };

      if (existing.linkedTestCaseIds.has(linkedCase.testCaseId) === false) {
        existing.linkedCases.push(linkedCase);
      }

      existing.linkedTestCaseIds.add(linkedCase.testCaseId);
      for (const run of linkedCase.recentRuns.filter((run) => run.planIds.includes(plan.id))) {
        existing.recentRunIds.add(run.id);
      }

      coverageByPlanKey.set(key, existing);
    }
  }

  return [...coverageByPlanKey.values()]
    .map((coverage) => {
      const summary = buildCoverageSummary(coverage.linkedCases);
      return {
        planId: coverage.planId,
        planName: coverage.planName,
        project: coverage.project,
        linkedTestCaseIds: sortIds(coverage.linkedTestCaseIds),
        recentRunIds: sortIds(coverage.recentRunIds),
        summary,
        coverageStatus: deriveCoverageStatus(summary),
      };
    })
    .sort((left, right) => left.planId - right.planId);
}

function buildRecentRunCoverage(
  linkedTestCases: readonly UserStoryLinkedTestCaseCoverage[],
  runByKey: Map<string, TestRunFull>,
): UserStoryRecentRunCoverageSummary[] {
  const coverageByRunKey = new Map<
    string,
    {
      readonly run: WorkItemTestLinkRecentRunSummary;
      readonly linkedTestCaseIds: Set<number>;
      readonly linkedCases: Array<
        Pick<UserStoryLinkedTestCaseCoverage, "suiteIds" | "planIds" | "recentRuns"> & {
          readonly latestOutcome: TestCoverageOutcome;
        }
      >;
    }
  >();

  for (const linkedCase of linkedTestCases) {
    for (const run of linkedCase.recentRuns) {
      const runKey = `${run.project}\u0000${run.id}`;
      const runFull = runByKey.get(runKey);
      const perRunOutcome = runFull
        ? selectLatestResultForTestCase(runFull, linkedCase.testCaseId)?.outcome ?? "unknown"
        : "unknown";
      const existing = coverageByRunKey.get(runKey) ?? {
        run,
        linkedTestCaseIds: new Set<number>(),
        linkedCases: [],
      };

      if (existing.linkedTestCaseIds.has(linkedCase.testCaseId) === false) {
        existing.linkedCases.push({
          suiteIds: linkedCase.suiteIds,
          planIds: linkedCase.planIds,
          recentRuns: [run],
          latestOutcome: perRunOutcome,
        });
      }

      existing.linkedTestCaseIds.add(linkedCase.testCaseId);
      coverageByRunKey.set(runKey, existing);
    }
  }

  return [...coverageByRunKey.values()]
    .map((coverage) => {
      const summary = buildCoverageSummary(coverage.linkedCases);
      return {
        ...coverage.run,
        linkedTestCaseIds: sortIds(coverage.linkedTestCaseIds),
        summary,
        coverageStatus: deriveCoverageStatus(summary),
      };
    })
    .sort((left, right) => {
      const dateDelta =
        getDateSortValue(right.completedDate ?? right.startedDate) -
        getDateSortValue(left.completedDate ?? left.startedDate);
      if (dateDelta !== 0) {
        return dateDelta;
      }

      return right.id - left.id;
    });
}

export async function getUserStoryTestCoverage(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetUserStoryTestCoverageInput,
): Promise<UserStoryTestCoverage> {
  const workItemId = resolveCoverageWorkItemId(input);
  const includeSuites = input.includeSuites !== false;
  const includePlans = input.includePlans !== false;
  const includeRecentRuns = input.includeRecentRuns !== false;
  const includeRaw = input.includeRaw === true;

  const linksSummary = await listWorkItemTestLinks(client, config, {
    project: input.project,
    workItemId,
    includeSuites,
    includePlans,
    includeRecentRuns,
    includeRaw,
  });

  if (linksSummary.testLinks.length === 0) {
    const summary = buildCoverageSummary([]);
    return {
      project: linksSummary.project,
      workItemId: linksSummary.workItemId,
      workItem: linksSummary.workItem,
      summary,
      linkedTestCases: [],
      suiteCoverage: [],
      planCoverage: [],
      recentRuns: [],
      coverageStatus: deriveCoverageStatus(summary),
      raw: includeRaw ? { workItemTestLinks: linksSummary } : undefined,
    };
  }

  const runByKey = includeRecentRuns
    ? await loadCoverageRunsByKey(client, config, linksSummary.testLinks, includeRaw)
    : new Map<string, TestRunFull>();

  const linkedTestCases: UserStoryLinkedTestCaseCoverage[] = linksSummary.testLinks
    .map((link) => ({
      testCaseId: link.testCaseId,
      title: link.testCaseTitle,
      state: link.testCaseState,
      relationType: link.relationType,
      suiteIds: link.suiteIds,
      planIds: link.planIds,
      recentRuns: link.recentRuns,
      latestOutcome: includeRecentRuns ? selectLatestOutcomeForLinkedTestCase(link, runByKey) : "unknown",
      raw: includeRaw ? link.raw : undefined,
    }))
    .sort((left, right) => left.testCaseId - right.testCaseId);

  const summary = buildCoverageSummary(linkedTestCases);
  const suiteCoverage = includeSuites ? buildSuiteCoverage(linkedTestCases, linksSummary.testLinks) : [];
  const planCoverage = includePlans ? buildPlanCoverage(linkedTestCases, linksSummary.testLinks) : [];
  const recentRuns = includeRecentRuns ? buildRecentRunCoverage(linkedTestCases, runByKey) : [];

  return {
    project: linksSummary.project,
    workItemId: linksSummary.workItemId,
    workItem: linksSummary.workItem,
    summary,
    linkedTestCases,
    suiteCoverage,
    planCoverage,
    recentRuns,
    coverageStatus: deriveCoverageStatus(summary),
    raw: includeRaw
      ? {
          workItemTestLinks: linksSummary,
          runs: Object.fromEntries([...runByKey.entries()]),
        }
      : undefined,
  };
}

export async function getRequirementTraceabilityReport(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetRequirementTraceabilityReportInput,
): Promise<RequirementTraceabilityReport> {
  const coverage = await getUserStoryTestCoverage(client, config, {
    project: input.project,
    workItemId: input.workItemId,
    includeSuites: input.includeSuites,
    includePlans: input.includePlans,
    includeRecentRuns: input.includeRecentRuns,
    includeRaw: input.includeRaw,
  });

  const gaps = buildRequirementTraceabilityGaps(coverage.linkedTestCases);
  const traceabilityStatus = deriveRequirementTraceabilityStatus(coverage.coverageStatus, gaps);

  return {
    project: coverage.project,
    workItemId: coverage.workItemId,
    workItem: coverage.workItem,
    summary: coverage.summary,
    linkedTestCases: coverage.linkedTestCases,
    suiteCoverage: coverage.suiteCoverage,
    planCoverage: coverage.planCoverage,
    recentRuns: coverage.recentRuns,
    coverageStatus: coverage.coverageStatus,
    gaps,
    traceabilityStatus,
    raw: input.includeRaw === true ? { coverage } : undefined,
  };
}

export async function listWorkItemLinkTypes(
  client: AzureDevOpsClientLike,
): Promise<WorkItemLinkTypeSummary[]> {
  return listWorkItemLinkTypesInternal(client);
}

export async function getWorkItemRelationsGraph(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: TraceabilityGraphInput,
): Promise<WorkItemRelationsGraph> {
  const result = await buildRelationsGraphInternal(client, config, input);
  return result.graph;
}

export async function listLinkedWorkItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: ListLinkedWorkItemsInput,
): Promise<LinkedWorkItemsSummary> {
  const result = await buildRelationsGraphInternal(client, config, input);
  return buildLinkedWorkItemsSummaryFromGraph(result.graph);
}

export async function getTraceabilityChain(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetTraceabilityChainInput,
): Promise<TraceabilityChainSummary> {
  const result = await buildRelationsGraphInternal(client, config, input);
  const chains = buildTraceabilityChainsFromGraph(result.graph);

  return {
    ...result.graph,
    chains,
    totalChains: chains.length,
  };
}
