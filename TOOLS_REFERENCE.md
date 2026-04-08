# Tools Reference

This document is the release-ready catalog for the Azure DevOps MCP server.

## Conventions

- All tools are read-only.
- `project` means Azure DevOps project name or ID.
- `includeRaw` is optional and should be used only when raw Azure DevOps payload fragments are needed.
- `full` tools return a single enriched entity.
- `export` tools return analytics-friendly batches for reporting and offline analysis.
- Cross-project results are still constrained by `AZDO_PROJECT_ALLOWLIST`.

## Core inventory and repo tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `list_projects` | none | allowed project catalog | first connection check |
| `list_repositories` | `project` | repositories in one project | repository discovery |
| `list_pull_requests` | `project`, `repository`, `status` | PR list | repo-level PR browsing |
| `get_pull_request_work_items` | `project`, `repository`, `pullRequestId` | PR-linked work items | validating PR traceability |
| `list_pipelines` | `project` | pipeline definitions | build inventory |
| `list_pipeline_runs` | `project`, optional `definitionId`, `top` | run history | build trend checks |
| `list_pipeline_artifacts` | `project`, `runId` | published artifacts | artifact inspection |
| `get_wiki_page` | `project`, `wikiIdentifier`, `path` | wiki content | requirements or setup lookup |
| `get_my_daily_digest` | `myEmail`, optional `project` | my work, review, failed pipeline digest | daily overview |
| `get_blocked_items` | `project`, optional `team`, `iterationPath` | blocked work items | delivery risk triage |
| `get_sprint_summary` | `project`, `team` | sprint status and at-risk items | sprint monitoring |
| `get_sprint_capacity` | `project`, `team` | team/member capacity | sprint planning |
| `get_cross_project_dependencies` | `project`, `workItemId` | blockers and dependents | dependency review |
| `get_dashboard_widget_data` | `project`, `dashboardId`, `widgetId` | widget settings and query results | dashboard reverse-engineering |
| `analyze_pipeline_failure` | `project`, `runId` | failed tasks and summary | pipeline incident review |
| `analyze_test_failure_impact` | `project`, `testRunId` | failed tests and linked work items | test failure triage |

## Work item tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `get_work_item` | `id` | lightweight work item summary | fast lookup |
| `search_work_items` | optional `project`, `state`, `text`, `assignedToMe`, `top` | summary list | quick search |
| `search_work_items_advanced` | `project` plus advanced filters and `orderBy` | ordered summary list | analytics-friendly filtered search |
| `get_work_item_full` | `id`, optional `project`, `expand`, `include*`, `includeRaw` | enriched full work item | one-item investigation |
| `list_work_item_categories` | `project` | category catalog | category discovery |
| `list_work_item_types` | `project`, optional `includeRaw` | type catalog | project configuration discovery |
| `list_work_item_comments` | `id`, optional `project`, `pageSize`, `includeRaw` | full comment history | audit and discussion analysis |
| `list_work_item_updates` | `id`, optional `project`, `pageSize`, `includeRaw` | update history | change timeline analysis |
| `list_work_item_revisions` | `id`, optional `project`, `pageSize`, `includeRaw` | revision history | field snapshot history |
| `export_work_items_full` | advanced search filters plus `include*`, `expand`, `maxItems` | full work item export | broad work item extraction |
| `export_work_items_delta` | `project`, `changedSince` or `fromDate`, optional filters and include flags | delta export with IDs and optional enrichment | incremental reporting |

## Test management tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `list_test_plans` | `project` | plan list | plan inventory |
| `get_test_plan` | `project`, `planId`, optional `includeRaw` | full plan view | plan inspection |
| `get_test_plan_suites_tree` | `project`, `planId`, optional `rootSuiteId`, `depth`, `includeRaw` | recursive suite tree | test hierarchy browsing |
| `get_test_suite` | `project`, `planId`, `suiteId`, optional `includeRaw` | full suite view | suite inspection |
| `list_test_suites` | `project`, `planId` | suite list | lightweight suite browsing |
| `list_test_cases` | `project`, `planId`, `suiteId` | test case refs | basic suite contents |
| `list_test_cases_full` | `project`, `planId`, `suiteId`, optional `pageSize`, `includeRaw` | enriched test cases | test design analysis |
| `list_test_points` | `project`, `planId`, `suiteId`, optional `pageSize`, `includeRaw` | execute-style point list | assignment and execution state |
| `get_test_point_history` | `project`, `planId`, `suiteId`, `pointId`, optional `pageSize`, `includeRaw` | point execution history | point audit |
| `list_test_runs` | `project`, optional `top` | run list | recent execution inventory |
| `get_test_run_full` | `project`, `runId`, optional `includeSteps`, `pageSize`, `includeRaw` | full run with results | run investigation |
| `export_test_plan_full` | `project`, `planId`, optional include flags | analytics export for a plan | reporting and offline analysis |

## Traceability and coverage tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `list_work_item_link_types` | none | relation/link type catalog | traceability setup discovery |
| `get_work_item_relations_graph` | `project`, `workItemId`, depth and filters | graph with nodes and edges | relation traversal |
| `get_traceability_chain` | `project`, `workItemId` plus traversal options | ordered chain view | requirement-to-delivery pathing |
| `list_linked_work_items` | `project`, `workItemId`, traversal options | flattened linked-item summary | surrounding dependency analysis |
| `list_work_item_test_links` | `project`, `workItemId`, optional `include*` | test link summary | requirement-to-test mapping |
| `get_user_story_test_coverage` | `project`, `workItemId` or `userStoryId`, optional `include*` | coverage rollup | story-level test coverage |
| `get_requirement_traceability_report` | `project`, `workItemId`, optional `include*` | coverage plus gaps and verdict | release-readiness traceability |

