# Usage Guide

This guide is for day-to-day usage once the server is already running.

## How to think about the tool families

- Use `list_*` tools when you need inventory, catalogs, or lightweight listings.
- Use `get_*_full` tools when you need a single entity with optional enrichment.
- Use `search_*` tools when you need filtered discovery across many entities.
- Use `export_*` tools when you need analytics-friendly batches rather than UI-style drill-down.
- Use traceability tools when you need to connect work items, tests, PRs, and commits.
- Use similarity tools when you need explainable duplicate or clustering analysis.

## Summary vs full vs export

- Summary tools return smaller, more stable payloads for browsing and filtering.
- Full tools return one enriched entity and usually support caller-controlled `include*` or `expand`.
- Export tools return many entities and should be preferred for reporting, offline analysis, and repeatable data pulls.

## `includeRaw` guidance

Use `includeRaw=true` only when you need raw Azure DevOps fragments for debugging, connector validation, or downstream data inspection. Leave it off for normal analysis to keep payloads smaller and more stable.

## Common workflows

### 1. Explore a project before building filters

1. Run `list_work_item_fields` to discover available fields.
2. Run `list_area_paths` and `list_iteration_paths` to discover valid hierarchy filters.
3. Run `list_tags` and `resolve_identity` to prepare tag and user filters.
4. Run `list_saved_queries` if the organization already has curated views you want to reuse.

### 2. Work item analysis

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

If you need one item with audit history, use `get_work_item_full`, `list_work_item_comments`, `list_work_item_updates`, or `list_work_item_revisions`.

### 3. Test and traceability analysis

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

### 4. Code intelligence

Typical path:

1. `search_pull_requests_by_work_item`
2. `get_pull_request_full`
3. `list_pull_request_commits`
4. `get_pull_request_diff`
5. `search_commits_by_work_item`
6. `get_commit_full`

Use `includePatch=true` only when you actually need diff text.

### 5. Saved query and reporting flow

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

For analytics exports:

- `export_work_items_delta`
- `export_traceability_dataset`

### 6. Similarity and duplicate analysis

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

## Payload-control recommendations

- Prefer `includeWorkItems=false` on saved-query and export flows unless you need hydrated work item details.
- Prefer `includePatch=false` for PR/commit analysis until diff text is actually needed.
- Prefer `includeRaw=false` by default.
- For broad exports, start with `top` or `maxItems` and expand only after validating the result shape.

## Read-only behavior

The server is intentionally read-only:

- no work item edits
- no PR updates
- no comment creation
- no test result mutation
- no pipeline reruns

If Azure DevOps exposes a write API for an entity, this server does not call it.

## Real-world smoke testing

This repo cannot perform a true live Azure DevOps smoke test without:

- a valid PAT
- a reachable Azure DevOps org
- at least one project allowed by `AZDO_PROJECT_ALLOWLIST`

Use the checklist in [TOOLS_REFERENCE.md](./TOOLS_REFERENCE.md#smoke-test-checklist) when validating against a real org.
