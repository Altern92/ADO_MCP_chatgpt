import { DEFAULT_TOP, MAX_TOP } from "../constants.js";
import { assertProjectAllowed, isProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type {
  WorkItemCategorySummary,
  WorkItemCommentsList,
  ExportedWorkItemsFullSummary,
  WorkItemFull,
  WorkItemRevisionsList,
  WorkItemRelationSummary,
  WorkItemSummary,
  WorkItemUpdatesList,
  WorkItemTypeSummary,
} from "../models.js";
import {
  asInteger,
  asString,
  clampTop,
  ensureArray,
  mapWorkItem,
  mapWorkItemAttachment,
  mapWorkItemComment,
  mapWorkItemFull,
  mapWorkItemCategory,
  mapWorkItemType,
  mapWorkItemRevision,
  mapWorkItemUpdate,
  WORK_ITEM_FIELDS,
} from "./shared.js";

export interface SearchWorkItemsInput {
  readonly project?: string;
  readonly assignedToMe?: boolean;
  readonly state?: string;
  readonly text?: string;
  readonly top?: number;
}

export type WorkItemSearchOrderField =
  | "id"
  | "title"
  | "state"
  | "workItemType"
  | "assignedTo"
  | "createdDate"
  | "changedDate"
  | "closedDate"
  | "resolvedDate"
  | "priority"
  | "severity"
  | "areaPath"
  | "iterationPath";

export type WorkItemSearchOrderDirection = "asc" | "desc";

export interface WorkItemSearchOrderBy {
  readonly field: WorkItemSearchOrderField;
  readonly direction?: WorkItemSearchOrderDirection;
}

interface NormalizedWorkItemSearchOrderBy {
  readonly field: WorkItemSearchOrderField;
  readonly direction: WorkItemSearchOrderDirection;
}

export interface SearchWorkItemsAdvancedInput {
  readonly project: string;
  readonly workItemTypes?: readonly string[];
  readonly categoryReferenceNames?: readonly string[];
  readonly categoryNames?: readonly string[];
  readonly states?: readonly string[];
  readonly assignedTo?: string;
  readonly createdBy?: string;
  readonly changedBy?: string;
  readonly tags?: readonly string[];
  readonly tagsAny?: readonly string[];
  readonly tagsAll?: readonly string[];
  readonly areaPaths?: readonly string[];
  readonly iterationPaths?: readonly string[];
  readonly text?: string;
  readonly ids?: readonly number[];
  readonly priority?: readonly number[];
  readonly severity?: readonly string[];
  readonly reason?: readonly string[];
  readonly createdDateFrom?: string;
  readonly createdDateTo?: string;
  readonly changedDateFrom?: string;
  readonly changedDateTo?: string;
  readonly closedDateFrom?: string;
  readonly closedDateTo?: string;
  readonly resolvedDateFrom?: string;
  readonly resolvedDateTo?: string;
  readonly top?: number;
  readonly orderBy?: readonly WorkItemSearchOrderBy[];
}

export interface GetWorkItemFullInput {
  readonly id: number;
  readonly project?: string;
  readonly expand?: "none" | "fields" | "relations" | "links" | "all";
  readonly includeRelations?: boolean;
  readonly includeLinks?: boolean;
  readonly includeComments?: boolean;
  readonly includeUpdates?: boolean;
  readonly includeRevisions?: boolean;
  readonly includeAttachments?: boolean;
  readonly includeRaw?: boolean;
}

export interface ListWorkItemTypesInput {
  readonly project: string;
  readonly includeRaw?: boolean;
}

export interface WorkItemAuditInput {
  readonly id: number;
  readonly project?: string;
  readonly pageSize?: number;
  readonly includeRaw?: boolean;
}

export interface ExportWorkItemsFullInput extends SearchWorkItemsAdvancedInput {
  readonly expand?: "none" | "fields" | "relations" | "links" | "all";
  readonly includeRelations?: boolean;
  readonly includeLinks?: boolean;
  readonly includeComments?: boolean;
  readonly includeUpdates?: boolean;
  readonly includeRevisions?: boolean;
  readonly includeAttachments?: boolean;
  readonly includeRaw?: boolean;
  readonly maxItems?: number;
}

interface NormalizedGetWorkItemFullInput {
  readonly id: number;
  readonly project?: string;
  readonly expand: "none" | "fields" | "relations" | "links" | "all";
  readonly includeRelations: boolean;
  readonly includeLinks: boolean;
  readonly includeComments: boolean;
  readonly includeUpdates: boolean;
  readonly includeRevisions: boolean;
  readonly includeAttachments: boolean;
  readonly includeRaw: boolean;
}

interface NormalizedWorkItemAuditInput {
  readonly id: number;
  readonly project?: string;
  readonly pageSize: number;
  readonly includeRaw: boolean;
}

interface NormalizedWorkItemFullLoadOptions {
  readonly expand: "none" | "fields" | "relations" | "links" | "all";
  readonly includeRelations: boolean;
  readonly includeLinks: boolean;
  readonly includeComments: boolean;
  readonly includeUpdates: boolean;
  readonly includeRevisions: boolean;
  readonly includeAttachments: boolean;
  readonly includeRaw: boolean;
}

export interface SearchWorkItemsAdvancedQuery {
  readonly project: string;
  readonly workItemTypes: readonly string[];
  readonly categoryReferenceNames: readonly string[];
  readonly categoryNames: readonly string[];
  readonly resolvedWorkItemTypes: readonly string[];
  readonly states: readonly string[];
  readonly assignedTo: string | null;
  readonly createdBy: string | null;
  readonly changedBy: string | null;
  readonly tagsAny: readonly string[];
  readonly tagsAll: readonly string[];
  readonly areaPaths: readonly string[];
  readonly iterationPaths: readonly string[];
  readonly text: string | null;
  readonly ids: readonly number[];
  readonly priority: readonly number[];
  readonly severity: readonly string[];
  readonly reason: readonly string[];
  readonly createdDateFrom: string | null;
  readonly createdDateTo: string | null;
  readonly changedDateFrom: string | null;
  readonly changedDateTo: string | null;
  readonly closedDateFrom: string | null;
  readonly closedDateTo: string | null;
  readonly resolvedDateFrom: string | null;
  readonly resolvedDateTo: string | null;
  readonly top: number;
  readonly orderBy: readonly NormalizedWorkItemSearchOrderBy[];
}

interface AdvancedWorkItemSearchExecution {
  readonly query: SearchWorkItemsAdvancedQuery;
  readonly ids: readonly number[];
}

interface CommentHistoryLoadResult {
  readonly comments: readonly ReturnType<typeof mapWorkItemComment>[];
  readonly totalCount: number;
  readonly pagesFetched: number;
}

interface UpdateHistoryLoadResult {
  readonly updates: readonly ReturnType<typeof mapWorkItemUpdate>[];
  readonly pagesFetched: number;
}

interface RevisionHistoryLoadResult {
  readonly revisions: readonly ReturnType<typeof mapWorkItemRevision>[];
  readonly pagesFetched: number;
}

const WORK_ITEM_BULK_BATCH_SIZE = 100;
const DEFAULT_WORK_ITEM_AUDIT_PAGE_SIZE = 200;
const MAX_WORK_ITEM_AUDIT_PAGE_SIZE = 200;
const DEFAULT_EXPORT_MAX_ITEMS = 100;
const MAX_EXPORT_MAX_ITEMS = 200;

const WIQL_ORDERABLE_FIELDS: Record<WorkItemSearchOrderField, string> = {
  id: "System.Id",
  title: "System.Title",
  state: "System.State",
  workItemType: "System.WorkItemType",
  assignedTo: "System.AssignedTo",
  createdDate: "System.CreatedDate",
  changedDate: "System.ChangedDate",
  closedDate: "Microsoft.VSTS.Common.ClosedDate",
  resolvedDate: "Microsoft.VSTS.Common.ResolvedDate",
  priority: "Microsoft.VSTS.Common.Priority",
  severity: "Microsoft.VSTS.Common.Severity",
  areaPath: "System.AreaPath",
  iterationPath: "System.IterationPath",
};

function formatWiqlField(fieldReferenceName: string): string {
  return `[${fieldReferenceName}]`;
}

function escapeWiqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildAllowedProjectsClause(allowlist: readonly string[]): string | null {
  if (allowlist.length === 0) {
    return null;
  }

  if (allowlist.length === 1) {
    return `${formatWiqlField("System.TeamProject")} = '${escapeWiqlLiteral(allowlist[0])}'`;
  }

  const projects = allowlist
    .map((project) => `'${escapeWiqlLiteral(project)}'`)
    .join(", ");

  return `${formatWiqlField("System.TeamProject")} IN (${projects})`;
}

function normalizeString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

function clampPositiveInt(
  value: number | undefined,
  defaultValue: number,
  maxValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(1, Math.min(maxValue, Math.floor(value)));
}

function normalizeIntegerList(values: readonly number[] | undefined): number[] {
  const normalized = new Set<number>();

  for (const value of values ?? []) {
    if (!Number.isInteger(value)) {
      continue;
    }

    normalized.add(value);
  }

  return [...normalized];
}

function normalizeOrderBy(
  orderBy: readonly WorkItemSearchOrderBy[] | undefined,
): NormalizedWorkItemSearchOrderBy[] {
  if (!orderBy || orderBy.length === 0) {
    return [{ field: "changedDate", direction: "desc" }];
  }

  return orderBy.map((item) => ({
    field: item.field,
    direction: item.direction === "asc" ? "asc" : "desc",
  }));
}

function buildStringEqualsClause(
  fieldReferenceName: string,
  values: readonly string[],
): string | null {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return `${formatWiqlField(fieldReferenceName)} = '${escapeWiqlLiteral(values[0] ?? "")}'`;
  }

  const joinedValues = values
    .map((value) => `'${escapeWiqlLiteral(value)}'`)
    .join(", ");

  return `${formatWiqlField(fieldReferenceName)} IN (${joinedValues})`;
}

