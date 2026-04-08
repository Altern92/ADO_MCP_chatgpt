import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type {
  DuplicateCandidateSummary,
  DuplicateCandidatesResult,
  SimilarityClusterSummary,
  SimilarityClustersResult,
  SimilarityReasonKind,
  SimilarityReasonSummary,
  SimilarWorkItemCandidateSummary,
  SimilarWorkItemsResult,
  WorkItemFull,
} from "../models.js";
import { asString, clampTop } from "./shared.js";
import {
  fetchWorkItemFullBaseByIds,
  getWorkItemFull,
  searchWorkItemsAdvanced,
  type SearchWorkItemsAdvancedInput,
} from "./workItems.js";

export interface SimilarityScopeFilters {
  readonly project: string;
  readonly candidateProjects?: readonly string[];
  readonly workItemTypes?: readonly string[];
  readonly states?: readonly string[];
  readonly assignedTo?: string;
  readonly createdBy?: string;
  readonly tags?: readonly string[];
  readonly areaPaths?: readonly string[];
  readonly iterationPaths?: readonly string[];
  readonly text?: string;
  readonly ids?: readonly number[];
  readonly priority?: readonly number[];
  readonly severity?: readonly string[];
  readonly reason?: readonly string[];
  readonly fieldNames?: readonly string[];
  readonly top?: number;
  readonly maxCandidates?: number;
  readonly minScore?: number;
  readonly includeRaw?: boolean;
}

export interface FindSimilarWorkItemsInput extends SimilarityScopeFilters {
  readonly workItemId: number;
}

export interface FindDuplicateCandidatesInput extends SimilarityScopeFilters {
  readonly sourceWorkItemId: number;
}

export interface ClusterWorkItemsBySimilarityInput {
  readonly project: string;
  readonly projects?: readonly string[];
  readonly workItemTypes?: readonly string[];
  readonly states?: readonly string[];
  readonly assignedTo?: string;
  readonly createdBy?: string;
  readonly tags?: readonly string[];
  readonly areaPaths?: readonly string[];
  readonly iterationPaths?: readonly string[];
  readonly text?: string;
  readonly ids?: readonly number[];
  readonly priority?: readonly number[];
  readonly severity?: readonly string[];
  readonly reason?: readonly string[];
  readonly fieldNames?: readonly string[];
  readonly maxItems?: number;
  readonly minScore?: number;
  readonly minClusterSize?: number;
  readonly includeRaw?: boolean;
}

interface WorkItemSimilarityProfile {
  readonly item: WorkItemFull;
  readonly titleTokens: readonly string[];
  readonly descriptionTokens: readonly string[];
  readonly tags: readonly string[];
  readonly areaSegments: readonly string[];
  readonly iterationSegments: readonly string[];
  readonly assignedTo: string | null;
  readonly createdBy: string | null;
  readonly workItemType: string | null;
  readonly fieldValues: Record<string, string>;
  readonly artifactKeys: readonly string[];
}

export interface SimilarityAssessment {
  readonly similarityScore: number;
  readonly duplicateScore: number;
  readonly reasons: readonly SimilarityReasonSummary[];
  readonly signals: Record<string, unknown>;
}

interface SimilarityEdge {
  readonly leftId: number;
  readonly rightId: number;
  readonly score: number;
  readonly reasons: readonly SimilarityReasonSummary[];
}

const DEFAULT_SIMILARITY_TOP = 10;
const DEFAULT_SIMILARITY_MAX_CANDIDATES = 50;
const DEFAULT_SIMILARITY_THRESHOLD = 0.25;
const DEFAULT_DUPLICATE_THRESHOLD = 0.55;
const DEFAULT_CLUSTER_THRESHOLD = 0.45;
const DEFAULT_MIN_CLUSTER_SIZE = 2;
const MAX_SIMILARITY_MAX_CANDIDATES = 200;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
]);

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeStringList(values: readonly string[] | undefined): string[] {
  const normalized = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    normalized.add(trimmed);
  }

  return [...normalized];
}

function normalizeFieldNames(values: readonly string[] | undefined): string[] {
  const normalized = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    normalized.add(trimmed.toLowerCase());
  }

  return [...normalized];
}

