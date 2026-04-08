# Live Tool Test Status

Sis dokumentas skirtas gyvam MCP serverio testavimui pries realu naudojima.

Testuotas endpoint:

- `http://10.121.21.76/mcp`

Testavimo data:

- `2026-04-08`

Statusu legenda:

- `[ ]` netestuota
- `[x]` veikia
- `[!]` neveikia
- `[~]` blocked / reikia papildomu duomenu, scope arba org feature

## Transport and MCP handshake

- [x] `GET /health`
  Notes: endpointas gyvas.

- [x] `initialize`
  Notes: MCP handshake pavyko.

- [x] `tools/list`
  Notes: gyvas serveris grazina pilna tool inventory.

## Live smoke test summary

- Total MCP tools: `63`
- Passed: `55`
- Failed: `5`
- Blocked: `3`

## Live sample context used

- Work item sample: `TestAutomation` / `917894`
- Repo sample: `TestAutomation` / `ADAPT`
- Pull request sample: `52395`
- Commit sample: `759fd40b4fa09d540b6980f2fcda23f3bae164c2`
- Pipeline sample: `TestAutomation` / run `1206663`
- Failed pipeline sample: `TestAutomation` / run `1188963`
- Test plan sample: `TestAutomation` / plan `119872`
- Test suite sample: `TestAutomation` / suite `119873`
- Test point history sample: `TestAutomation` / plan `119872` / suite `119874` / point `52385`
- Test run sample: `TestAutomation` / run `1091866`
- Sprint sample: `CSO-TierBoard` / team `CSO-TierBoard Team`

## Core inventory and repo tools

- [x] `list_projects`
  Notes: PASS, grazino `13` projektu.

- [x] `list_repositories`
  Notes: PASS su `TestAutomation`.

- [x] `list_pull_requests`
  Notes: PASS su `TestAutomation` / `ADAPT`.

- [x] `get_pull_request_work_items`
  Notes: PASS su PR `52395`.

- [x] `list_pipelines`
  Notes: PASS su `TestAutomation`.

- [x] `list_pipeline_runs`
  Notes: PASS su `TestAutomation`.

- [x] `list_pipeline_artifacts`
  Notes: PASS su run `1206663`.

- [~] `get_wiki_page`
  Notes: BLOCKED. Tiesioginis ADO wiki REST i prieinama projekta grizta `401`, labai tiketina, kad dabartiniam PAT truksta `Wiki: Read` scope.

- [!] `get_my_daily_digest`
  Notes: FAIL. Su teisingu email formatu toolas stringa ant reviewer identity resolution kelio su ADO auth klaida.

- [x] `get_blocked_items`
  Notes: PASS su `TestAutomation`.

- [x] `get_sprint_summary`
  Notes: PASS su `CSO-TierBoard` / `CSO-TierBoard Team`.

- [x] `get_sprint_capacity`
  Notes: PASS su `CSO-TierBoard` / `CSO-TierBoard Team`.

- [x] `get_cross_project_dependencies`
  Notes: PASS su work item `917894`.

- [~] `get_dashboard_widget_data`
  Notes: BLOCKED. Per scan per prieinamus projektus ir komandas nepavyko rasti jokio dashboard widget pavyzdzio.

- [x] `analyze_pipeline_failure`
  Notes: PASS su failed pipeline run `1188963`.

- [~] `analyze_test_failure_impact`
  Notes: BLOCKED. Per testuotus projektus nepavyko rasti test run su `failedTests > 0`.

## Work item tools

- [x] `get_work_item`
  Notes: PASS su ID `917894`.

- [x] `search_work_items`
  Notes: PASS su `TestAutomation`.

- [x] `search_work_items_advanced`
  Notes: PASS su `TestAutomation`, `orderBy changedDate desc`.

- [x] `get_work_item_full`
  Notes: PASS su `includeRelations=true`.

- [x] `list_work_item_categories`
  Notes: PASS su `TestAutomation`.

- [x] `list_work_item_types`
  Notes: PASS su `TestAutomation`.

- [!] `list_work_item_comments`
  Notes: FAIL. Net su gyvu item `CSO-TierBoard / 848548`, kuris turi `commentCount > 0`, toolas grizta `404`. Tiesioginis ADO REST veikia tik su projekto-scoped comments URL, todel cia labai tiketinas implementacijos bugas.

- [x] `list_work_item_updates`
  Notes: PASS su `917894`.

- [x] `list_work_item_revisions`
  Notes: PASS su `917894`.