function buildNumberEqualsClause(
  fieldReferenceName: string,
  values: readonly number[],
): string | null {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return `${formatWiqlField(fieldReferenceName)} = ${values[0]}`;
  }

  return `${formatWiqlField(fieldReferenceName)} IN (${values.join(", ")})`;
}

function buildContainsClause(
  fieldReferenceName: string,
  values: readonly string[],
  joiner: "AND" | "OR",
): string | null {
  if (values.length === 0) {
    return null;
  }

  const clauses = values.map(
    (value) => `${formatWiqlField(fieldReferenceName)} CONTAINS '${escapeWiqlLiteral(value)}'`,
  );

  if (clauses.length === 1) {
    return clauses[0] ?? null;
  }

  return `(${clauses.join(` ${joiner} `)})`;
}

function buildUnderClause(fieldReferenceName: string, values: readonly string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  const clauses = values.map(
    (value) => `${formatWiqlField(fieldReferenceName)} UNDER '${escapeWiqlLiteral(value)}'`,
  );

  if (clauses.length === 1) {
    return clauses[0] ?? null;
  }

  return `(${clauses.join(" OR ")})`;
}

function buildDateClause(
  fieldReferenceName: string,
  operator: ">=" | "<=",
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  return `${formatWiqlField(fieldReferenceName)} ${operator} '${escapeWiqlLiteral(value)}'`;
}