function tokenizeText(value: string | null | undefined): string[] {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function tokenizeTitleTerms(value: string | null | undefined): string[] {
  return tokenizeText(value).filter((token) => !STOP_WORDS.has(token));
}

function uniqueTokens(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function splitPath(value: string | null | undefined): string[] {
  const normalized = value?.trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split("\\")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
}

function splitTags(value: string | null | undefined): string[] {
  const normalized = value?.trim();
  if (!normalized) {
    return [];
  }

  return uniqueTokens(
    normalized
      .split(";")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  );
}

function normalizeScalar(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      normalizeText(asString(record.displayName)) ??
      normalizeText(asString(record.uniqueName)) ??
      normalizeText(asString(record.descriptor)) ??
      normalizeText(asString(record.id)) ??
      normalizeText(asString(record.name))
    );
  }

  return null;
}

function jaccardSimilarity(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  if (intersection === 0) {
    return 0;
  }

  const union = leftSet.size + rightSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function pathSimilarity(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  let sharedPrefix = 0;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      break;
    }

    sharedPrefix += 1;
  }

  if (sharedPrefix < 2) {
    return 0;
  }

  return sharedPrefix / maxLength;
}

function intersectValues(left: readonly string[], right: readonly string[]): string[] {
  if (left.length === 0 || right.length === 0) {
    return [];
  }

  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function buildFieldValues(item: WorkItemFull, fieldNames: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const fieldName of fieldNames) {
    const matchKey = Object.keys(item.fields).find((key) => key.toLowerCase() === fieldName);
    if (!matchKey) {
      continue;
    }

    const normalized = normalizeScalar(item.fields[matchKey]);
    if (normalized) {
      values[fieldName] = normalized;
    }
  }

  return values;
}

function buildArtifactKeys(item: WorkItemFull): string[] {
  const keys = new Set<string>();

  for (const relation of item.relations ?? []) {
    if ((relation.rel ?? "").toLowerCase() !== "artifactlink") {
      continue;
    }

    const normalized = normalizeText(relation.url);
    if (normalized) {
      keys.add(normalized);
    }
  }

  return [...keys];
}

function buildProfile(item: WorkItemFull, fieldNames: readonly string[]): WorkItemSimilarityProfile {
  return {
    item,
    titleTokens: uniqueTokens(tokenizeText(item.title)),
    descriptionTokens: uniqueTokens(tokenizeText(item.description)),
    tags: splitTags(item.tags),
    areaSegments: splitPath(item.areaPath),
    iterationSegments: splitPath(item.iterationPath),
    assignedTo: normalizeText(item.assignedTo),
    createdBy: normalizeText(item.createdBy),
    workItemType: normalizeText(item.workItemType),
    fieldValues: buildFieldValues(item, fieldNames),
    artifactKeys: buildArtifactKeys(item),
  };
}

function pushReason(
  reasons: SimilarityReasonSummary[],
  kind: SimilarityReasonKind,
  score: number,
  description: string,
): void {
  if (score <= 0) {
    return;
  }

  reasons.push({
    kind,
    score: roundScore(score),
    description,
  });
}

