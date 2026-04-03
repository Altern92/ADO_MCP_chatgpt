import { WIKI_CONTENT_MAX_LENGTH } from "../constants.js";
import { assertProjectAllowed, type AppConfig } from "../config.js";
import type { AzureDevOpsClientLike } from "../azure/client.js";
import type { WikiPageSummary } from "../models.js";
import { mapWikiPage } from "./shared.js";

function normalizeWikiPath(path: string): string {
  const trimmed = path.trim();

  if (!trimmed || trimmed === "/") {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export async function getWikiPage(
  client: AzureDevOpsClientLike,
  config: Pick<AppConfig, "azdoProjectAllowlist">,
  project: string,
  wikiIdentifier: string,
  path: string,
): Promise<WikiPageSummary> {
  assertProjectAllowed(project, config);

  const encodedProject = encodeURIComponent(project);
  const encodedWikiIdentifier = encodeURIComponent(wikiIdentifier);
  const params = new URLSearchParams({
    path: normalizeWikiPath(path),
    includeContent: "true",
    "api-version": "7.1",
  });
  const response = await client.get<unknown>(
    `/${encodedProject}/_apis/wiki/wikis/${encodedWikiIdentifier}/pages?${params.toString()}`,
  );

  return mapWikiPage(response, WIKI_CONTENT_MAX_LENGTH);
}