function intersectStringLists(
  left: readonly string[],
  right: readonly string[],
): string[] {
  const rightValues = new Set(right.map((value) => value.toLowerCase()));
  return left.filter((value) => rightValues.has(value.toLowerCase()));
}

function normalizeSearchWorkItemsAdvancedInput(
  input: SearchWorkItemsAdvancedInput,
  maxTop = MAX_TOP,
): Omit<SearchWorkItemsAdvancedQuery, "resolvedWorkItemTypes"> {
  return {
    project: input.project.trim(),
    workItemTypes: normalizeStringList(input.workItemTypes),
    categoryReferenceNames: normalizeStringList(input.categoryReferenceNames),
    categoryNames: normalizeStringList(input.categoryNames),
    states: normalizeStringList(input.states),
    assignedTo: normalizeString(input.assignedTo),
    createdBy: normalizeString(input.createdBy),
    changedBy: normalizeString(input.changedBy),
    tagsAny: normalizeStringList([...(input.tags ?? []), ...(input.tagsAny ?? [])]),
    tagsAll: normalizeStringList(input.tagsAll),
    areaPaths: normalizeStringList(input.areaPaths),
    iterationPaths: normalizeStringList(input.iterationPaths),
    text: normalizeString(input.text),
    ids: normalizeIntegerList(input.ids),
    priority: normalizeIntegerList(input.priority),
    severity: normalizeStringList(input.severity),
    reason: normalizeStringList(input.reason),
    createdDateFrom: normalizeString(input.createdDateFrom),
    createdDateTo: normalizeString(input.createdDateTo),
    changedDateFrom: normalizeString(input.changedDateFrom),
    changedDateTo: normalizeString(input.changedDateTo),
    closedDateFrom: normalizeString(input.closedDateFrom),
    closedDateTo: normalizeString(input.closedDateTo),
    resolvedDateFrom: normalizeString(input.resolvedDateFrom),
    resolvedDateTo: normalizeString(input.resolvedDateTo),
    top: clampPositiveInt(input.top, DEFAULT_TOP, maxTop),
    orderBy: normalizeOrderBy(input.orderBy),
  };
}

function normalizeProject(project: string | undefined): string | undefined {
  const trimmed = project?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeWorkItemExpand(
  value: GetWorkItemFullInput["expand"],
): NormalizedGetWorkItemFullInput["expand"] {
  switch (value) {
    case "fields":
    case "relations":
    case "links":
    case "all":
      return value;
    default:
      return "none";
  }
}

function pickWorkItemExpand(
  requestedExpand: NormalizedWorkItemFullLoadOptions["expand"],
  includeRelations: boolean,
  includeLinks: boolean,
): NormalizedWorkItemFullLoadOptions["expand"] {
  const needsRelations = includeRelations;
  const needsLinks = includeLinks;

  if (
    requestedExpand === "all" ||
    (requestedExpand === "relations" && needsLinks) ||
    (requestedExpand === "links" && needsRelations) ||
    (requestedExpand === "fields" && needsRelations && needsLinks) ||
    (requestedExpand === "none" && needsRelations && needsLinks)
  ) {
    return needsRelations && needsLinks ? "all" : requestedExpand;
  }

  if (needsRelations) {
    return requestedExpand === "links" ? "all" : "relations";
  }

  if (needsLinks) {
    return requestedExpand === "relations" ? "all" : "links";
  }

  return requestedExpand;
}

function normalizeWorkItemFullLoadOptions(
  input: Omit<GetWorkItemFullInput, "id" | "project">,
): NormalizedWorkItemFullLoadOptions {
  const requestedExpand = normalizeWorkItemExpand(input.expand);
  const includeAttachments = input.includeAttachments === true;
  const includeRelations =
    input.includeRelations === true ||
    includeAttachments ||
    requestedExpand === "relations" ||
    requestedExpand === "all";
  const includeLinks =
    input.includeLinks === true ||
    requestedExpand === "links" ||
    requestedExpand === "all";

  return {
    expand: pickWorkItemExpand(requestedExpand, includeRelations, includeLinks),
    includeRelations,
    includeLinks,
    includeComments: input.includeComments === true,
    includeUpdates: input.includeUpdates === true,
    includeRevisions: input.includeRevisions === true,
    includeAttachments,
    includeRaw: input.includeRaw === true,
  };
}

function normalizeGetWorkItemFullInput(input: GetWorkItemFullInput): NormalizedGetWorkItemFullInput {
  return {
    id: input.id,
    project: normalizeProject(input.project),
    ...normalizeWorkItemFullLoadOptions(input),
  };
}

function normalizeWorkItemAuditInput(input: WorkItemAuditInput): NormalizedWorkItemAuditInput {
  return {
    id: input.id,
    project: normalizeProject(input.project),
    pageSize: clampPositiveInt(
      input.pageSize,
      DEFAULT_WORK_ITEM_AUDIT_PAGE_SIZE,
      MAX_WORK_ITEM_AUDIT_PAGE_SIZE,
    ),
    includeRaw: input.includeRaw === true,
  };
}

function buildWorkItemGetPath(
  id: number,
  expand: NormalizedGetWorkItemFullInput["expand"],
): string {
  const params = new URLSearchParams();
  if (expand !== "none") {
    params.set("$expand", expand);
  }
  params.set("api-version", "7.1");

  return `/_apis/wit/workitems/${id}?${params.toString()}`;
}

function chunkArray<T>(values: readonly T[], size: number): T[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push([...values.slice(index, index + size)]);
  }

  return chunks;
}