export function assessWorkItemSimilarity(
  source: WorkItemFull,
  candidate: WorkItemFull,
  fieldNames: readonly string[] = [],
): SimilarityAssessment {
  const normalizedFieldNames = normalizeFieldNames(fieldNames);
  const sourceProfile = buildProfile(source, normalizedFieldNames);
  const candidateProfile = buildProfile(candidate, normalizedFieldNames);
  const reasons: SimilarityReasonSummary[] = [];

  const titleSimilarity = jaccardSimilarity(sourceProfile.titleTokens, candidateProfile.titleTokens);
  if (titleSimilarity >= 0.2) {
    pushReason(
      reasons,
      "title",
      0.35 * titleSimilarity,
      `Title tokens overlap at ${Math.round(titleSimilarity * 100)}%.`,
    );
  }

  const descriptionSimilarity = jaccardSimilarity(
    sourceProfile.descriptionTokens,
    candidateProfile.descriptionTokens,
  );
  if (descriptionSimilarity >= 0.15) {
    pushReason(
      reasons,
      "description",
      0.2 * descriptionSimilarity,
      `Description tokens overlap at ${Math.round(descriptionSimilarity * 100)}%.`,
    );
  }

  const tagSimilarity = jaccardSimilarity(sourceProfile.tags, candidateProfile.tags);
  if (tagSimilarity > 0) {
    const sharedTags = intersectValues(sourceProfile.tags, candidateProfile.tags).slice(0, 5);
    pushReason(
      reasons,
      "tags",
      0.15 * tagSimilarity,
      sharedTags.length > 0
        ? `Shared tags: ${sharedTags.join(", ")}.`
        : `Tag overlap at ${Math.round(tagSimilarity * 100)}%.`,
    );
  }

  const areaSimilarity = pathSimilarity(sourceProfile.areaSegments, candidateProfile.areaSegments);
  if (areaSimilarity >= 0.5) {
    pushReason(
      reasons,
      "areaPath",
      0.1 * areaSimilarity,
      areaSimilarity === 1
        ? "Area path matches exactly."
        : "Area path shares the same hierarchy prefix.",
    );
  }

  const iterationSimilarity = pathSimilarity(
    sourceProfile.iterationSegments,
    candidateProfile.iterationSegments,
  );
  if (iterationSimilarity >= 0.5) {
    pushReason(
      reasons,
      "iterationPath",
      0.05 * iterationSimilarity,
      iterationSimilarity === 1
        ? "Iteration path matches exactly."
        : "Iteration path shares the same hierarchy prefix.",
    );
  }

  if (
    sourceProfile.workItemType &&
    sourceProfile.workItemType === candidateProfile.workItemType
  ) {
    pushReason(reasons, "workItemType", 0.05, "Work item type matches.");
  }

  if (sourceProfile.assignedTo && sourceProfile.assignedTo === candidateProfile.assignedTo) {
    pushReason(reasons, "assignedTo", 0.05, "Assigned-to identity matches.");
  }

  if (sourceProfile.createdBy && sourceProfile.createdBy === candidateProfile.createdBy) {
    pushReason(reasons, "createdBy", 0.03, "Created-by identity matches.");
  }

  const matchedFields = Object.entries(sourceProfile.fieldValues).filter(
    ([fieldName, value]) => candidateProfile.fieldValues[fieldName] === value,
  );
  if (matchedFields.length > 0) {
    const customFieldScore = Math.min(0.12, matchedFields.length * 0.04);
    pushReason(
      reasons,
      "customField",
      customFieldScore,
      `Matching custom fields: ${matchedFields.map(([fieldName]) => fieldName).join(", ")}.`,
    );
  }

  const sharedArtifacts = intersectValues(sourceProfile.artifactKeys, candidateProfile.artifactKeys);
  if (sharedArtifacts.length > 0) {
    pushReason(
      reasons,
      "linkedArtifact",
      Math.min(0.1, sharedArtifacts.length * 0.05),
      `${sharedArtifacts.length} shared linked artifact(s).`,
    );
  }

  reasons.sort((left, right) => right.score - left.score || left.kind.localeCompare(right.kind));

  const similarityScore = roundScore(
    Math.min(
      1,
      reasons.reduce((total, reason) => total + reason.score, 0),
    ),
  );

  const duplicateScore = roundScore(
    Math.min(
      1,
      similarityScore +
        (titleSimilarity >= 0.75 ? 0.15 : 0) +
        (descriptionSimilarity >= 0.5 ? 0.08 : 0) +
        (tagSimilarity >= 0.5 ? 0.05 : 0) +
        (areaSimilarity === 1 ? 0.05 : 0) +
        (sharedArtifacts.length > 0 ? 0.1 : 0),
    ),
  );

  return {
    similarityScore,
    duplicateScore,
    reasons,
    signals: {
      titleSimilarity: roundScore(titleSimilarity),
      descriptionSimilarity: roundScore(descriptionSimilarity),
      tagSimilarity: roundScore(tagSimilarity),
      areaSimilarity: roundScore(areaSimilarity),
      iterationSimilarity: roundScore(iterationSimilarity),
      sameWorkItemType:
        sourceProfile.workItemType !== null &&
        sourceProfile.workItemType === candidateProfile.workItemType,
      sameAssignedTo:
        sourceProfile.assignedTo !== null &&
        sourceProfile.assignedTo === candidateProfile.assignedTo,
      sameCreatedBy:
        sourceProfile.createdBy !== null &&
        sourceProfile.createdBy === candidateProfile.createdBy,
      matchingFieldNames: matchedFields.map(([fieldName]) => fieldName),
      sharedArtifacts: sharedArtifacts.length,
    },
  };
}

