import {
  assertProjectAllowed,
  isProjectAllowed,
  type AppConfig,
} from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import { AppError, AzureDevOpsApiError } from "../errors.js";
import type {
  BlockedItemSummary,
  CrossProjectDependenciesSummary,
  DashboardWidgetDataSummary,
  DailyDigestFailedPipelineSummary,
  DailyDigestPullRequestSummary,
  DailyDigestSummary,
  DailyDigestWorkItemSummary,
  DateRangeSummary,
  DependencyWorkItemSummary,
  PipelineFailedTaskSummary,
  PipelineFailureAnalysis,
  SprintAtRiskItemSummary,
  SprintCapacitySummary,
  SprintSummary,
  SprintWindowSummary,
  TestFailureImpactSummary,
} from "../models.js";
import { listProjects } from "./projects.js";
import {
  asInteger,
  asNumber,
  asRecord,
  asString,
  extractCollection,
  ensureArray,
  getDisplayName,
  mapWorkItem,
  WORK_ITEM_FIELDS,
} from "./shared.js";
import { fetchWorkItemsByIds } from "./workItems.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const BLOCKED_ITEM_FIELDS = [...WORK_ITEM_FIELDS, "System.Tags"] as const;

interface CompositeErrorMessages {
  readonly unauthorized: string;
  readonly forbidden: string;
  readonly notFound: string;
}

interface IterationDetails {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

export interface GetMyDailyDigestInput {
  readonly project?: string;
  readonly myEmail: string;
}

export interface GetBlockedItemsInput {
  readonly project: string;
  readonly team?: string;
  readonly iterationPath?: string;
}

export interface GetSprintSummaryInput {
  readonly project: string;
  readonly team: string;
}

export interface AnalyzePipelineFailureInput {
  readonly project: string;
  readonly runId: number;
}

export interface GetSprintCapacityInput {
  readonly project: string;
  readonly team: string;
}

export interface GetCrossProjectDependenciesInput {
  readonly project: string;
  readonly workItemId: number;
}

export interface GetDashboardWidgetDataInput {
  readonly project: string;
  readonly dashboardId: string;
  readonly widgetId: string;
}

export interface AnalyzeTestFailureImpactInput {
  readonly project: string;
  readonly testRunId: number;
}

function escapeWiqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildAllowedProjectsClause(projects: readonly string[]): string | null {
  if (projects.length === 0) {
    return null;
  }

  if (projects.length === 1) {
    return `[System.TeamProject] = '${escapeWiqlLiteral(projects[0] ?? "")}'`;
  }

  return `[System.TeamProject] IN (${projects
    .map((project) => `'${escapeWiqlLiteral(project)}'`)
    .join(", ")})`;
}

function calculateDaysSince(dateValue: string | null, now: Date): number {
  if (!dateValue) {
    return 0;
  }

  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.floor((now.getTime() - timestamp) / DAY_MS));
}