function orderEntitiesByIds<T extends { readonly id: number }>(
  ids: readonly number[],
  items: readonly T[],
): T[] {
  const itemsById = new Map(items.map((item) => [item.id, item] as const));

  return ids
    .map((id) => itemsById.get(id))
    .filter((item): item is T => item !== undefined);
}

function orderWorkItemsByIds(
  ids: readonly number[],
  workItems: readonly WorkItemSummary[],
): WorkItemSummary[] {
  return orderEntitiesByIds(ids, workItems);
}

function assertWorkItemProjectAccess(
  project: string | null,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
): void {
  if (
    config.azdoProjectAllowlist.length > 0 &&
    !isProjectAllowed(project ?? undefined, config)
  ) {
    throw new Error(
      project
        ? `Work item belongs to project "${project}" which is not permitted by this connector.`
        : "Work item project is not available and cannot be validated against the allowlist.",
    );
  }
}

function sameProject(left: string | null | undefined, right: string | null | undefined): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function assertExpectedWorkItemProject(
  id: number,
  actualProject: string | null,
  expectedProject: string | undefined,
): void {
  if (!expectedProject || sameProject(actualProject, expectedProject)) {
    return;
  }

  throw new Error(
    actualProject
      ? `Work item ${id} belongs to project "${actualProject}" instead of "${expectedProject}".`
      : `Work item ${id} project is not available and cannot be matched to "${expectedProject}".`,
  );
}

async function resolveCategoryWorkItemTypes(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  categoryReferenceNames: readonly string[],
  categoryNames: readonly string[],
): Promise<string[]> {
  if (categoryReferenceNames.length === 0 && categoryNames.length === 0) {
    return [];
  }

  const referenceNames = new Set(categoryReferenceNames.map((value) => value.toLowerCase()));
  const names = new Set(categoryNames.map((value) => value.toLowerCase()));
  const categories = await listWorkItemCategories(client, config, project);
  const resolvedWorkItemTypes = new Set<string>();

  for (const category of categories) {
    const categoryName = category.name.toLowerCase();
    const categoryReferenceName = category.referenceName?.toLowerCase();
    const matchesReference =
      categoryReferenceName !== undefined && referenceNames.has(categoryReferenceName);
    const matchesName = names.has(categoryName);

    if (!matchesReference && !matchesName) {
      continue;
    }

    for (const workItemType of category.workItemTypes) {
      resolvedWorkItemTypes.add(workItemType.name);
    }
  }

  return [...resolvedWorkItemTypes];
}

function resolveRequestedWorkItemTypes(
  explicitWorkItemTypes: readonly string[],
  categoryWorkItemTypes: readonly string[] | null,
): string[] {
  if (categoryWorkItemTypes === null) {
    return [...explicitWorkItemTypes];
  }

  if (explicitWorkItemTypes.length === 0) {
    return [...categoryWorkItemTypes];
  }

  return intersectStringLists(explicitWorkItemTypes, categoryWorkItemTypes);
}

async function executeSearchWorkItemsAdvanced(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: SearchWorkItemsAdvancedInput,
  maxTop = MAX_TOP,
): Promise<AdvancedWorkItemSearchExecution> {
  assertProjectAllowed(input.project, config);

  const normalizedInput = normalizeSearchWorkItemsAdvancedInput(input, maxTop);
  const hasCategoryFilters =
    normalizedInput.categoryReferenceNames.length > 0 || normalizedInput.categoryNames.length > 0;
  const categoryWorkItemTypes = hasCategoryFilters
    ? await resolveCategoryWorkItemTypes(
        client,
        config,
        normalizedInput.project,
        normalizedInput.categoryReferenceNames,
        normalizedInput.categoryNames,
      )
    : null;
  const resolvedWorkItemTypes = resolveRequestedWorkItemTypes(
    normalizedInput.workItemTypes,
    categoryWorkItemTypes,
  );
  const query: SearchWorkItemsAdvancedQuery = {
    ...normalizedInput,
    resolvedWorkItemTypes,
  };

  if (
    (normalizedInput.workItemTypes.length > 0 || hasCategoryFilters) &&
    query.resolvedWorkItemTypes.length === 0
  ) {
    return {
      query,
      ids: [],
    };
  }

  const wiql = buildSearchWorkItemsAdvancedWiql(query);
  const wiqlResponse = await client.post<{ workItems?: Array<{ id?: number }> }>(
    `/${encodeURIComponent(query.project)}/_apis/wit/wiql?api-version=7.1&$top=${query.top}`,
    { query: wiql },
  );

  const ids = ensureArray<{ id?: number }>(wiqlResponse.workItems)
    .map((workItem) => workItem.id)
    .filter((id): id is number => Number.isInteger(id))
    .slice(0, query.top);

  return {
    query,
    ids,
  };
}