function normalizeCandidateProjects(
  sourceProject: string,
  explicitProjects: readonly string[] | undefined,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): string[] {
  const normalized = normalizeStringList(explicitProjects);
  const projects = normalized.length > 0 ? normalized : [sourceProject];

  for (const project of projects) {
    assertProjectAllowed(project, config);
  }

  return [...new Set(projects)];
}

function normalizeScopeProjects(
  project: string,
  explicitProjects: readonly string[] | undefined,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): string[] {
  const normalized = normalizeStringList(explicitProjects);
  const projects = normalized.length > 0 ? normalized : [project];

  for (const scopedProject of projects) {
    assertProjectAllowed(scopedProject, config);
  }

  return [...new Set(projects)];
}

function normalizeMaxCandidates(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_SIMILARITY_MAX_CANDIDATES;
  }

  return Math.max(1, Math.min(MAX_SIMILARITY_MAX_CANDIDATES, Math.floor(value)));
}

function normalizeScore(value: number | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(0, Math.min(1, value));
}

function buildSearchInput(
  project: string,
  input:
    | SimilarityScopeFilters
    | ClusterWorkItemsBySimilarityInput,
  top: number,
): SearchWorkItemsAdvancedInput {
  return {
    project,
    workItemTypes: input.workItemTypes,
    states: input.states,
    assignedTo: input.assignedTo,
    createdBy: input.createdBy,
    tags: input.tags,
    areaPaths: input.areaPaths,
    iterationPaths: input.iterationPaths,
    text: input.text,
    ids: input.ids,
    priority: input.priority,
    severity: input.severity,
    reason: input.reason,
    top,
    orderBy: [
      {
        field: "changedDate",
        direction: "desc",
      },
    ],
  };
}

async function loadScopeWorkItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  projects: readonly string[],
  input:
    | SimilarityScopeFilters
    | ClusterWorkItemsBySimilarityInput,
  maxItems: number,
  includeRaw: boolean,
): Promise<WorkItemFull[]> {
  const orderedIds: number[] = [];
  const seenIds = new Set<number>();

  for (const project of projects) {
    const searchResult = await searchWorkItemsAdvanced(
      client,
      config,
      buildSearchInput(project, input, maxItems),
    );

    for (const workItem of searchResult.workItems) {
      if (seenIds.has(workItem.id)) {
        continue;
      }

      seenIds.add(workItem.id);
      orderedIds.push(workItem.id);

      if (orderedIds.length >= maxItems) {
        break;
      }
    }

    if (orderedIds.length >= maxItems) {
      break;
    }
  }

  return fetchWorkItemFullBaseByIds(client, orderedIds, {
    expand: "relations",
    includeRaw,
    includeRelations: true,
    includeLinks: false,
  });
}

function toSimilarCandidateSummary(
  candidate: WorkItemFull,
  assessment: SimilarityAssessment,
  includeRaw: boolean,
): SimilarWorkItemCandidateSummary {
  return {
    candidateId: candidate.id,
    title: candidate.title,
    state: candidate.state,
    project: candidate.project,
    workItemType: candidate.workItemType,
    url: candidate.url,
    similarityScore: assessment.similarityScore,
    reasons: assessment.reasons,
    ...(includeRaw
      ? {
          raw: {
            candidate,
            signals: assessment.signals,
          },
        }
      : {}),
  };
}

function toDuplicateCandidateSummary(
  sourceWorkItemId: number,
  candidate: WorkItemFull,
  assessment: SimilarityAssessment,
  includeRaw: boolean,
): DuplicateCandidateSummary {
  return {
    sourceWorkItemId,
    candidateId: candidate.id,
    title: candidate.title,
    state: candidate.state,
    project: candidate.project,
    workItemType: candidate.workItemType,
    url: candidate.url,
    duplicateScore: assessment.duplicateScore,
    reasons: assessment.reasons,
    signals: assessment.signals,
    ...(includeRaw
      ? {
          raw: {
            candidate,
            signals: assessment.signals,
          },
        }
      : {}),
  };
}