## Code intelligence tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `search_pull_requests_by_work_item` | `project`, `workItemId`, optional `includeRaw` | PR list linked to one work item | requirement-to-PR lookup |
| `get_pull_request_full` | `project`, `repository`, `pullRequestId`, optional `includeWorkItems`, `includeReviewers`, `includeRaw` | full PR view | review and merge analysis |
| `list_pull_request_commits` | `project`, `repository`, `pullRequestId`, optional `includeRaw` | commit list | PR change lineage |
| `get_pull_request_diff` | `project`, `repository`, `pullRequestId`, optional `includePatch`, `includeRaw` | file diff summary | impact analysis |
| `get_commit_full` | `project`, `repository`, `commitId`, optional `includePatch`, `includeRaw` | full commit view | commit-level inspection |
| `search_commits_by_work_item` | `project`, `workItemId`, optional `includePatch`, `includeRaw` | commits linked by PRs or direct artifacts | requirement-to-commit mapping |

## Discovery tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `list_work_item_fields` | `project`, optional `search`, `referenceNames`, `names`, `includeRaw` | field catalog | building dynamic filters |
| `list_area_paths` | `project`, optional `depth`, `mode`, `includeRaw` | tree or flat area catalog | valid area filters |
| `list_iteration_paths` | `project`, optional `depth`, `mode`, `includeRaw` | tree or flat iteration catalog | valid iteration filters |
| `list_tags` | `project`, optional `search`, `top`, `includeRaw` | tag catalog | tag filter discovery |
| `resolve_identity` | `query`, optional `project`, `top`, `includeRaw` | likely identity matches | assigned-to / created-by filters |
| `list_saved_queries` | `project`, optional `depth`, `mode`, `includeWiql`, `includeRaw` | saved query hierarchy | query discovery |
| `run_saved_query` | `project` with `queryId` or `path`, optional `includeWorkItems`, `top`, `expand`, `includeRaw` | saved query results | reuse of curated WIQL |

## Reporting and dataset tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `export_work_items_delta` | `project`, `changedSince` or `fromDate`, optional filters and include flags | incremental work item dataset | daily or watermark-based extracts |
| `export_traceability_dataset` | `project` with saved-query or search scope, optional include flags | work items plus traceability/code layers | larger analytics datasets |

## Similarity tools

| Tool | Key inputs | Returns | Good for |
| --- | --- | --- | --- |
| `find_similar_work_items` | `project`, `workItemId`, optional scope filters, `fieldNames`, `top`, `maxCandidates`, `minScore`, `includeRaw` | ranked similar candidates with reasons | explainable similarity search |
| `find_duplicate_candidates` | `project`, `sourceWorkItemId`, optional scope filters, `top`, `maxCandidates`, `minScore`, `includeRaw` | duplicate candidates with signals | bug or incident de-duplication |
| `cluster_work_items_by_similarity` | `project`, optional scope filters, `maxItems`, `minScore`, `minClusterSize`, `includeRaw` | clusters with summaries and common signals | recurring issue grouping |

## Known behavior and limits

- Search and export flows preserve WIQL result order after bulk work item hydration.
- Large payloads are caller-controlled through `include*`, `expand`, `top`, `maxItems`, `includePatch`, and `includeRaw`.
- Comments, updates, revisions, points, and run results use Azure DevOps paging where the API supports it.
- Cross-project traversal is allowed only when each touched project is inside the configured allowlist.
- Similarity is deterministic and explainable; it is not an embedding or LLM ranking layer.

## Smoke test checklist

You need:

- a valid Azure DevOps PAT
- a reachable Azure DevOps org
- at least one project allowed by `AZDO_PROJECT_ALLOWLIST`

Suggested order:

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

Example calls:

```json
{
  "tool": "list_projects",
  "input": {}
}
```

```json
{
  "tool": "search_work_items_advanced",
  "input": {
    "project": "My Project",
    "workItemTypes": ["Bug"],
    "states": ["Active"],
    "top": 10,
    "orderBy": [
      {
        "field": "changedDate",
        "direction": "desc"
      }
    ]
  }
}
```

```json
{
  "tool": "run_saved_query",
  "input": {
    "project": "My Project",
    "path": "Shared Queries/Ready For QA",
    "includeWorkItems": true,
    "top": 25,
    "expand": "relations"
  }
}
```

```json
{
  "tool": "get_requirement_traceability_report",
  "input": {
    "project": "My Project",
    "workItemId": 12345,
    "includeSuites": true,
    "includePlans": true,
    "includeRecentRuns": true
  }
}
```

```json
{
  "tool": "export_traceability_dataset",
  "input": {
    "project": "My Project",
    "path": "Shared Queries/Ready For QA",
    "maxItems": 50,
    "includeWorkItems": true,
    "includeTestLinks": true,
    "includeCoverage": true,
    "includePullRequests": true,
    "includeCommits": true
  }
}
```

If any smoke-test step fails, validate:

- PAT scopes
- project allowlist membership
- entity IDs and paths
- whether the target org actually uses the related Azure DevOps feature