async function getValidatedWorkItemSummary(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  id: number,
  expectedProject?: string,
): Promise<WorkItemSummary> {
  if (expectedProject) {
    assertProjectAllowed(expectedProject, config);
  }

  const workItem = await getWorkItem(client, config, id);
  assertExpectedWorkItemProject(id, workItem.project, expectedProject);
  return workItem;
}

export function buildSearchWorkItemsWiql(
  input: SearchWorkItemsInput,
  allowlist: readonly string[] = [],
): string {
  const clauses: string[] = [];

  if (input.project) {
    clauses.push(`${formatWiqlField("System.TeamProject")} = '${escapeWiqlLiteral(input.project)}'`);
  } else {
    const allowlistClause = buildAllowedProjectsClause(allowlist);
    if (allowlistClause) {
      clauses.push(allowlistClause);
    }
  }

  if (input.assignedToMe) {
    clauses.push(`${formatWiqlField("System.AssignedTo")} = @Me`);
  }

  if (input.state?.trim()) {
    clauses.push(
      `${formatWiqlField("System.State")} = '${escapeWiqlLiteral(input.state.trim())}'`,
    );
  }

  if (input.text?.trim()) {
    const escapedText = escapeWiqlLiteral(input.text.trim());
    clauses.push(
      `(${formatWiqlField("System.Title")} CONTAINS '${escapedText}' OR ${formatWiqlField(
        "System.Description",
      )} CONTAINS '${escapedText}')`,
    );
  }

  const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";

  return `SELECT [System.Id] FROM WorkItems${whereClause} ORDER BY [System.ChangedDate] DESC`;
}

export function buildSearchWorkItemsAdvancedWiql(
  query: SearchWorkItemsAdvancedQuery,
): string {
  const clauses: string[] = [
    `${formatWiqlField("System.TeamProject")} = '${escapeWiqlLiteral(query.project)}'`,
  ];

  const stringClauses = [
    buildStringEqualsClause("System.WorkItemType", query.resolvedWorkItemTypes),
    buildStringEqualsClause("System.State", query.states),
    query.assignedTo
      ? buildStringEqualsClause("System.AssignedTo", [query.assignedTo])
      : null,
    query.createdBy ? buildStringEqualsClause("System.CreatedBy", [query.createdBy]) : null,
    query.changedBy ? buildStringEqualsClause("System.ChangedBy", [query.changedBy]) : null,
    buildStringEqualsClause("Microsoft.VSTS.Common.Severity", query.severity),
    buildStringEqualsClause("System.Reason", query.reason),
  ];

  for (const clause of stringClauses) {
    if (clause) {
      clauses.push(clause);
    }
  }

  const numberClauses = [
    buildNumberEqualsClause("System.Id", query.ids),
    buildNumberEqualsClause("Microsoft.VSTS.Common.Priority", query.priority),
  ];

  for (const clause of numberClauses) {
    if (clause) {
      clauses.push(clause);
    }
  }

  const pathClauses = [
    buildUnderClause("System.AreaPath", query.areaPaths),
    buildUnderClause("System.IterationPath", query.iterationPaths),
  ];

  for (const clause of pathClauses) {
    if (clause) {
      clauses.push(clause);
    }
  }

  const tagClauses = [
    buildContainsClause("System.Tags", query.tagsAny, "OR"),
    buildContainsClause("System.Tags", query.tagsAll, "AND"),
  ];

  for (const clause of tagClauses) {
    if (clause) {
      clauses.push(clause);
    }
  }

  if (query.text) {
    const escapedText = escapeWiqlLiteral(query.text);
    clauses.push(
      `(${formatWiqlField("System.Title")} CONTAINS '${escapedText}' OR ${formatWiqlField(
        "System.Description",
      )} CONTAINS '${escapedText}')`,
    );
  }

  const dateClauses = [
    buildDateClause("System.CreatedDate", ">=", query.createdDateFrom),
    buildDateClause("System.CreatedDate", "<=", query.createdDateTo),
    buildDateClause("System.ChangedDate", ">=", query.changedDateFrom),
    buildDateClause("System.ChangedDate", "<=", query.changedDateTo),
    buildDateClause("Microsoft.VSTS.Common.ClosedDate", ">=", query.closedDateFrom),
    buildDateClause("Microsoft.VSTS.Common.ClosedDate", "<=", query.closedDateTo),
    buildDateClause("Microsoft.VSTS.Common.ResolvedDate", ">=", query.resolvedDateFrom),
    buildDateClause("Microsoft.VSTS.Common.ResolvedDate", "<=", query.resolvedDateTo),
  ];

  for (const clause of dateClauses) {
    if (clause) {
      clauses.push(clause);
    }
  }

  const orderByClause = query.orderBy
    .map(
      (item) =>
        `${formatWiqlField(WIQL_ORDERABLE_FIELDS[item.field])} ${item.direction.toUpperCase()}`,
    )
    .join(", ");

  return `SELECT [System.Id] FROM WorkItems WHERE ${clauses.join(" AND ")} ORDER BY ${orderByClause}`;
}