function clusterLabel(members: readonly WorkItemFull[], commonSignals: readonly string[]): string {
  const typeCounts = new Map<string, number>();
  const titleCounts = new Map<string, number>();

  for (const member of members) {
    const workItemType = member.workItemType?.trim();
    if (workItemType) {
      typeCounts.set(workItemType, (typeCounts.get(workItemType) ?? 0) + 1);
    }

    for (const token of tokenizeTitleTerms(member.title)) {
      titleCounts.set(token, (titleCounts.get(token) ?? 0) + 1);
    }
  }

  const dominantType =
    [...typeCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ??
    "work items";
  const dominantTerms = [...titleCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([token]) => token);

  if (dominantTerms.length > 0) {
    return `${members.length} ${dominantType} around ${dominantTerms.join(", ")}`;
  }

  if (commonSignals.length > 0) {
    return `${members.length} ${dominantType} with ${commonSignals[0]}`;
  }

  return `${members.length} related ${dominantType}`;
}

export function clusterSimilarityCandidates(
  items: readonly WorkItemFull[],
  fieldNames: readonly string[] = [],
  minScore = DEFAULT_CLUSTER_THRESHOLD,
  minClusterSize = DEFAULT_MIN_CLUSTER_SIZE,
  includeRaw = false,
): SimilarityClusterSummary[] {
  if (items.length < 2) {
    return [];
  }

  const parents = new Map<number, number>();
  const itemById = new Map<number, WorkItemFull>();
  const edges: SimilarityEdge[] = [];

  function find(id: number): number {
    const currentParent = parents.get(id) ?? id;
    if (currentParent === id) {
      return id;
    }

    const root = find(currentParent);
    parents.set(id, root);
    return root;
  }

  function union(left: number, right: number): void {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parents.set(rightRoot, leftRoot);
    }
  }

  for (const item of items) {
    parents.set(item.id, item.id);
    itemById.set(item.id, item);
  }

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const assessment = assessWorkItemSimilarity(
        items[leftIndex],
        items[rightIndex],
        fieldNames,
      );
      if (assessment.similarityScore < minScore) {
        continue;
      }

      union(items[leftIndex].id, items[rightIndex].id);
      edges.push({
        leftId: items[leftIndex].id,
        rightId: items[rightIndex].id,
        score: assessment.similarityScore,
        reasons: assessment.reasons,
      });
    }
  }

  const groups = new Map<number, number[]>();
  for (const item of items) {
    const root = find(item.id);
    const group = groups.get(root) ?? [];
    group.push(item.id);
    groups.set(root, group);
  }

  const clusters = [...groups.values()]
    .filter((memberIds) => memberIds.length >= minClusterSize)
    .map((memberIds, index) => {
      const sortedMemberIds = [...memberIds].sort((left, right) => left - right);
      const members = sortedMemberIds
        .map((memberId) => itemById.get(memberId))
        .filter((item): item is WorkItemFull => item !== undefined);
      const clusterEdges = edges.filter(
        (edge) => sortedMemberIds.includes(edge.leftId) && sortedMemberIds.includes(edge.rightId),
      );
      const commonSignals = [...new Set(clusterEdges.flatMap((edge) => edge.reasons.map((reason) => reason.description)))]
        .slice(0, 5);

      return {
        clusterId: `cluster-${index + 1}`,
        memberIds: sortedMemberIds,
        summary: clusterLabel(members, commonSignals),
        commonSignals,
        ...(includeRaw
          ? {
              raw: {
                members,
                edges: clusterEdges,
              },
            }
          : {}),
      };
    })
    .sort(
      (left, right) =>
        right.memberIds.length - left.memberIds.length || left.clusterId.localeCompare(right.clusterId),
    );

  return clusters;
}