- [x] `export_work_items_full`
  Notes: PASS su `TestAutomation`, `maxItems=5`.

- [x] `export_work_items_delta`
  Notes: PASS su `TestAutomation`, `changedSince=2026-01-01T00:00:00Z`.

## Test management tools

- [x] `list_test_plans`
  Notes: PASS su `TestAutomation`.

- [x] `get_test_plan`
  Notes: PASS su plan `119872`.

- [x] `get_test_plan_suites_tree`
  Notes: PASS su plan `119872`.

- [x] `get_test_suite`
  Notes: PASS su suite `119873`.

- [x] `list_test_suites`
  Notes: PASS su plan `119872`.

- [x] `list_test_cases`
  Notes: PASS su suite `119873`.

- [x] `list_test_cases_full`
  Notes: PASS su suite `119873`.

- [x] `list_test_points`
  Notes: PASS su suite `119873`.

- [x] `get_test_point_history`
  Notes: PASS su plan `119872`, suite `119874`, point `52385`.

- [x] `list_test_runs`
  Notes: PASS su `TestAutomation`.

- [x] `get_test_run_full`
  Notes: PASS su run `1091866`.

- [x] `export_test_plan_full`
  Notes: PASS su plan `119872`.

## Traceability and coverage tools

- [x] `list_work_item_link_types`
  Notes: PASS.

- [x] `get_work_item_relations_graph`
  Notes: PASS su work item `917894`.

- [x] `get_traceability_chain`
  Notes: PASS su work item `917894`.

- [x] `list_linked_work_items`
  Notes: PASS su work item `917894`.

- [x] `list_work_item_test_links`
  Notes: PASS su `includeSuites`, `includePlans`, `includeRecentRuns`.

- [x] `get_user_story_test_coverage`
  Notes: PASS su work item `917894`.

- [x] `get_requirement_traceability_report`
  Notes: PASS su work item `917894`.

## Code intelligence tools

- [x] `search_pull_requests_by_work_item`
  Notes: PASS su work item `917894`.

- [x] `get_pull_request_full`
  Notes: PASS su `TestAutomation` / `ADAPT` / PR `52395`.

- [x] `list_pull_request_commits`
  Notes: PASS su PR `52395`.

- [x] `get_pull_request_diff`
  Notes: PASS su PR `52395`.

- [x] `get_commit_full`
  Notes: PASS su commit `759fd40b4fa09d540b6980f2fcda23f3bae164c2`.

- [x] `search_commits_by_work_item`
  Notes: PASS su work item `917894`.

## Discovery tools

- [x] `list_work_item_fields`
  Notes: PASS su `TestAutomation`.

- [x] `list_area_paths`
  Notes: PASS su `TestAutomation`.

- [x] `list_iteration_paths`
  Notes: PASS su `TestAutomation`.

- [x] `list_tags`
  Notes: PASS su `TestAutomation`.

- [!] `resolve_identity`
  Notes: FAIL. Gyvas kvietimas grizta su ADO auth klaida identity resolution kelyje.

- [!] `list_saved_queries`
  Notes: FAIL. Tiesioginis ADO REST `/{project}/_apis/wit/queries` veikia, bet MCP toolas grizta `Azure DevOps request failed`. Labai tiketinas implementacijos bugas.

- [!] `run_saved_query`
  Notes: FAIL. Su gyvu query path `Shared Queries/Product Management/Release Projects` toolas taip pat grizta klaida. Labai tiketina, kad lusta tame paciame saved-query retrieval kelyje.

## Reporting and dataset tools

- [x] `export_traceability_dataset`
  Notes: PASS su `TestAutomation`, `maxItems=10`.

## Similarity tools

- [x] `find_similar_work_items`
  Notes: PASS su work item `917894`.

- [x] `find_duplicate_candidates`
  Notes: PASS su work item `917894`.

- [x] `cluster_work_items_by_similarity`
  Notes: PASS su `TestAutomation`.

## Conclusions

Gyvo smoke testo isvada:

- pagrindinis MCP serveris veikia ir didzioji dauguma toolu atsako korektiskai
- kritiniai gyvi defektai siame smoke teste:
  - `list_work_item_comments`
  - `list_saved_queries`
  - `run_saved_query`
  - `resolve_identity`
  - `get_my_daily_digest`
- blocked atvejai siame smoke teste:
  - `get_wiki_page` del PAT scope arba wiki neprieinamumo
  - `get_dashboard_widget_data` del dashboard widget pavyzdzio nebuvimo
  - `analyze_test_failure_impact` del failed test run nebuvimo testuotame scope