export async function fetchWorkItemsByIds(
  client: AzureDevOpsClientLike,
  ids: readonly number[],
  fields: readonly string[] = WORK_ITEM_FIELDS,
): Promise<WorkItemSummary[]> {
  if (ids.length === 0) {
    return [];
  }

  const encodedFields = fields.map(encodeURIComponent).join(",");
  const workItems: WorkItemSummary[] = [];

  for (const batchIds of chunkArray(ids, WORK_ITEM_BULK_BATCH_SIZE)) {
    const joinedIds = batchIds.join(",");
    const response = await client.get<{ value?: unknown[] }>(
      `/_apis/wit/workitems?ids=${joinedIds}&fields=${encodedFields}&api-version=7.1`,
    );

    workItems.push(
      ...orderWorkItemsByIds(batchIds, ensureArray(response.value).map(mapWorkItem)),
    );
  }

  return orderWorkItemsByIds(ids, workItems);
}

export async function fetchWorkItemFullBaseByIds(
  client: AzureDevOpsClientLike,
  ids: readonly number[],
  options: Pick<
    NormalizedWorkItemFullLoadOptions,
    "expand" | "includeRaw" | "includeRelations" | "includeLinks"
  >,
): Promise<WorkItemFull[]> {
  if (ids.length === 0) {
    return [];
  }

  const workItems: WorkItemFull[] = [];

  for (const batchIds of chunkArray(ids, WORK_ITEM_BULK_BATCH_SIZE)) {
    const params = new URLSearchParams();
    params.set("ids", batchIds.join(","));
    if (options.expand !== "none") {
      params.set("$expand", options.expand);
    }
    params.set("api-version", "7.1");

    const response = await client.get<{ value?: unknown[] }>(
      `/_apis/wit/workitems?${params.toString()}`,
    );

    workItems.push(
      ...orderEntitiesByIds(
        batchIds,
        ensureArray(response.value).map((item) =>
          mapWorkItemFull(item, {
            includeRaw: options.includeRaw,
            includeRelations: options.includeRelations,
            includeLinks: options.includeLinks,
          }),
        ),
      ),
    );
  }

  return orderEntitiesByIds(ids, workItems);
}

async function loadWorkItemComments(
  client: AzureDevOpsClientLike,
  input: NormalizedWorkItemAuditInput,
): Promise<CommentHistoryLoadResult> {
  const comments: ReturnType<typeof mapWorkItemComment>[] = [];
  let continuationToken: string | null = null;
  let totalCount: number | null = null;
  let pagesFetched = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set("$top", String(input.pageSize));
    params.set("includeDeleted", "true");
    params.set("$expand", "renderedText");
    params.set("api-version", "7.1-preview.4");
    if (continuationToken) {
      params.set("continuationToken", continuationToken);
    }

    const response = await client.get<{
      comments?: unknown[];
      value?: unknown[];
      totalCount?: unknown;
      continuationToken?: unknown;
    }>(`/_apis/wit/workitems/${input.id}/comments?${params.toString()}`);
    const pageItems = ensureArray(response.comments ?? response.value);

    if (totalCount === null) {
      totalCount = asInteger(response.totalCount);
    }

    if (pageItems.length === 0) {
      break;
    }

    pagesFetched += 1;
    comments.push(...pageItems.map((item) => mapWorkItemComment(item, input.includeRaw)));

    const nextToken = asString(response.continuationToken);
    if (!nextToken || nextToken === continuationToken) {
      break;
    }

    continuationToken = nextToken;
  }

  return {
    comments,
    totalCount: totalCount ?? comments.length,
    pagesFetched,
  };
}

async function loadWorkItemUpdates(
  client: AzureDevOpsClientLike,
  input: NormalizedWorkItemAuditInput,
): Promise<UpdateHistoryLoadResult> {
  const updates: ReturnType<typeof mapWorkItemUpdate>[] = [];
  let skip = 0;
  let pagesFetched = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set("$top", String(input.pageSize));
    params.set("$skip", String(skip));
    params.set("api-version", "7.1");

    const response = await client.get<{ value?: unknown[] }>(
      `/_apis/wit/workitems/${input.id}/updates?${params.toString()}`,
    );
    const pageItems = ensureArray(response.value);

    if (pageItems.length === 0) {
      break;
    }

    pagesFetched += 1;
    updates.push(...pageItems.map((item) => mapWorkItemUpdate(item, input.includeRaw)));

    if (pageItems.length < input.pageSize) {
      break;
    }

    skip += pageItems.length;
  }

  return {
    updates,
    pagesFetched,
  };
}