export async function findSimilarWorkItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: FindSimilarWorkItemsInput,
): Promise<SimilarWorkItemsResult> {
  const project = input.project.trim();
  assertProjectAllowed(project, config);

  const includeRaw = input.includeRaw === true;
  const fieldNames = normalizeFieldNames(input.fieldNames);
  const top = clampTop(input.top, DEFAULT_SIMILARITY_TOP);
  const maxCandidates = normalizeMaxCandidates(input.maxCandidates);
  const minScore = normalizeScore(input.minScore, DEFAULT_SIMILARITY_THRESHOLD);
  const candidateProjects = normalizeCandidateProjects(project, input.candidateProjects, config);
  const source = await getWorkItemFull(client, config, {
    id: input.workItemId,
    project,
    expand: "relations",
    includeRelations: true,
    includeRaw,
  });
  const candidates = await loadScopeWorkItems(
    client,
    config,
    candidateProjects,
    input,
    maxCandidates,
    includeRaw,
  );

  const matchedCandidates = candidates
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => ({
      candidate,
      assessment: assessWorkItemSimilarity(source, candidate, fieldNames),
    }))
    .filter(({ assessment }) => assessment.similarityScore >= minScore)
    .sort(
      (left, right) =>
        right.assessment.similarityScore - left.assessment.similarityScore ||
        left.candidate.id - right.candidate.id,
    );

  return {
    project,
    workItemId: source.id,
    total: matchedCandidates.length,
    candidates: matchedCandidates
      .slice(0, top)
      .map(({ candidate, assessment }) =>
        toSimilarCandidateSummary(candidate, assessment, includeRaw),
      ),
  };
}

export async function findDuplicateCandidates(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: FindDuplicateCandidatesInput,
): Promise<DuplicateCandidatesResult> {
  const project = input.project.trim();
  assertProjectAllowed(project, config);

  const includeRaw = input.includeRaw === true;
  const fieldNames = normalizeFieldNames(input.fieldNames);
  const top = clampTop(input.top, DEFAULT_SIMILARITY_TOP);
  const maxCandidates = normalizeMaxCandidates(input.maxCandidates);
  const minScore = normalizeScore(input.minScore, DEFAULT_DUPLICATE_THRESHOLD);
  const candidateProjects = normalizeCandidateProjects(project, input.candidateProjects, config);
  const source = await getWorkItemFull(client, config, {
    id: input.sourceWorkItemId,
    project,
    expand: "relations",
    includeRelations: true,
    includeRaw,
  });
  const candidates = await loadScopeWorkItems(
    client,
    config,
    candidateProjects,
    input,
    maxCandidates,
    includeRaw,
  );

  const duplicates = candidates
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => ({
      candidate,
      assessment: assessWorkItemSimilarity(source, candidate, fieldNames),
    }))
    .filter(({ assessment }) => assessment.duplicateScore >= minScore)
    .sort(
      (left, right) =>
        right.assessment.duplicateScore - left.assessment.duplicateScore ||
        left.candidate.id - right.candidate.id,
    );

  return {
    project,
    sourceWorkItemId: source.id,
    total: duplicates.length,
    candidates: duplicates
      .slice(0, top)
      .map(({ candidate, assessment }) =>
        toDuplicateCandidateSummary(source.id, candidate, assessment, includeRaw),
      ),
  };
}

export async function clusterWorkItemsBySimilarity(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: ClusterWorkItemsBySimilarityInput,
): Promise<SimilarityClustersResult> {
  const project = input.project.trim();
  assertProjectAllowed(project, config);

  const includeRaw = input.includeRaw === true;
  const fieldNames = normalizeFieldNames(input.fieldNames);
  const maxItems = normalizeMaxCandidates(input.maxItems);
  const minScore = normalizeScore(input.minScore, DEFAULT_CLUSTER_THRESHOLD);
  const minClusterSize = Math.max(2, Math.floor(input.minClusterSize ?? DEFAULT_MIN_CLUSTER_SIZE));
  const projects = normalizeScopeProjects(project, input.projects, config);
  const items = await loadScopeWorkItems(client, config, projects, input, maxItems, includeRaw);
  const clusters = clusterSimilarityCandidates(
    items,
    fieldNames,
    minScore,
    minClusterSize,
    includeRaw,
  );

  return {
    project,
    totalClusters: clusters.length,
    clusters,
  };
}
