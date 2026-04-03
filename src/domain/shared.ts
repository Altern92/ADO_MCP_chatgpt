import { MAX_TOP } from "../constants.js";
import type {
  PipelineArtifactSummary,
  PipelineRunSummary,
  PipelineSummary,
  ProjectSummary,
  PullRequestSummary,
  RepositorySummary,
  TestPlanSummary,
  TestRunSummary,
  TestSuiteSummary,
  WikiPageSummary,
  WorkItemSummary,
} from "../models.js";

export type UnknownRecord = Record<string, unknown>;

export const WORK_ITEM_FIELDS = [
  "System.TeamProject",
  "System.Title",
  "System.State",
  "System.WorkItemType",
  "System.AssignedTo",
  "System.CreatedDate",
  "System.ChangedDate",
  "Microsoft.VSTS.Common.Priority",
  "System.Description",
] as const;

export function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

export function asBoolean(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

export function getDisplayName(value: unknown): string | null {
  const record = asRecord(value);
  return asString(record.displayName) ?? asString(record.uniqueName);
}

export function getConfigurationName(value: unknown): string | null {
  const record = asRecord(value);
  return asString(record.name) ?? asString(record.displayName);
}

export function getWorkItemProperty(
  value: unknown,
  key: string,
): string | null {
  for (const item of ensureArray<unknown>(value)) {
    const property = asRecord(asRecord(item).workItem);
    if (asString(property.key) === key) {
      return asString(property.value);
    }
  }

  return null;
}

export function stripHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const withoutTags = value.replace(/<[^>]+>/g, " ");
  const normalized = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

export function truncate(value: string | null, length: number): string | null {
  if (!value || value.length <= length) {
    return value;
  }

  return `${value.slice(0, length)}...`;
}

export function truncateContent(
  value: string,
  length: number,
): { content: string; contentLength: number; isTruncated: boolean } {
  if (value.length <= length) {
    return {
      content: value,
      contentLength: value.length,
      isTruncated: false,
    };
  }

  return {
    content: value.slice(0, length),
    contentLength: value.length,
    isTruncated: true,
  };
}

export function clampTop(value: number | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(1, Math.min(MAX_TOP, Math.floor(value)));
}

export function mapProject(raw: unknown): ProjectSummary {
  const record = asRecord(raw);

  return {
    id: asString(record.id) ?? "",
    name: asString(record.name) ?? "",
    state: asString(record.state),
    visibility: asString(record.visibility),
    url: asString(record.url),
  };
}

export function mapRepository(raw: unknown): RepositorySummary {
  const record = asRecord(raw);

  return {
    id: asString(record.id) ?? "",
    name: asString(record.name) ?? "",
    defaultBranch: asString(record.defaultBranch),
    remoteUrl: asString(record.remoteUrl),
    webUrl: asString(record.webUrl),
  };
}

export function mapPullRequest(raw: unknown): PullRequestSummary {
  const record = asRecord(raw);

  return {
    id: asNumber(record.pullRequestId) ?? 0,
    title: asString(record.title) ?? "",
    status: asString(record.status),
    createdBy: getDisplayName(record.createdBy),
    sourceBranch: asString(record.sourceRefName),
    targetBranch: asString(record.targetRefName),
    createdDate: asString(record.creationDate),
    url: asString(record.url),
  };
}

export function mapWorkItem(raw: unknown): WorkItemSummary {
  const record = asRecord(raw);
  const fields = asRecord(record.fields);

  return {
    id: asNumber(record.id) ?? 0,
    project: asString(fields["System.TeamProject"]),
    title: asString(fields["System.Title"]),
    state: asString(fields["System.State"]),
    workItemType: asString(fields["System.WorkItemType"]),
    assignedTo: getDisplayName(fields["System.AssignedTo"]),
    createdDate: asString(fields["System.CreatedDate"]),
    changedDate: asString(fields["System.ChangedDate"]),
    closedDate: asString(fields["System.ClosedDate"]),
    priority: asNumber(fields["Microsoft.VSTS.Common.Priority"]),
    description: truncate(stripHtml(asString(fields["System.Description"])), 1_000),
    url: asString(record.url),
  };
}

export function mapTestPlan(raw: unknown): TestPlanSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    state: asString(record.state),
    startDate: asString(record.startDate),
    endDate: asString(record.endDate),
    iteration: asString(record.iteration),
    areaPath: asString(record.areaPath),
  };
}

export function mapTestSuite(raw: unknown): TestSuiteSummary {
  const record = asRecord(raw);
  const parentSuite = asRecord(record.parentSuite);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    suiteType: asString(record.suiteType),
    parentSuiteId: asInteger(parentSuite.id),
    testCaseCount: asInteger(record.testCaseCount) ?? asInteger(record.testCasesCount),
  };
}

export function mapTestRun(raw: unknown): TestRunSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    state: asString(record.state),
    totalTests: asInteger(record.totalTests),
    passedTests: asInteger(record.passedTests),
    failedTests: asInteger(record.failedTests),
    startedDate: asString(record.startedDate),
    completedDate: asString(record.completedDate),
  };
}

export function mapPipeline(raw: unknown): PipelineSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    name: asString(record.name) ?? "",
    path: asString(record.path),
    type: asString(record.type),
    queueStatus: asString(record.queueStatus),
  };
}

export function mapPipelineRun(raw: unknown): PipelineRunSummary {
  const record = asRecord(raw);

  return {
    id: asInteger(record.id) ?? 0,
    buildNumber: asString(record.buildNumber) ?? "",
    status: asString(record.status),
    result: asString(record.result),
    startTime: asString(record.startTime),
    finishTime: asString(record.finishTime),
    definitionName: asString(asRecord(record.definition).name),
    requestedBy: getDisplayName(record.requestedBy),
  };
}

export function mapPipelineArtifact(raw: unknown): PipelineArtifactSummary {
  const record = asRecord(raw);
  const resource = asRecord(record.resource);

  return {
    id: asInteger(record.id),
    name: asString(record.name) ?? "",
    resourceType: asString(resource.type),
    downloadUrl: asString(resource.downloadUrl),
    source: asString(record.source),
  };
}

export function mapWikiPage(raw: unknown, maxLength: number): WikiPageSummary {
  const record = asRecord(raw);
  const rawContent = typeof record.content === "string" ? record.content : "";
  const truncated = truncateContent(rawContent, maxLength);

  return {
    path: asString(record.path) ?? "/",
    content: truncated.content,
    gitItemPath: asString(record.gitItemPath),
    isParentPage: asBoolean(record.isParentPage),
    contentLength: truncated.contentLength,
    isTruncated: truncated.isTruncated,
  };
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function extractCollection<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  return ensureArray<T>(asRecord(value).value);
}