async function loadWorkItemRevisions(
  client: AzureDevOpsClientLike,
  input: NormalizedWorkItemAuditInput,
): Promise<RevisionHistoryLoadResult> {
  const revisions: ReturnType<typeof mapWorkItemRevision>[] = [];
  let skip = 0;
  let pagesFetched = 0;

  while (true) {
    const params = new URLSearchParams();
    params.set("$top", String(input.pageSize));
    params.set("$skip", String(skip));
    params.set("api-version", "7.1");

    const response = await client.get<{ value?: unknown[] }>(
      `/_apis/wit/workitems/${input.id}/revisions?${params.toString()}`,
    );
    const pageItems = ensureArray(response.value);

    if (pageItems.length === 0) {
      break;
    }

    pagesFetched += 1;
    revisions.push(...pageItems.map((item) => mapWorkItemRevision(item, input.includeRaw)));

    if (pageItems.length < input.pageSize) {
      break;
    }

    skip += pageItems.length;
  }

  return {
    revisions,
    pagesFetched,
  };
}

async function enrichWorkItemFull(
  client: AzureDevOpsClientLike,
  workItem: WorkItemFull,
  options: Pick<
    NormalizedWorkItemFullLoadOptions,
    | "includeAttachments"
    | "includeComments"
    | "includeUpdates"
    | "includeRevisions"
    | "includeRaw"
  >,
): Promise<WorkItemFull> {
  const auditInput: NormalizedWorkItemAuditInput = {
    id: workItem.id,
    project: workItem.project ?? undefined,
    pageSize: DEFAULT_WORK_ITEM_AUDIT_PAGE_SIZE,
    includeRaw: options.includeRaw,
  };

  const [commentsResult, updatesResult, revisionsResult] = await Promise.all([
    options.includeComments ? loadWorkItemComments(client, auditInput) : Promise.resolve(undefined),
    options.includeUpdates ? loadWorkItemUpdates(client, auditInput) : Promise.resolve(undefined),
    options.includeRevisions ? loadWorkItemRevisions(client, auditInput) : Promise.resolve(undefined),
  ]);

  const attachments = options.includeAttachments
    ? ensureArray<WorkItemRelationSummary>(workItem.relations)
        .filter((relation) => relation.rel?.toLowerCase().includes("attachedfile") === true)
        .map(mapWorkItemAttachment)
    : undefined;

  return {
    ...workItem,
    comments: commentsResult?.comments,
    updates: updatesResult?.updates,
    revisions: revisionsResult?.revisions,
    attachments,
  };
}