function calculateDaysRemaining(endDate: string | null, now: Date): number {
  if (!endDate) {
    return 0;
  }

  const timestamp = Date.parse(endDate);
  if (Number.isNaN(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.ceil((timestamp - now.getTime()) / DAY_MS));
}

function asDecimal(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeToUtcMidnight(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function countWeekdaysBetween(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) {
    return 0;
  }

  const current = normalizeToUtcMidnight(startDate);
  const boundary = normalizeToUtcMidnight(endDate);
  if (!current || !boundary || current >= boundary) {
    return 0;
  }

  let total = 0;
  const cursor = new Date(current);
  while (cursor < boundary) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      total += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return total;
}

function mapDateRange(raw: unknown): DateRangeSummary | null {
  const record = asRecord(raw);
  const start = asString(record.start);
  const end = asString(record.end);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}

function countDaysOff(ranges: readonly DateRangeSummary[]): number {
  return ranges.reduce(
    (total, range) => total + countWeekdaysBetween(range.start, range.end),
    0,
  );
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

function toLower(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function mapAzureApiError(
  error: AzureDevOpsApiError,
  messages: CompositeErrorMessages,
): AppError {
  const reference = error.correlationId ? ` (ref ${error.correlationId})` : "";

  switch (error.azureStatus) {
    case 401:
      return new AppError(
        messages.unauthorized,
        "azure_devops_api_error",
        `${messages.unauthorized}${reference}`,
        401,
        error.correlationId,
        error.details,
      );
    case 403:
      return new AppError(
        messages.forbidden,
        "azure_devops_api_error",
        `${messages.forbidden}${reference}`,
        403,
        error.correlationId,
        error.details,
      );
    case 404:
      return new AppError(
        messages.notFound,
        "azure_devops_api_error",
        `${messages.notFound}${reference}`,
        404,
        error.correlationId,
        error.details,
      );
    default:
      return error;
  }
}

async function withAzureContext<T>(
  action: () => Promise<T>,
  messages: CompositeErrorMessages,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof AzureDevOpsApiError) {
      throw mapAzureApiError(error, messages);
    }

    throw error;
  }
}

async function runWiqlQuery(
  client: AzureDevOpsClientLike,
  wiql: string,
  project?: string,
  options: { readonly timePrecision?: boolean } = {},
): Promise<number[]> {
  const pathPrefix = project ? `/${encodeURIComponent(project)}` : "";
  const timePrecision = options.timePrecision ? "timePrecision=true&" : "";
  const response = await client.post<{ workItems?: Array<{ id?: number }> }>(
    `${pathPrefix}/_apis/wit/wiql?${timePrecision}api-version=7.1`,
    { query: wiql },
  );

  return ensureArray<{ id?: number }>(response.workItems)
    .map((item) => item.id)
    .filter((id): id is number => Number.isInteger(id));
}

async function fetchRawWorkItemsByIds(
  client: AzureDevOpsClientLike,
  ids: readonly number[],
  fields: readonly string[],
): Promise<unknown[]> {
  if (ids.length === 0) {
    return [];
  }

  const encodedFields = fields.map(encodeURIComponent).join(",");
  const response = await client.get<{ value?: unknown[] }>(
    `/_apis/wit/workitems?ids=${ids.join(",")}&fields=${encodedFields}&api-version=7.1`,
  );

  return ensureArray(response.value);
}

async function loadWorkItemById(
  client: AzureDevOpsClientLike,
  id: number,
  messages: CompositeErrorMessages,
  options: { readonly includeRelations?: boolean } = {},
): Promise<unknown> {
  const fields = WORK_ITEM_FIELDS.map(encodeURIComponent).join(",");
  const query = options.includeRelations
    ? "$expand=relations&api-version=7.1"
    : `fields=${fields}&api-version=7.1`;
  return withAzureContext(
    () => client.get<unknown>(`/_apis/wit/workitems/${id}?${query}`),
    messages,
  );
}

function extractWorkItemIdFromRelationUrl(url: string | null): number | null {
  if (!url) {
    return null;
  }

  const match = url.match(/\/workitems\/(\d+)(?:[/?]|$)/i);
  return match ? asInteger(match[1]) : null;
}

function mapDependencyWorkItem(raw: unknown): DependencyWorkItemSummary {
  const workItem = mapWorkItem(raw);

  return {
    id: workItem.id,
    title: workItem.title,
    project: workItem.project,
    state: workItem.state,
    url: workItem.url,
  };
}

function getIdentityEmail(raw: unknown): string | null {
  const record = asRecord(raw);
  const properties = asRecord(record.properties);

  return (
    asString(record.mailAddress) ??
    asString(record.uniqueName) ??
    asString(asRecord(properties.Mail).$value) ??
    asString(asRecord(properties.Account).$value) ??
    asString(asRecord(properties.SignInAddress).$value)
  );
}

async function resolveUserIdByEmail(
  client: AzureDevOpsClientLike,
  email: string,
): Promise<string | null> {
  const params = new URLSearchParams({
    searchFilter: "General",
    filterValue: email,
    queryMembership: "None",
    "api-version": "7.1",
  });

  const response = await withAzureContext(
    () => client.get<{ value?: unknown[] }>(`/_apis/Identities?${params.toString()}`),
    {
      unauthorized:
        "Azure DevOps authentication failed while resolving the reviewer identity for the daily digest. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        "Azure DevOps denied access while resolving the reviewer identity for the daily digest.",
      notFound:
        "Azure DevOps could not resolve the reviewer identity endpoint for the daily digest.",
    },
  );

  const identities = ensureArray(response.value);
  const normalizedEmail = email.trim().toLowerCase();
  const selected =
    identities.find((identity) => toLower(getIdentityEmail(identity)) === normalizedEmail) ??
    identities[0];

  return asString(asRecord(selected).id);
}

async function resolveDigestProjects(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string | undefined,
): Promise<string[]> {
  if (project) {
    assertProjectAllowed(project, config);
    return [project];
  }

  const projects = await withAzureContext(() => listProjects(client, config), {
    unauthorized:
      "Azure DevOps authentication failed while resolving projects for the daily digest. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
    forbidden:
      "Azure DevOps denied access while resolving projects for the daily digest.",
    notFound: "Azure DevOps could not list projects for the daily digest.",
  });

  return Array.from(
    new Set(projects.map((item) => item.name).filter((name): name is string => Boolean(name))),
  );
}

function buildDailyDigestWiql(email: string, projectNames: readonly string[]): string {
  const clauses = [
    `[System.AssignedTo] = '${escapeWiqlLiteral(email)}'`,
    "[System.State] NOT IN ('Closed', 'Resolved')",
  ];
  const allowedProjectsClause = buildAllowedProjectsClause(projectNames);
  if (allowedProjectsClause) {
    clauses.push(allowedProjectsClause);
  }

  return `SELECT [System.Id] FROM WorkItems WHERE ${clauses.join(" AND ")} ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.ChangedDate] DESC`;
}

async function fetchDigestWorkItems(
  client: AzureDevOpsClientLike,
  email: string,
  project: string | undefined,
  projectNames: readonly string[],
): Promise<DailyDigestWorkItemSummary[]> {
  if (!project && projectNames.length === 0) {
    return [];
  }

  const ids = await withAzureContext(
    () => runWiqlQuery(client, buildDailyDigestWiql(email, project ? [] : projectNames), project),
    {
      unauthorized:
        "Azure DevOps authentication failed while loading assigned work items for the daily digest. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        "Azure DevOps denied access while loading assigned work items for the daily digest.",
      notFound: project
        ? `Project "${project}" was not found while loading assigned work items for the daily digest.`
        : "Azure DevOps work item search endpoint was not found while loading the daily digest.",
    },
  );

  const workItems = await withAzureContext(() => fetchWorkItemsByIds(client, ids), {
    unauthorized:
      "Azure DevOps authentication failed while loading work item details for the daily digest. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
    forbidden:
      "Azure DevOps denied access while loading work item details for the daily digest.",
    notFound: "Azure DevOps could not load one or more work items for the daily digest.",
  });

  return workItems.map((item) => ({
    id: item.id,
    title: item.title,
    state: item.state,
    priority: item.priority,
  }));
}

async function fetchPendingReviewPullRequests(
  client: AzureDevOpsClientLike,
  projectNames: readonly string[],
  userId: string | null,
): Promise<DailyDigestPullRequestSummary[]> {
  if (!userId || projectNames.length === 0) {
    return [];
  }

  const responses = await Promise.all(
    projectNames.map(async (project) =>
      withAzureContext(
        () =>
          client.get<{ value?: unknown[] }>(
            `/${encodeURIComponent(project)}/_apis/git/pullrequests?${new URLSearchParams({
              "searchCriteria.reviewerId": userId,
              "searchCriteria.status": "active",
              "api-version": "7.1",
            }).toString()}`,
          ),
        {
          unauthorized:
            "Azure DevOps authentication failed while loading pull requests for the daily digest. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
          forbidden:
            `Azure DevOps denied access while loading pull requests in project "${project}" for the daily digest.`,
          notFound:
            `Project "${project}" was not found while loading pull requests for the daily digest.`,
        },
      ),
    ),
  );

  return responses
    .flatMap((response) =>
      ensureArray(response.value).map((raw): DailyDigestPullRequestSummary => {
        const record = asRecord(raw);
        return {
          pullRequestId: asInteger(record.pullRequestId) ?? 0,
          title: asString(record.title) ?? "",
          repository: asString(asRecord(record.repository).name),
          createdBy: getDisplayName(record.createdBy),
        };
      }),
    )
    .sort((left, right) => right.pullRequestId - left.pullRequestId);
}

async function fetchFailedPipelines(
  client: AzureDevOpsClientLike,
  projectNames: readonly string[],
  minTime: string,
): Promise<DailyDigestFailedPipelineSummary[]> {
  if (projectNames.length === 0) {
    return [];
  }

  const responses = await Promise.all(
    projectNames.map(async (project) =>
      withAzureContext(
        () =>
          client.get<{ value?: unknown[] }>(
            `/${encodeURIComponent(project)}/_apis/build/builds?${new URLSearchParams({
              statusFilter: "completed",
              resultFilter: "failed",
              minTime,
              "api-version": "7.1",
            }).toString()}`,
          ),
        {
          unauthorized:
            "Azure DevOps authentication failed while loading failed pipeline runs for the daily digest. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
          forbidden:
            `Azure DevOps denied access while loading failed pipeline runs in project "${project}" for the daily digest.`,
          notFound:
            `Project "${project}" was not found while loading failed pipeline runs for the daily digest.`,
        },
      ),
    ),
  );

  return responses
    .flatMap((response) =>
      ensureArray(response.value).map((raw): DailyDigestFailedPipelineSummary => {
        const record = asRecord(raw);
        return {
          id: asInteger(record.id) ?? 0,
          buildNumber: asString(record.buildNumber) ?? "",
          definition: { name: asString(asRecord(record.definition).name) },
          finishTime: asString(record.finishTime),
        };
      }),
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.finishTime ?? "");
      const rightTime = Date.parse(right.finishTime ?? "");
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
}

export async function getMyDailyDigest(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetMyDailyDigestInput,
): Promise<DailyDigestSummary> {
  const now = new Date();
  const project = input.project?.trim() || undefined;
  const email = input.myEmail.trim();
  const projectNames = await resolveDigestProjects(client, config, project);
  const userId = await resolveUserIdByEmail(client, email);

  const [myWorkItems, prsPendingMyReview, failedPipelines] = await Promise.all([
    fetchDigestWorkItems(client, email, project, projectNames),
    fetchPendingReviewPullRequests(client, projectNames, userId),
    fetchFailedPipelines(client, projectNames, new Date(now.getTime() - DAY_MS).toISOString()),
  ]);

  return {
    myWorkItems,
    prsPendingMyReview,
    failedPipelines,
    generatedAt: now.toISOString(),
  };
}

async function resolveIterationPath(
  client: AzureDevOpsClientLike,
  project: string,
  team: string | undefined,
  iterationPath: string | undefined,
): Promise<string | undefined> {
  if (iterationPath?.trim()) {
    return iterationPath.trim();
  }

  if (!team?.trim()) {
    return undefined;
  }

  const response = await withAzureContext(
    () =>
      client.get<{ value?: unknown[] }>(
        `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`,
      ),
    {
      unauthorized:
        "Azure DevOps authentication failed while resolving the current iteration. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        `Azure DevOps denied access while resolving the current iteration for team "${team}" in project "${project}".`,
      notFound:
        `Team "${team}" or project "${project}" was not found while resolving the current iteration.`,
    },
  );

  const path = asString(asRecord(ensureArray(response.value)[0]).path);
  if (!path) {
    throw new AppError(
      `Current iteration path is not available for team "${team}" in project "${project}".`,
      "iteration_not_found",
      `Current iteration could not be determined for team "${team}" in project "${project}".`,
      404,
    );
  }

  return path;
}

function buildBlockedItemsWiql(iterationPath: string | undefined, cutoff: string): string {
  const clauses = [
    "[System.Tags] CONTAINS 'Blocked'",
    "[System.State] NOT IN ('Closed', 'Resolved')",
    `[System.ChangedDate] < '${escapeWiqlLiteral(cutoff)}'`,
  ];

  if (iterationPath) {
    clauses.push(`[System.IterationPath] UNDER '${escapeWiqlLiteral(iterationPath)}'`);
  }

  return `SELECT [System.Id] FROM WorkItems WHERE ${clauses.join(" AND ")} ORDER BY [System.ChangedDate] ASC`;
}

export async function getBlockedItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetBlockedItemsInput,
): Promise<{
  readonly blockedItems: readonly BlockedItemSummary[];
  readonly totalBlocked: number;
  readonly project: string;
}> {
  const now = new Date();
  const project = input.project.trim();
  assertProjectAllowed(project, config);

  const cutoff = new Date(now.getTime() - 5 * DAY_MS).toISOString();
  const iterationPath = await resolveIterationPath(client, project, input.team, input.iterationPath);
  const ids = await withAzureContext(
    () =>
      runWiqlQuery(client, buildBlockedItemsWiql(iterationPath, cutoff), project, {
        timePrecision: true,
      }),
    {
      unauthorized:
        "Azure DevOps authentication failed while loading blocked work items. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        `Azure DevOps denied access while loading blocked work items in project "${project}".`,
      notFound: `Project "${project}" was not found while loading blocked work items.`,
    },
  );

  const rawItems = await withAzureContext(
    () => fetchRawWorkItemsByIds(client, ids, BLOCKED_ITEM_FIELDS),
    {
      unauthorized:
        "Azure DevOps authentication failed while loading blocked work item details. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        `Azure DevOps denied access while loading blocked work item details in project "${project}".`,
      notFound:
        `Azure DevOps could not load blocked work item details for project "${project}".`,
    },
  );

  const blockedItems = rawItems
    .map((raw): BlockedItemSummary => {
      const item = mapWorkItem(raw);
      const fields = asRecord(asRecord(raw).fields);
      return {
        id: item.id,
        title: item.title,
        state: item.state,
        assignedTo: item.assignedTo,
        tags: asString(fields["System.Tags"]),
        daysSinceUpdate: calculateDaysSince(item.changedDate, now),
      };
    })
    .sort((left, right) => right.daysSinceUpdate - left.daysSinceUpdate);

  return {
    blockedItems,
    totalBlocked: blockedItems.length,
    project,
  };
}

async function loadCurrentIteration(
  client: AzureDevOpsClientLike,
  project: string,
  team: string,
): Promise<IterationDetails> {
  const response = await withAzureContext(
    () =>
      client.get<{ value?: unknown[] }>(
        `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`,
      ),
    {
      unauthorized:
        "Azure DevOps authentication failed while loading the current sprint. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        `Azure DevOps denied access while loading the current sprint for team "${team}" in project "${project}".`,
      notFound:
        `Team "${team}" or project "${project}" was not found while loading the current sprint.`,
    },
  );

  const record = asRecord(ensureArray(response.value)[0]);
  const attributes = asRecord(record.attributes);
  const id = asString(record.id);
  const path = asString(record.path);
  const name = asString(record.name) ?? path;

  if (!id || !path || !name) {
    throw new AppError(
      `Current sprint details are incomplete for team "${team}" in project "${project}".`,
      "iteration_not_found",
      `Current sprint details could not be determined for team "${team}" in project "${project}".`,
      404,
    );
  }

  return {
    id,
    name,
    path,
    startDate: asString(attributes.startDate) ?? asString(record.startDate),
    endDate:
      asString(attributes.finishDate) ??
      asString(attributes.endDate) ??
      asString(record.finishDate) ??
      asString(record.endDate),
  };
}

function buildSprintSummaryWiql(iterationPath: string): string {
  return `SELECT [System.Id] FROM WorkItems WHERE [System.IterationPath] UNDER '${escapeWiqlLiteral(iterationPath)}' ORDER BY [System.ChangedDate] DESC`;
}

function buildSprintWindow(iteration: IterationDetails, now: Date): SprintWindowSummary {
  return {
    name: iteration.name,
    startDate: iteration.startDate,
    endDate: iteration.endDate,
    daysRemaining: calculateDaysRemaining(iteration.endDate, now),
  };
}

export async function getSprintSummary(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetSprintSummaryInput,
): Promise<SprintSummary> {
  const now = new Date();
  const project = input.project.trim();
  const team = input.team.trim();
  assertProjectAllowed(project, config);

  const iteration = await loadCurrentIteration(client, project, team);
  const ids = await withAzureContext(
    () => runWiqlQuery(client, buildSprintSummaryWiql(iteration.path), project),
    {
      unauthorized:
        "Azure DevOps authentication failed while loading sprint work items. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        `Azure DevOps denied access while loading sprint work items in project "${project}".`,
      notFound: `Project "${project}" was not found while loading sprint work items.`,
    },
  );

  const workItems = await withAzureContext(() => fetchWorkItemsByIds(client, ids), {
    unauthorized:
      "Azure DevOps authentication failed while loading sprint work item details. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
    forbidden:
      `Azure DevOps denied access while loading sprint work item details in project "${project}".`,
    notFound: `Azure DevOps could not load sprint work items for project "${project}".`,
  });

  const byState = { new: 0, active: 0, resolved: 0, closed: 0 };
  const atRiskItems: SprintAtRiskItemSummary[] = [];

  for (const item of workItems) {
    const daysSinceUpdate = calculateDaysSince(item.changedDate, now);

    switch (toLower(item.state)) {
      case "new":
        byState.new += 1;
        break;
      case "active":
        byState.active += 1;
        if (daysSinceUpdate >= 3) {
          atRiskItems.push({
            id: item.id,
            title: item.title,
            state: item.state,
            assignedTo: item.assignedTo,
            daysSinceUpdate,
          });
        }
        break;
      case "resolved":
        byState.resolved += 1;
        break;
      case "closed":
        byState.closed += 1;
        break;
      default:
        break;
    }
  }

  atRiskItems.sort((left, right) => right.daysSinceUpdate - left.daysSinceUpdate);
  const totalItems = workItems.length;
  const completionPercentage =
    totalItems === 0 ? 0 : Number((((byState.resolved + byState.closed) / totalItems) * 100).toFixed(1));

  return {
    sprint: buildSprintWindow(iteration, now),
    totalItems,
    byState,
    completionPercentage,
    atRiskItems,
  };
}

function extractDateRanges(value: unknown): DateRangeSummary[] {
  const record = asRecord(value);
  const source = Array.isArray(value)
    ? value
    : Array.isArray(record.daysOff)
      ? record.daysOff
      : Array.isArray(record.value)
        ? record.value
        : [];

  return source
    .map(mapDateRange)
    .filter((range): range is DateRangeSummary => range !== null);
}

function getCapacityPerDay(raw: unknown): number {
  const activities = ensureArray<unknown>(asRecord(raw).activities);
  return roundNumber(
    activities.reduce<number>(
      (total, activity) => total + (asDecimal(asRecord(activity).capacityPerDay) ?? 0),
      0,
    ),
  );
}

export async function getSprintCapacity(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetSprintCapacityInput,
): Promise<SprintCapacitySummary> {
  const project = input.project.trim();
  const team = input.team.trim();
  assertProjectAllowed(project, config);

  const iteration = await loadCurrentIteration(client, project, team);
  const [capacityResponse, teamDaysOffResponse] = await Promise.all([
    withAzureContext(
      () =>
        client.get<{ value?: unknown[] }>(
          `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iteration.id)}/capacities?api-version=7.1`,
        ),
      {
        unauthorized:
          "Azure DevOps authentication failed while loading sprint capacity. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
        forbidden:
          `Azure DevOps denied access while loading sprint capacity for team "${team}" in project "${project}".`,
        notFound:
          `Sprint capacity was not found for team "${team}" in project "${project}".`,
      },
    ),
    withAzureContext(
      () =>
        client.get<unknown>(
          `/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations/${encodeURIComponent(iteration.id)}/teamdaysoff?api-version=7.1`,
        ),
      {
        unauthorized:
          "Azure DevOps authentication failed while loading team days off for the current sprint. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
        forbidden:
          `Azure DevOps denied access while loading team days off for team "${team}" in project "${project}".`,
        notFound:
          `Team days off were not found for team "${team}" in project "${project}".`,
      },
    ),
  ]);

  const teamDaysOff = extractDateRanges(teamDaysOffResponse);
  const sprintWorkingDays = countWeekdaysBetween(iteration.startDate, iteration.endDate);
  const teamDaysOffCount = countDaysOff(teamDaysOff);

  const members = extractCollection<unknown>(capacityResponse)
    .map((raw) => {
      const record = asRecord(raw);
      const memberDaysOff = extractDateRanges(record.daysOff);
      const daysOff = countDaysOff(memberDaysOff);
      const capacityPerDay = getCapacityPerDay(record);
      const availableDays = Math.max(0, sprintWorkingDays - teamDaysOffCount - daysOff);

      return {
        displayName:
          getDisplayName(record.teamMember) ??
          asString(asRecord(record.teamMember).id) ??
          "Unknown team member",
        capacityPerDay,
        daysOff,
        availableHours: roundNumber(capacityPerDay * availableDays),
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    sprint: {
      name: iteration.name,
      startDate: iteration.startDate,
      endDate: iteration.endDate,
    },
    totalAvailableHours: roundNumber(
      members.reduce((total, member) => total + member.availableHours, 0),
    ),
    members,
    teamDaysOff,
  };
}

async function loadVisibleDependencyItems(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  sourceWorkItemId: number,
  dependencyIds: readonly number[],
): Promise<Map<number, DependencyWorkItemSummary>> {
  const uniqueIds = Array.from(new Set(dependencyIds));
  const items = await Promise.all(
    uniqueIds.map(async (id) =>
      loadWorkItemById(
        client,
        id,
        {
          unauthorized:
            `Azure DevOps authentication failed while loading dependency work item ${id} linked to work item ${sourceWorkItemId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
          forbidden:
            `Azure DevOps denied access while loading dependency work item ${id} linked to work item ${sourceWorkItemId}.`,
          notFound:
            `Dependency work item ${id} linked to work item ${sourceWorkItemId} was not found.`,
        },
      ),
    ),
  );

  return new Map(
    items
      .map(mapDependencyWorkItem)
      .filter((item) => isVisibleWorkItemProject(item.project, config))
      .map((item) => [item.id, item] as const),
  );
}

export async function getCrossProjectDependencies(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetCrossProjectDependenciesInput,
): Promise<CrossProjectDependenciesSummary> {
  const project = input.project.trim();
  const workItemId = input.workItemId;
  assertProjectAllowed(project, config);

  const rawWorkItem = await loadWorkItemById(
    client,
    workItemId,
    {
      unauthorized:
        `Azure DevOps authentication failed while loading work item ${workItemId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
      forbidden:
        `Azure DevOps denied access while loading work item ${workItemId} in project "${project}".`,
      notFound: `Work item ${workItemId} was not found in project "${project}".`,
    },
    { includeRelations: true },
  );

  const workItem = mapWorkItem(rawWorkItem);
  if (!isVisibleWorkItemProject(workItem.project, config)) {
    throw new AppError(
      `Work item ${workItemId} belongs to project "${workItem.project ?? "unknown"}" which is not permitted by AZDO_PROJECT_ALLOWLIST.`,
      "project_access_denied",
      `Work item ${workItemId} is not permitted by this connector.`,
      403,
    );
  }

  if (toLower(workItem.project) !== toLower(project)) {
    throw new AppError(
      `Work item ${workItemId} belongs to project "${workItem.project ?? "unknown"}" instead of "${project}".`,
      "work_item_project_mismatch",
      `Work item ${workItemId} was not found in project "${project}".`,
      404,
    );
  }

  const relations = ensureArray<unknown>(asRecord(rawWorkItem).relations);
  const blockedByIds = relations
    .filter((raw) => asString(asRecord(raw).rel) === "System.LinkTypes.Dependency-Reverse")
    .map((raw) => extractWorkItemIdFromRelationUrl(asString(asRecord(raw).url)))
    .filter((id): id is number => id !== null);
  const blockingIds = relations
    .filter((raw) => asString(asRecord(raw).rel) === "System.LinkTypes.Dependency-Forward")
    .map((raw) => extractWorkItemIdFromRelationUrl(asString(asRecord(raw).url)))
    .filter((id): id is number => id !== null);

  const dependencyItems = await loadVisibleDependencyItems(
    client,
    config,
    workItemId,
    [...blockedByIds, ...blockingIds],
  );

  const blockedBy = blockedByIds
    .map((id) => dependencyItems.get(id))
    .filter((item): item is DependencyWorkItemSummary => item !== undefined);
  const blocking = blockingIds
    .map((id) => dependencyItems.get(id))
    .filter((item): item is DependencyWorkItemSummary => item !== undefined);

  const crossProjectCount = Array.from(new Set([...blockedBy, ...blocking].map((item) => item.id)))
    .map((id) => dependencyItems.get(id))
    .filter(
      (item): item is DependencyWorkItemSummary =>
        item !== undefined && toLower(item.project) !== toLower(project),
    ).length;

  return {
    workItem: {
      id: workItem.id,
      title: workItem.title,
      project: workItem.project,
      state: workItem.state,
    },
    blockedBy,
    blocking,
    crossProjectCount,
  };
}

function parseWidgetSettings(
  rawSettings: unknown,
  project: string,
  dashboardId: string,
  widgetId: string,
): Record<string, unknown> {
  if (typeof rawSettings === "object" && rawSettings !== null) {
    return asRecord(rawSettings);
  }

  if (typeof rawSettings !== "string" || !rawSettings.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawSettings);
    if (typeof parsed === "string") {
      return asRecord(JSON.parse(parsed));
    }

    return asRecord(parsed);
  } catch {
    throw new AppError(
      `Dashboard widget ${widgetId} on dashboard ${dashboardId} in project "${project}" returned invalid settings JSON.`,
      "dashboard_widget_invalid_settings",
      `Dashboard widget "${widgetId}" has invalid settings JSON in project "${project}".`,
      500,
    );
  }
}

function extractWidgetQueryId(settings: Record<string, unknown>): string | undefined {
  return (
    asString(settings.queryId) ??
    asString(asRecord(settings.query).id) ??
    asString(asRecord(settings.queryIdentifier).id) ??
    undefined
  );
}

function extractWidgetWiql(settings: Record<string, unknown>): string | undefined {
  return (
    asString(settings.wiql) ??
    asString(settings.queryText) ??
    (typeof settings.query === "string" ? settings.query : undefined)
  );
}

function extractWiqlIds(raw: unknown): number[] {
  const record = asRecord(raw);
  const directIds = ensureArray<unknown>(record.workItems)
    .map((item) => asInteger(asRecord(item).id))
    .filter((id): id is number => id !== null);
  const relationIds = ensureArray<unknown>(record.workItemRelations)
    .map((relation) => asInteger(asRecord(asRecord(relation).target).id))
    .filter((id): id is number => id !== null);

  return Array.from(new Set([...directIds, ...relationIds]));
}

export async function getDashboardWidgetData(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: GetDashboardWidgetDataInput,
): Promise<DashboardWidgetDataSummary> {
  const project = input.project.trim();
  const dashboardId = input.dashboardId.trim();
  const widgetId = input.widgetId.trim();
  assertProjectAllowed(project, config);

  const widget = await withAzureContext(
    () =>
      client.get<unknown>(
        `/${encodeURIComponent(project)}/_apis/dashboard/dashboards/${encodeURIComponent(dashboardId)}/widgets/${encodeURIComponent(widgetId)}?api-version=7.1-preview.2`,
      ),
    {
      unauthorized:
        "Azure DevOps authentication failed while loading dashboard widget data. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        `Azure DevOps denied access while loading widget "${widgetId}" on dashboard "${dashboardId}" in project "${project}".`,
      notFound:
        `Dashboard widget "${widgetId}" was not found on dashboard "${dashboardId}" in project "${project}".`,
    },
  );

  const widgetRecord = asRecord(widget);
  const rawSettings = parseWidgetSettings(widgetRecord.settings, project, dashboardId, widgetId);
  const queryId = extractWidgetQueryId(rawSettings);
  const wiql = extractWidgetWiql(rawSettings);

  let queryResults: DashboardWidgetDataSummary["queryResults"];
  if (wiql || queryId) {
    const queryIds = wiql
      ? await withAzureContext(() => runWiqlQuery(client, wiql, project), {
          unauthorized:
            "Azure DevOps authentication failed while executing the dashboard widget WIQL query. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
          forbidden:
            `Azure DevOps denied access while executing the dashboard widget query in project "${project}".`,
          notFound:
            `Dashboard widget query could not be executed in project "${project}".`,
        })
      : extractWiqlIds(
          await withAzureContext(
            () =>
              client.get<unknown>(
                `/${encodeURIComponent(project)}/_apis/wit/wiql/${encodeURIComponent(queryId ?? "")}?api-version=7.1`,
              ),
            {
              unauthorized:
                "Azure DevOps authentication failed while loading the dashboard widget query definition. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
              forbidden:
                `Azure DevOps denied access while loading the dashboard widget query definition in project "${project}".`,
              notFound:
                `Dashboard widget query "${queryId}" was not found in project "${project}".`,
            },
          ),
        );

    const workItems = await withAzureContext(() => fetchWorkItemsByIds(client, queryIds), {
      unauthorized:
        "Azure DevOps authentication failed while loading dashboard widget work items. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.",
      forbidden:
        `Azure DevOps denied access while loading dashboard widget work items in project "${project}".`,
      notFound:
        `Dashboard widget work item details were not found in project "${project}".`,
    });

    queryResults = workItems
      .filter((item) => isVisibleWorkItemProject(item.project, config))
      .map((item) => ({
        id: item.id,
        title: item.title,
        state: item.state,
        assignedTo: item.assignedTo,
      }));
  }

  return {
    widgetName: asString(widgetRecord.name) ?? widgetId,
    widgetType:
      asString(widgetRecord.contributionId) ??
      asString(widgetRecord.typeId) ??
      "unknown",
    queryId,
    queryResults,
    rawSettings,
  };
}

function buildTestFailureImpactSummary(
  runName: string,
  failedTests: TestFailureImpactSummary["failedTests"],
): string {
  const testsWithLinks = failedTests.filter((test) => test.linkedWorkItems.length > 0).length;
  const uniqueLinkedItems = new Set(
    failedTests.flatMap((test) => test.linkedWorkItems.map((item) => item.id)),
  ).size;

  return `Test run ${runName} has ${failedTests.length} failed tests, ${testsWithLinks} with linked work items, and ${uniqueLinkedItems} unique impacted work items.`;
}

export async function analyzeTestFailureImpact(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: AnalyzeTestFailureImpactInput,
): Promise<TestFailureImpactSummary> {
  const project = input.project.trim();
  const testRunId = input.testRunId;
  assertProjectAllowed(project, config);

  const run = await withAzureContext(
    () =>
      client.get<unknown>(
        `/${encodeURIComponent(project)}/_apis/test/runs/${testRunId}?api-version=7.1`,
      ),
    {
      unauthorized:
        `Azure DevOps authentication failed while loading test run ${testRunId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
      forbidden:
        `Azure DevOps denied access while loading test run ${testRunId} in project "${project}".`,
      notFound: `Test run ${testRunId} was not found in project "${project}".`,
    },
  );

  const failedResultsResponse = await withAzureContext(
    () =>
      client.get<{ value?: unknown[] }>(
        `/${encodeURIComponent(project)}/_apis/test/runs/${testRunId}/results?outcomes=Failed&api-version=7.1`,
      ),
    {
      unauthorized:
        `Azure DevOps authentication failed while loading failed test results for run ${testRunId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
      forbidden:
        `Azure DevOps denied access while loading failed test results for run ${testRunId} in project "${project}".`,
      notFound:
        `Failed test results were not found for test run ${testRunId} in project "${project}".`,
    },
  );

  const failedResults = extractCollection<unknown>(failedResultsResponse);
  const linkedWorkItemIdByResult = new Map<number, number[]>();

  await Promise.all(
    failedResults.map(async (raw) => {
      const record = asRecord(raw);
      const resultId = asInteger(record.id);
      if (resultId === null) {
        return;
      }

      const workItemsResponse = await withAzureContext(
        () =>
          client.get<unknown>(
            `/${encodeURIComponent(project)}/_apis/test/runs/${testRunId}/results/${resultId}/workitems?api-version=7.1`,
          ),
        {
          unauthorized:
            `Azure DevOps authentication failed while loading linked work items for failed test result ${resultId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
          forbidden:
            `Azure DevOps denied access while loading linked work items for failed test result ${resultId} in project "${project}".`,
          notFound:
            `Linked work items were not found for failed test result ${resultId} in project "${project}".`,
        },
      );

      linkedWorkItemIdByResult.set(
        resultId,
        extractCollection<unknown>(workItemsResponse)
          .map((item) => asInteger(asRecord(item).id))
          .filter((id): id is number => id !== null),
      );
    }),
  );

  const linkedWorkItemIds = Array.from(
    new Set(Array.from(linkedWorkItemIdByResult.values()).flat()),
  );
  const linkedWorkItems = await Promise.all(
    linkedWorkItemIds.map(async (id) =>
      loadWorkItemById(
        client,
        id,
        {
          unauthorized:
            `Azure DevOps authentication failed while loading linked work item ${id} for test run ${testRunId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
          forbidden:
            `Azure DevOps denied access while loading linked work item ${id} for test run ${testRunId} in project "${project}".`,
          notFound:
            `Linked work item ${id} for test run ${testRunId} was not found.`,
        },
      ),
    ),
  );

  const linkedWorkItemMap = new Map<
    number,
    {
      id: number;
      title: string | null;
      state: string | null;
      project: string | null;
    }
  >(
    linkedWorkItems
      .map(mapWorkItem)
      .filter((item) => isVisibleWorkItemProject(item.project, config))
      .map((item) => [
        item.id,
        {
          id: item.id,
          title: item.title,
          state: item.state,
          project: item.project,
        },
      ] as const),
  );

  const failedTests = failedResults.map((raw) => {
    const record = asRecord(raw);
    const resultId = asInteger(record.id) ?? 0;

    return {
      testName:
        asString(record.testCaseTitle) ??
        asString(asRecord(record.testCase).name) ??
        `Test result ${resultId}`,
      errorMessage:
        asString(record.errorMessage) ??
        asString(record.stackTrace) ??
        "No error message was provided by Azure DevOps.",
      linkedWorkItems: (linkedWorkItemIdByResult.get(resultId) ?? [])
        .map((id) => linkedWorkItemMap.get(id))
        .filter(
          (item): item is {
            id: number;
            title: string | null;
            state: string | null;
            project: string | null;
          } => item !== undefined,
        ),
    };
  });

  const runRecord = asRecord(run);
  const runName = asString(runRecord.name) ?? `Test Run ${testRunId}`;

  return {
    testRun: {
      id: asInteger(runRecord.id) ?? testRunId,
      name: runName,
      totalTests: asInteger(runRecord.totalTests),
      failedTests: asInteger(runRecord.failedTests),
    },
    failedTests,
    impactSummary: buildTestFailureImpactSummary(runName, failedTests),
  };
}

function getLogPreview(value: string, maxLines = 50): string {
  return value.split(/\r?\n/).slice(0, maxLines).join("\n").trim();
}

function extractFailureHighlights(logPreview: string): string[] {
  const lines = logPreview
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const interesting = lines.filter((line) => /error|failed|exception/i.test(line));
  return (interesting.length > 0 ? interesting : lines).slice(0, 2);
}

function buildFailureSummary(
  buildNumber: string,
  failedTasks: readonly PipelineFailedTaskSummary[],
): string {
  if (failedTasks.length === 0) {
    return `Build ${buildNumber} failed, but Azure DevOps did not expose any failed tasks in the timeline.`;
  }

  const details = failedTasks
    .map((task) => {
      const highlights = extractFailureHighlights(task.log);
      return `${task.name}: ${highlights.length > 0 ? highlights.join(" ") : "no log lines were available."}`;
    })
    .join(" ");

  return `Build ${buildNumber} failed in ${failedTasks.length} task(s): ${failedTasks.map((task) => task.name).join(", ")}. ${details}`.trim();
}

async function getBuildLogText(client: AzureDevOpsClientLike, path: string): Promise<string> {
  if (typeof client.getText === "function") {
    return client.getText(path);
  }

  const response = await client.get<unknown>(path);
  if (typeof response === "string") {
    return response;
  }

  const lines = ensureArray<unknown>(asRecord(response).value).map((line) => String(line));
  return lines.length > 0 ? lines.join("\n") : JSON.stringify(response, null, 2);
}

async function loadFailedTaskLog(
  client: AzureDevOpsClientLike,
  project: string,
  runId: number,
  logId: number | null,
): Promise<string> {
  if (logId === null) {
    return "No Azure DevOps log was linked to this failed task.";
  }

  try {
    return await getBuildLogText(
      client,
      `/${encodeURIComponent(project)}/_apis/build/builds/${runId}/logs/${logId}?api-version=7.1`,
    );
  } catch (error) {
    if (error instanceof AzureDevOpsApiError) {
      const reference = error.correlationId ? ` (ref ${error.correlationId})` : "";
      switch (error.azureStatus) {
        case 401:
          return `Azure DevOps authentication failed while loading log ${logId}.${reference}`.trim();
        case 403:
          return `Azure DevOps denied access while loading log ${logId}.${reference}`.trim();
        case 404:
          return `Azure DevOps log ${logId} was not found for build ${runId}.${reference}`.trim();
        default:
          throw error;
      }
    }

    throw error;
  }
}

export async function analyzePipelineFailure(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  input: AnalyzePipelineFailureInput,
): Promise<PipelineFailureAnalysis> {
  const project = input.project.trim();
  const runId = input.runId;
  assertProjectAllowed(project, config);

  const build = await withAzureContext(
    () =>
      client.get<unknown>(
        `/${encodeURIComponent(project)}/_apis/build/builds/${runId}?api-version=7.1`,
      ),
    {
      unauthorized:
        `Azure DevOps authentication failed while loading pipeline run ${runId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
      forbidden:
        `Azure DevOps denied access while loading pipeline run ${runId} in project "${project}".`,
      notFound: `Pipeline run ${runId} was not found in project "${project}".`,
    },
  );

  const timeline = await withAzureContext(
    () =>
      client.get<{ records?: unknown[] }>(
        `/${encodeURIComponent(project)}/_apis/build/builds/${runId}/timeline?api-version=7.1`,
      ),
    {
      unauthorized:
        `Azure DevOps authentication failed while loading the build timeline for run ${runId}. Verify the Bearer token contains a valid Azure DevOps PAT and that it has organization access.`,
      forbidden:
        `Azure DevOps denied access while loading the build timeline for run ${runId} in project "${project}".`,
      notFound:
        `Build timeline was not found for pipeline run ${runId} in project "${project}".`,
    },
  );

  const failedTaskRecords = ensureArray(timeline.records).filter((raw) => {
    const record = asRecord(raw);
    const type = toLower(asString(record.type));
    const result = toLower(asString(record.result));
    return result === "failed" && (type === "task" || type === "");
  });

  const failedTasks = await Promise.all(
    failedTaskRecords.map(async (raw): Promise<PipelineFailedTaskSummary> => {
      const record = asRecord(raw);
      const logText = await loadFailedTaskLog(
        client,
        project,
        runId,
        asInteger(asRecord(record.log).id),
      );

      return {
        name: asString(record.name) ?? `Task ${asString(record.id) ?? "unknown"}`,
        log: getLogPreview(logText),
      };
    }),
  );

  const buildRecord = asRecord(build);
  const buildNumber = asString(buildRecord.buildNumber) ?? String(runId);

  return {
    buildNumber,
    definition: asString(asRecord(buildRecord.definition).name),
    requestedBy: getDisplayName(buildRecord.requestedBy),
    startTime: asString(buildRecord.startTime),
    finishTime: asString(buildRecord.finishTime),
    failedTasks,
    summary: buildFailureSummary(buildNumber, failedTasks),
  };
}
