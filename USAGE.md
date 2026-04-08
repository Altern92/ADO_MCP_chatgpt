# Usage Guide

This guide is for day-to-day use once the server is already running.

The current server exposes 63 read-only MCP tools across work items, test management, traceability, code intelligence, discovery, reporting, and similarity analysis.

## How to think about the tool families

- Use `list_*` tools for catalogs, inventory, hierarchies, or lightweight listings.
- Use `get_*` tools for one specific entity.
- Use `*_full` tools when you need one enriched entity with optional nested data.
- Use `search_*` tools for filtered discovery across many entities.
- Use `run_saved_query` when the organization already maintains a useful Azure DevOps query.
- Use `export_*` tools for analytics-friendly batches rather than UI-style drill-down.
- Use traceability tools when you need to connect work items, tests, PRs, and commits.
- Use similarity tools when you need explainable duplicate detection or recurring-issue grouping.

## Quick tool selection guide

Use these pairs when the names look similar:

- `get_work_item` vs `get_work_item_full`
  - Use `get_work_item` for a quick lookup.
  - Use `get_work_item_full` when you need relations, links, comments, updates, revisions, attachments, or raw payload fragments.

- `search_work_items` vs `search_work_items_advanced`
  - Use `search_work_items` for quick lightweight search.
  - Use `search_work_items_advanced` for analytics-friendly filtering, WIQL-backed ordering, tags, dates, identities, and broader filter control.

- `list_test_cases` vs `list_test_cases_full`
  - Use `list_test_cases` for basic suite membership.
  - Use `list_test_cases_full` when you need test design details such as steps, parameters, shared steps, and linked points.

- `list_work_item_test_links` vs `get_user_story_test_coverage` vs `get_requirement_traceability_report`
  - Use `list_work_item_test_links` for raw requirement-to-test mapping.
  - Use `get_user_story_test_coverage` for coverage rollup and recent execution context.
  - Use `get_requirement_traceability_report` for release-readiness style gaps and verdicts.

- `search_pull_requests_by_work_item` vs `search_commits_by_work_item`
  - Use `search_pull_requests_by_work_item` to see review and merge activity around a work item.
  - Use `search_commits_by_work_item` to find the code changes themselves.

- `find_similar_work_items` vs `find_duplicate_candidates` vs `cluster_work_items_by_similarity`
  - Use `find_similar_work_items` for broad explainable similarity.
  - Use `find_duplicate_candidates` when you specifically want likely duplicates.
  - Use `cluster_work_items_by_similarity` when you want recurring themes or issue groups.

## Summary vs full vs export

- Summary tools return smaller, more stable payloads for browsing and filtering.
- Full tools return one enriched entity and usually support caller-controlled `include*` or `expand`.
- Export tools return many entities and should be preferred for reporting, offline analysis, and repeatable data pulls.

## `includeRaw` guidance

Use `includeRaw=true` only when you need raw Azure DevOps fragments for debugging, connector validation, or downstream data inspection. Leave it off for normal analysis to keep payloads smaller and more stable.

## Payload-control guidance

- Prefer `includeRaw=false` by default.
- Prefer `includePatch=false` for PR and commit analysis until diff text is actually needed.
- Prefer `includeWorkItems=false` on saved-query and export flows unless hydrated work item details are required.
- For broad exports, start with `top`, `maxItems`, or a smaller saved-query scope before expanding.
- Use `expand` only when the default payload is too light for the question you are answering.

## Common workflows

### 1. Explore a project before building filters

1. Run `list_projects`.
2. Run `list_work_item_fields` to discover field names and types.
3. Run `list_area_paths` and `list_iteration_paths` to discover valid hierarchy filters.
4. Run `list_tags` and `resolve_identity` to prepare tag and user filters.
5. Run `list_saved_queries` if the organization already maintains curated views.

### 2. Work item search and investigation

Use `search_work_items_advanced` when you need controlled filtering and stable ordering.

Example:

```json
{
  "project": "My Project",
  "workItemTypes": ["Bug", "User Story"],
  "states": ["Active"],
  "assignedTo": "alice@example.com",
  "areaPaths": ["My Project\\Frontend"],
  "top": 25,
  "orderBy": [
    {
      "field": "changedDate",
      "direction": "desc"
    }
  ]
}
```

If you need one item with history, use:

- `get_work_item_full`
- `list_work_item_comments`
- `list_work_item_updates`
- `list_work_item_revisions`

### 3. Test management analysis

Typical path:

1. `list_test_plans`
2. `get_test_plan_suites_tree`
3. `list_test_cases_full`
4. `list_test_points`
5. `get_test_point_history`
6. `get_test_run_full`
7. `export_test_plan_full` for a broader export

Use this path when you need to understand plan structure, execution state, and historical run context.

### 4. Requirement-to-test traceability

Typical path:

1. `list_work_item_test_links`
2. `get_user_story_test_coverage`
3. `get_requirement_traceability_report`
4. `export_traceability_dataset` for broader slices

Example:

```json
{
  "project": "My Project",
  "workItemId": 12345,
  "includeSuites": true,
  "includePlans": true,
  "includeRecentRuns": true
}
```

### 5. Code intelligence

Typical path:

1. `search_pull_requests_by_work_item`
2. `get_pull_request_full`
3. `list_pull_request_commits`
4. `get_pull_request_diff`
5. `search_commits_by_work_item`
6. `get_commit_full`

Use `includePatch=true` only when you actually need diff or patch text.

### 6. Saved-query and reporting flow

List and inspect saved queries:

```json
{
  "project": "My Project",
  "mode": "flat",
  "depth": 3,
  "includeWiql": true
}
```

Run one saved query and optionally hydrate work items:

```json
{
  "project": "My Project",
  "path": "Shared Queries/Ready For QA",
  "includeWorkItems": true,
  "top": 50,
  "expand": "relations"
}
```

For reporting exports, prefer:

- `export_work_items_delta`
- `export_traceability_dataset`
- `export_work_items_full`
- `export_test_plan_full`

### 7. Similarity and duplicate analysis

Use `find_similar_work_items` for broad explainable similarity, `find_duplicate_candidates` for stronger duplicate ranking, and `cluster_work_items_by_similarity` for recurring-theme grouping.

Example:

```json
{
  "project": "My Project",
  "workItemId": 12345,
  "fieldNames": ["Custom.Component", "Custom.Environment"],
  "maxCandidates": 50,
  "top": 10
}
```

## Read-only behavior

The server is intentionally read-only:

- no work item edits
- no PR updates
- no comment creation
- no test result mutation
- no pipeline reruns
- no saved-query modifications

If Azure DevOps exposes a write API for an entity, this server does not call it.

## Recommended smoke-test order

Use the checklist in [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md#smoke-test-checklist). A practical short path is:

1. `list_projects`
2. `list_repositories`
3. `list_work_item_fields`
4. `search_work_items_advanced`
5. `get_work_item_full`
6. `list_saved_queries`
7. `run_saved_query`
8. `get_requirement_traceability_report`
9. `search_pull_requests_by_work_item`
10. `export_traceability_dataset`

## Real-world validation note

This repo cannot perform a true live Azure DevOps smoke test without:

- a valid PAT
- a reachable Azure DevOps org
- at least one project allowed by `AZDO_PROJECT_ALLOWLIST`

If a real smoke test fails, check:

- PAT scopes
- project allowlist membership
- entity IDs and paths
- whether the target Azure DevOps org actually uses the related feature