export async function listWorkItemCategories(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
): Promise<WorkItemCategorySummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/wit/workitemtypecategories?api-version=7.1`,
  );

  return ensureArray(response.value).map(mapWorkItemCategory);
}

export async function listWorkItemTypes(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: string | ListWorkItemTypesInput,
): Promise<WorkItemTypeSummary[]> {
  const normalizedInput =
    typeof input === "string"
      ? { project: input.trim(), includeRaw: false }
      : {
          project: input.project.trim(),
          includeRaw: input.includeRaw === true,
        };
  const project = normalizedInput.project;
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const [typesResponse, categories] = await Promise.all([
    client.get<{ value?: unknown[] }>(
      `/${encodedProject}/_apis/wit/workitemtypes?api-version=7.1`,
    ),
    listWorkItemCategories(client, config, project),
  ]);

  const categoriesByTypeName = new Map<
    string,
    { categoryReferenceName: string | null; categoryName: string | null }
  >();

  for (const category of categories) {
    for (const workItemType of category.workItemTypes) {
      categoriesByTypeName.set(workItemType.name.toLowerCase(), {
        categoryReferenceName: category.referenceName,
        categoryName: category.name,
      });
    }
  }

  return ensureArray(typesResponse.value).map((type) => {
    const mappedType = mapWorkItemType(type, normalizedInput.includeRaw);
    const category = categoriesByTypeName.get(mappedType.name.toLowerCase());

    return {
      ...mappedType,
      categoryReferenceName: category?.categoryReferenceName ?? null,
      categoryName: category?.categoryName ?? null,
    };
  });
}

export async function getWorkItem(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  id: number,
): Promise<WorkItemSummary> {
  const fields = WORK_ITEM_FIELDS.map(encodeURIComponent).join(",");
  const response = await client.get<unknown>(
    `/_apis/wit/workitems/${id}?fields=${fields}&api-version=7.1`,
  );

  const item = mapWorkItem(response);
  assertWorkItemProjectAccess(item.project, config);

  return item;
}

export async function getWorkItemFull(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetWorkItemFullInput,
): Promise<WorkItemFull> {
  const normalizedInput = normalizeGetWorkItemFullInput(input);
  if (normalizedInput.project) {
    assertProjectAllowed(normalizedInput.project, config);
  }

  const response = await client.get<unknown>(
    buildWorkItemGetPath(normalizedInput.id, normalizedInput.expand),
  );
  const workItem = mapWorkItemFull(response, {
    includeRaw: normalizedInput.includeRaw,
    includeRelations: normalizedInput.includeRelations,
    includeLinks: normalizedInput.includeLinks,
  });
  assertWorkItemProjectAccess(workItem.project, config);
  assertExpectedWorkItemProject(normalizedInput.id, workItem.project, normalizedInput.project);
  return enrichWorkItemFull(client, workItem, normalizedInput);
}

export async function searchWorkItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: SearchWorkItemsInput,
): Promise<{ readonly query: SearchWorkItemsInput; readonly workItems: WorkItemSummary[] }> {
  if (input.project) {
    assertProjectAllowed(input.project, config);
  }

  const normalizedInput: SearchWorkItemsInput = {
    ...input,
    project: input.project?.trim() || undefined,
    state: input.state?.trim() || undefined,
    text: input.text?.trim() || undefined,
    top: clampTop(input.top, DEFAULT_TOP),
  };

  const pathPrefix = normalizedInput.project
    ? `/${encodeURIComponent(normalizedInput.project)}`
    : "";
  const wiql = buildSearchWorkItemsWiql(
    normalizedInput,
    normalizedInput.project ? [] : config.azdoProjectAllowlist,
  );

  const wiqlResponse = await client.post<{ workItems?: Array<{ id?: number }> }>(
    `${pathPrefix}/_apis/wit/wiql?api-version=7.1&$top=${normalizedInput.top}`,
    { query: wiql },
  );

  const ids = ensureArray<{ id?: number }>(wiqlResponse.workItems)
    .map((workItem) => workItem.id)
    .filter((id): id is number => Number.isInteger(id))
    .slice(0, normalizedInput.top);

  const workItems = await fetchWorkItemsByIds(client, ids);

  const filteredItems =
    config.azdoProjectAllowlist.length === 0
      ? workItems
      : workItems.filter((item) => isProjectAllowed(item.project ?? undefined, config));

  return {
    query: normalizedInput,
    workItems: filteredItems,
  };
}

export async function searchWorkItemsAdvanced(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: SearchWorkItemsAdvancedInput,
): Promise<{
  readonly query: SearchWorkItemsAdvancedQuery;
  readonly workItems: WorkItemSummary[];
}> {
  const { query, ids } = await executeSearchWorkItemsAdvanced(client, config, input);
  const workItems = await fetchWorkItemsByIds(client, ids);

  return {
    query,
    workItems:
      config.azdoProjectAllowlist.length === 0
        ? workItems
        : workItems.filter((item) => isProjectAllowed(item.project ?? undefined, config)),
  };
}

export async function listWorkItemComments(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: WorkItemAuditInput,
): Promise<WorkItemCommentsList> {
  const normalizedInput = normalizeWorkItemAuditInput(input);
  const workItem = await getValidatedWorkItemSummary(
    client,
    config,
    normalizedInput.id,
    normalizedInput.project,
  );
  const result = await loadWorkItemComments(client, normalizedInput);

  return {
    workItemId: normalizedInput.id,
    project: workItem.project,
    totalCount: result.totalCount,
    returned: result.comments.length,
    paging: {
      strategy: "continuation",
      pageSize: normalizedInput.pageSize,
      pagesFetched: result.pagesFetched,
    },
    comments: result.comments,
  };
}

export async function listWorkItemUpdates(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: WorkItemAuditInput,
): Promise<WorkItemUpdatesList> {
  const normalizedInput = normalizeWorkItemAuditInput(input);
  const workItem = await getValidatedWorkItemSummary(
    client,
    config,
    normalizedInput.id,
    normalizedInput.project,
  );
  const result = await loadWorkItemUpdates(client, normalizedInput);

  return {
    workItemId: normalizedInput.id,
    project: workItem.project,
    totalCount: result.updates.length,
    returned: result.updates.length,
    paging: {
      strategy: "skip",
      pageSize: normalizedInput.pageSize,
      pagesFetched: result.pagesFetched,
    },
    updates: result.updates,
  };
}

export async function listWorkItemRevisions(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: WorkItemAuditInput,
): Promise<WorkItemRevisionsList> {
  const normalizedInput = normalizeWorkItemAuditInput(input);
  const workItem = await getValidatedWorkItemSummary(
    client,
    config,
    normalizedInput.id,
    normalizedInput.project,
  );
  const result = await loadWorkItemRevisions(client, normalizedInput);

  return {
    workItemId: normalizedInput.id,
    project: workItem.project,
    totalCount: result.revisions.length,
    returned: result.revisions.length,
    paging: {
      strategy: "skip",
      pageSize: normalizedInput.pageSize,
      pagesFetched: result.pagesFetched,
    },
    revisions: result.revisions,
  };
}

export async function exportWorkItemsFull(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: ExportWorkItemsFullInput,
): Promise<ExportedWorkItemsFullSummary> {
  const maxItems = clampPositiveInt(
    input.maxItems ?? input.top,
    DEFAULT_EXPORT_MAX_ITEMS,
    MAX_EXPORT_MAX_ITEMS,
  );
  const advancedInput: SearchWorkItemsAdvancedInput = {
    ...input,
    top: maxItems,
  };
  const fullLoadOptions = normalizeWorkItemFullLoadOptions(input);
  const { query, ids } = await executeSearchWorkItemsAdvanced(
    client,
    config,
    advancedInput,
    MAX_EXPORT_MAX_ITEMS,
  );

  if (ids.length === 0) {
    return {
      query,
      totalMatched: 0,
      returned: 0,
      workItems: [],
    };
  }

  const baseWorkItems = await fetchWorkItemFullBaseByIds(client, ids, fullLoadOptions);
  const validatedWorkItems = baseWorkItems.map((workItem) => {
    assertWorkItemProjectAccess(workItem.project, config);
    assertExpectedWorkItemProject(workItem.id, workItem.project, query.project);
    return workItem;
  });
  const workItems = await Promise.all(
    validatedWorkItems.map((workItem) => enrichWorkItemFull(client, workItem, fullLoadOptions)),
  );

  return {
    query,
    totalMatched: ids.length,
    returned: workItems.length,
    workItems,
  };
}
