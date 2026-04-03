import { DEFAULT_RUN_TOP } from "../constants.js";
import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type {
  PipelineArtifactSummary,
  PipelineRunSummary,
  PipelineSummary,
} from "../models.js";
import {
  clampTop,
  ensureArray,
  extractCollection,
  mapPipeline,
  mapPipelineArtifact,
  mapPipelineRun,
} from "./shared.js";

export async function listPipelines(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
): Promise<PipelineSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/build/definitions?api-version=7.1`,
  );

  return ensureArray(response.value).map(mapPipeline);
}

export async function listPipelineRuns(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  definitionId?: number,
  top?: number,
): Promise<PipelineRunSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const params = new URLSearchParams({
    "$top": String(clampTop(top, DEFAULT_RUN_TOP)),
    "api-version": "7.1",
  });

  if (definitionId !== undefined) {
    params.set("definitions", String(definitionId));
  }

  const response = await client.get<{ value?: unknown[] }>(
    `/${encodedProject}/_apis/build/builds?${params.toString()}`,
  );

  return ensureArray(response.value).map(mapPipelineRun);
}

export async function listPipelineArtifacts(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  runId: number,
): Promise<PipelineArtifactSummary[]> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const response = await client.get<unknown>(
    `/${encodedProject}/_apis/build/builds/${runId}/artifacts?api-version=7.1`,
  );

  return extractCollection<unknown>(response).map(mapPipelineArtifact);
}
