#!/usr/bin/env bash
set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source <(sed 's/\r$//' .env)
  set +a
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is not installed. Please install jq first." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is not installed. Please install curl first." >&2
  exit 1
fi

BASE_URL="${MCP_TEST_URL:-http://localhost:3000}"
PAT="${AZDO_PAT:-}"
PASS=0
FAIL=0
SKIP=0
PASS_SYMBOL=$'\u2713'
FAIL_SYMBOL=$'\u2717'
LAST_HTTP_STATUS=""
LAST_HTTP_BODY=""
LAST_FAILURE_REASON=""
FIRST_PROJECT=""
FIRST_REPO=""
FIRST_PULL_REQUEST_ID=""
FIRST_WORK_ITEM_ID=""
FIRST_PIPELINE_RUN_ID=""
FIRST_TEST_PLAN_ID=""
FIRST_TEST_SUITE_ID=""
FIRST_TEST_RUN_ID=""
declare -a RESULT_LINES=()

echo "Testing MCP server at: $BASE_URL"
echo "Azure DevOps org: ${AZDO_ORG:-<not set>}"

if [ -z "$PAT" ]; then
  echo "ERROR: AZDO_PAT not set. Add it to .env or export it." >&2
  exit 1
fi

format_result_line() {
  local symbol="$1"
  local status_word="$2"
  local name="$3"
  local info="${4:-}"
  local suffix=""

  if [ -n "$info" ]; then
    suffix=" ($info)"
  fi

  printf "%s %-5s %-18s%s" "$symbol" "$status_word" "$name" "$suffix"
}

pass() {
  local name="$1"
  local info="${2:-}"
  PASS=$((PASS + 1))
  local line
  line="$(format_result_line "$PASS_SYMBOL" "PASS" "$name" "$info")"
  RESULT_LINES+=("$line")
  echo "$line"
}

fail() {
  local name="$1"
  local reason="${2:-unknown error}"
  FAIL=$((FAIL + 1))
  local line
  line="$(format_result_line "$FAIL_SYMBOL" "FAIL" "$name" "- $reason")"
  RESULT_LINES+=("$line")
  echo "$line"
}

skip() {
  local name="$1"
  local reason="${2:-skipped}"
  SKIP=$((SKIP + 1))
  local line
  line="$(format_result_line "-" "SKIP" "$name" "- $reason")"
  RESULT_LINES+=("$line")
  echo "$line"
}

check_result() {
  local response="$1"
  local jq_filter="$2"
  printf '%s' "$response" | jq -e "$jq_filter" >/dev/null 2>&1
}

json_value() {
  local response="$1"
  local jq_filter="$2"
  printf '%s' "$response" | jq -r "$jq_filter"
}

tool_text() {
  local response="$1"
  json_value "$response" '.result.content[0].text // .error.message // "Unknown error"'
}

is_team_not_found_error() {
  local response="$1"
  local text
  text="$(tool_text "$response")"
  printf '%s' "$text" | grep -qiE 'team|iteration'
}

http_get() {
  local url="$1"
  local body_file
  body_file="$(mktemp)"

  if ! LAST_HTTP_STATUS="$(curl -sS -o "$body_file" -w "%{http_code}" "$url")"; then
    rm -f "$body_file"
    return 1
  fi

  LAST_HTTP_BODY="$(cat "$body_file")"
  rm -f "$body_file"
}

http_post_json() {
  local url="$1"
  local payload="$2"
  local body_file
  body_file="$(mktemp)"

  if ! LAST_HTTP_STATUS="$(curl -sS -o "$body_file" -w "%{http_code}" \
    -H "Authorization: Bearer $PAT" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -X POST \
    --data "$payload" \
    "$url")"; then
    rm -f "$body_file"
    return 1
  fi

  LAST_HTTP_BODY="$(cat "$body_file")"
  rm -f "$body_file"
}

extract_json_payload() {
  local raw_body="$1"

  if printf '%s' "$raw_body" | jq -e . >/dev/null 2>&1; then
    printf '%s' "$raw_body"
    return 0
  fi

  local payload
  payload="$(printf '%s\n' "$raw_body" | sed -n 's/^data:[[:space:]]*//p' | tail -n 1)"
  if [ -z "$payload" ]; then
    return 1
  fi

  printf '%s' "$payload"
}

mcp_request() {
  local id="$1"
  local method="$2"
  local params_json="$3"
  local payload

  payload="$(jq -cn \
    --argjson id "$id" \
    --arg method "$method" \
    --argjson params "$params_json" \
    '{jsonrpc:"2.0", id:$id, method:$method, params:$params}')"

  http_post_json "$BASE_URL/mcp" "$payload"
  extract_json_payload "$LAST_HTTP_BODY"
}

mcp_call() {
  local id="$1"
  local tool_name="$2"
  local args_json="$3"
  local params_json

  params_json="$(jq -cn \
    --arg name "$tool_name" \
    --argjson arguments "$args_json" \
    '{name:$name, arguments:$arguments}')"

  mcp_request "$id" "tools/call" "$params_json"
}

validate_tool_response() {
  local response="$1"
  LAST_FAILURE_REASON=""

  if [ "$LAST_HTTP_STATUS" != "200" ]; then
    LAST_FAILURE_REASON="HTTP status $LAST_HTTP_STATUS"
    return 1
  fi

  if ! check_result "$response" '.result != null'; then
    LAST_FAILURE_REASON="response does not contain result"
    return 1
  fi

  if check_result "$response" '.error != null'; then
    LAST_FAILURE_REASON="JSON-RPC error returned"
    return 1
  fi

  if check_result "$response" '.result.isError == true'; then
    LAST_FAILURE_REASON="$(tool_text "$response")"
    return 2
  fi

  if ! check_result "$response" '.result.content | type == "array" and length > 0'; then
    LAST_FAILURE_REASON="result.content missing or empty"
    return 1
  fi

  return 0
}

test_health_check() {
  local name="health_check"

  if ! http_get "$BASE_URL/health"; then
    fail "$name" "could not reach $BASE_URL/health"
    return
  fi

  if [ "$LAST_HTTP_STATUS" != "200" ]; then
    fail "$name" "HTTP status $LAST_HTTP_STATUS"
    return
  fi

  if ! check_result "$LAST_HTTP_BODY" '.status == "ok"'; then
    fail "$name" 'status != "ok"'
    return
  fi

  pass "$name"
}

test_initialize() {
  local name="initialize"
  local response

  if ! response="$(mcp_request 1 "initialize" '{
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "test-client", "version": "1.0" }
  }')"; then
    fail "$name" "request failed"
    return
  fi

  if [ "$LAST_HTTP_STATUS" != "200" ]; then
    fail "$name" "HTTP status $LAST_HTTP_STATUS"
    return
  fi

  if check_result "$response" '.error != null'; then
    fail "$name" "$(json_value "$response" '.error.message // "unknown error"')"
    return
  fi

  if ! check_result "$response" '.result.protocolVersion != null'; then
    fail "$name" "protocolVersion missing"
    return
  fi

  pass "$name" "protocol $(json_value "$response" '.result.protocolVersion')"
}

test_tools_list() {
  local name="tools_list"
  local response
  local count

  if ! response="$(mcp_request 2 "tools/list" '{}')"; then
    fail "$name" "request failed"
    return
  fi

  if [ "$LAST_HTTP_STATUS" != "200" ]; then
    fail "$name" "HTTP status $LAST_HTTP_STATUS"
    return
  fi

  if check_result "$response" '.error != null'; then
    fail "$name" "$(json_value "$response" '.error.message // "unknown error"')"
    return
  fi

  if ! check_result "$response" '.result.tools | type == "array"'; then
    fail "$name" "tools list missing"
    return
  fi

  count="$(json_value "$response" '.result.tools | length')"
  pass "$name" "$count tools found"
}

test_list_projects() {
  local name="list_projects"
  local response
  local count
  local names

  if ! response="$(mcp_call 3 "list_projects" '{}')"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.projects | type == "array"'; then
    fail "$name" "projects array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.projects | length')"
  if [ "$count" -eq 0 ]; then
    fail "$name" "no projects found"
    return
  fi

  FIRST_PROJECT="$(json_value "$response" '.result.structuredContent.projects[0].name // empty')"
  names="$(json_value "$response" '.result.structuredContent.projects | map(.name) | join(", ")')"
  pass "$name" "$names"
}

test_list_repositories() {
  local name="list_repositories"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 4 "list_repositories" "$(jq -cn --arg project "$FIRST_PROJECT" '{project:$project}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.repositories | type == "array"'; then
    fail "$name" "repositories array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.repositories | length')"
  FIRST_REPO="$(json_value "$response" '.result.structuredContent.repositories[0].name // empty')"
  pass "$name" "$count repos found"
}

test_list_pull_requests() {
  local name="list_pull_requests"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_REPO" ]; then
    skip "$name" "no repository available from list_repositories"
    return
  fi

  if ! response="$(mcp_call 5 "list_pull_requests" "$(jq -cn --arg project "$FIRST_PROJECT" --arg repository "$FIRST_REPO" --arg status "active" '{project:$project, repository:$repository, status:$status}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.pullRequests | type == "array"'; then
    fail "$name" "pullRequests array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.pullRequests | length')"
  FIRST_PULL_REQUEST_ID="$(json_value "$response" '.result.structuredContent.pullRequests[0].id // empty')"
  pass "$name" "$count active PRs found"
}

test_get_pull_request_work_items() {
  local name="get_pull_request_work_items"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_REPO" ]; then
    skip "$name" "no repository available from list_repositories"
    return
  fi

  if [ -z "$FIRST_PULL_REQUEST_ID" ]; then
    skip "$name" "no pull request available from list_pull_requests"
    return
  fi

  if ! response="$(mcp_call 16 "get_pull_request_work_items" "$(jq -cn --arg project "$FIRST_PROJECT" --arg repository "$FIRST_REPO" --argjson pullRequestId "$FIRST_PULL_REQUEST_ID" '{project:$project, repository:$repository, pullRequestId:$pullRequestId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.workItems | type == "array"'; then
    fail "$name" "workItems array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.workItems | length')"
  pass "$name" "$count linked work items found"
}

test_search_work_items() {
  local name="search_work_items"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 6 "search_work_items" "$(jq -cn --arg project "$FIRST_PROJECT" '{project:$project, top:5}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.workItems | type == "array"'; then
    fail "$name" "workItems array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.workItems | length')"
  FIRST_WORK_ITEM_ID="$(json_value "$response" '.result.structuredContent.workItems[0].id // empty')"
  pass "$name" "$count work items found"
}

test_get_work_item() {
  local name="get_work_item"
  local response
  local title

  if [ -z "$FIRST_WORK_ITEM_ID" ]; then
    skip "$name" "no work item available from search_work_items"
    return
  fi

  if ! response="$(mcp_call 7 "get_work_item" "$(jq -cn --argjson id "$FIRST_WORK_ITEM_ID" '{id:$id}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  title="$(json_value "$response" '.result.structuredContent.title // empty')"
  if [ -z "$title" ]; then
    fail "$name" "title missing"
    return
  fi

  pass "$name" "$title"
}

test_get_cross_project_dependencies() {
  local name="get_cross_project_dependencies"
  local response

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_WORK_ITEM_ID" ]; then
    skip "$name" "no work item available from search_work_items"
    return
  fi

  if ! response="$(mcp_call 20 "get_cross_project_dependencies" "$(jq -cn --arg project "$FIRST_PROJECT" --argjson workItemId "$FIRST_WORK_ITEM_ID" '{project:$project, workItemId:$workItemId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.workItem != null'; then
    fail "$name" "workItem summary missing"
    return
  fi

  pass "$name" "cross-project count $(json_value "$response" '.result.structuredContent.crossProjectCount // 0')"
}

test_list_pipelines() {
  local name="list_pipelines"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 8 "list_pipelines" "$(jq -cn --arg project "$FIRST_PROJECT" '{project:$project}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.pipelines | type == "array"'; then
    fail "$name" "pipelines array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.pipelines | length')"
  pass "$name" "$count pipelines found"
}

test_list_pipeline_runs() {
  local name="list_pipeline_runs"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 9 "list_pipeline_runs" "$(jq -cn --arg project "$FIRST_PROJECT" '{project:$project, top:5}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.pipelineRuns | type == "array"'; then
    fail "$name" "pipelineRuns array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.pipelineRuns | length')"
  FIRST_PIPELINE_RUN_ID="$(json_value "$response" '.result.structuredContent.pipelineRuns[0].id // empty')"
  pass "$name" "$count runs found"
}

test_list_pipeline_artifacts() {
  local name="list_pipeline_artifacts"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_PIPELINE_RUN_ID" ]; then
    skip "$name" "no pipeline run available from list_pipeline_runs"
    return
  fi

  if ! response="$(mcp_call 19 "list_pipeline_artifacts" "$(jq -cn --arg project "$FIRST_PROJECT" --argjson runId "$FIRST_PIPELINE_RUN_ID" '{project:$project, runId:$runId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.artifacts | type == "array"'; then
    fail "$name" "artifacts array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.artifacts | length')"
  pass "$name" "$count artifacts found"
}

test_analyze_pipeline_failure() {
  local name="analyze_pipeline_failure"
  local response

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_PIPELINE_RUN_ID" ]; then
    skip "$name" "no pipeline run available from list_pipeline_runs"
    return
  fi

  if ! response="$(mcp_call 21 "analyze_pipeline_failure" "$(jq -cn --arg project "$FIRST_PROJECT" --argjson runId "$FIRST_PIPELINE_RUN_ID" '{project:$project, runId:$runId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.summary != null'; then
    fail "$name" "analysis summary missing"
    return
  fi

  pass "$name" "$(json_value "$response" '.result.structuredContent.summary')"
}

test_list_test_plans() {
  local name="list_test_plans"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 10 "list_test_plans" "$(jq -cn --arg project "$FIRST_PROJECT" '{project:$project}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.testPlans | type == "array"'; then
    fail "$name" "testPlans array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.testPlans | length')"
  FIRST_TEST_PLAN_ID="$(json_value "$response" '.result.structuredContent.testPlans[0].id // empty')"
  pass "$name" "$count test plans found"
}

test_list_test_suites() {
  local name="list_test_suites"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_TEST_PLAN_ID" ]; then
    skip "$name" "no test plan available from list_test_plans"
    return
  fi

  if ! response="$(mcp_call 17 "list_test_suites" "$(jq -cn --arg project "$FIRST_PROJECT" --argjson planId "$FIRST_TEST_PLAN_ID" '{project:$project, planId:$planId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.testSuites | type == "array"'; then
    fail "$name" "testSuites array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.testSuites | length')"
  FIRST_TEST_SUITE_ID="$(json_value "$response" '.result.structuredContent.testSuites[0].id // empty')"
  pass "$name" "$count test suites found"
}

test_list_test_cases() {
  local name="list_test_cases"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_TEST_PLAN_ID" ]; then
    skip "$name" "no test plan available from list_test_plans"
    return
  fi

  if [ -z "$FIRST_TEST_SUITE_ID" ]; then
    skip "$name" "no test suite available from list_test_suites"
    return
  fi

  if ! response="$(mcp_call 18 "list_test_cases" "$(jq -cn --arg project "$FIRST_PROJECT" --argjson planId "$FIRST_TEST_PLAN_ID" --argjson suiteId "$FIRST_TEST_SUITE_ID" '{project:$project, planId:$planId, suiteId:$suiteId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.testCases | type == "array"'; then
    fail "$name" "testCases array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.testCases | length')"
  pass "$name" "$count test cases found"
}

test_list_test_runs() {
  local name="list_test_runs"
  local response
  local count

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 11 "list_test_runs" "$(jq -cn --arg project "$FIRST_PROJECT" '{project:$project, top:5}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.testRuns | type == "array"'; then
    fail "$name" "testRuns array missing"
    return
  fi

  count="$(json_value "$response" '.result.structuredContent.testRuns | length')"
  FIRST_TEST_RUN_ID="$(json_value "$response" '.result.structuredContent.testRuns[0].id // empty')"
  pass "$name" "$count test runs found"
}

test_analyze_test_failure_impact() {
  local name="analyze_test_failure_impact"
  local response

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if [ -z "$FIRST_TEST_RUN_ID" ]; then
    skip "$name" "no test run available from list_test_runs"
    return
  fi

  if ! response="$(mcp_call 22 "analyze_test_failure_impact" "$(jq -cn --arg project "$FIRST_PROJECT" --argjson testRunId "$FIRST_TEST_RUN_ID" '{project:$project, testRunId:$testRunId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.impactSummary != null'; then
    fail "$name" "impact summary missing"
    return
  fi

  pass "$name" "$(json_value "$response" '.result.structuredContent.impactSummary')"
}

test_get_my_daily_digest() {
  local name="get_my_daily_digest"
  local response

  if [ -z "${AZDO_TEST_EMAIL:-}" ]; then
    skip "$name" "AZDO_TEST_EMAIL not set"
    return
  fi

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 12 "get_my_daily_digest" "$(jq -cn --arg project "$FIRST_PROJECT" --arg myEmail "$AZDO_TEST_EMAIL" '{project:$project, myEmail:$myEmail}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.generatedAt != null'; then
    fail "$name" "daily digest result is empty"
    return
  fi

  pass "$name" "generated at $(json_value "$response" '.result.structuredContent.generatedAt')"
}

test_get_sprint_summary() {
  local name="get_sprint_summary"
  local response
  local team_name
  local validation_status

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  team_name="$FIRST_PROJECT Team"

  if ! response="$(mcp_call 13 "get_sprint_summary" "$(jq -cn --arg project "$FIRST_PROJECT" --arg team "$team_name" '{project:$project, team:$team}')")"; then
    fail "$name" "request failed"
    return
  fi

  if validate_tool_response "$response"; then
    validation_status=0
  else
    validation_status=$?
  fi
  if [ "$validation_status" -eq 0 ]; then
    if ! check_result "$response" '.result.structuredContent.sprint != null'; then
      fail "$name" "sprint result is empty"
      return
    fi

    pass "$name"
    return
  fi

  if [ "$validation_status" -eq 2 ] && is_team_not_found_error "$response"; then
    skip "$name" "$LAST_FAILURE_REASON"
    return
  fi

  fail "$name" "$LAST_FAILURE_REASON"
}

test_get_blocked_items() {
  local name="get_blocked_items"
  local response

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  if ! response="$(mcp_call 14 "get_blocked_items" "$(jq -cn --arg project "$FIRST_PROJECT" '{project:$project}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.blockedItems | type == "array"'; then
    fail "$name" "blocked items result is empty"
    return
  fi

  pass "$name"
}

test_get_sprint_capacity() {
  local name="get_sprint_capacity"
  local response
  local team_name
  local validation_status

  if [ -z "$FIRST_PROJECT" ]; then
    skip "$name" "no project available from list_projects"
    return
  fi

  team_name="$FIRST_PROJECT Team"

  if ! response="$(mcp_call 15 "get_sprint_capacity" "$(jq -cn --arg project "$FIRST_PROJECT" --arg team "$team_name" '{project:$project, team:$team}')")"; then
    fail "$name" "request failed"
    return
  fi

  if validate_tool_response "$response"; then
    validation_status=0
  else
    validation_status=$?
  fi
  if [ "$validation_status" -eq 0 ]; then
    if ! check_result "$response" '.result.structuredContent.members | type == "array"'; then
      fail "$name" "sprint capacity result is empty"
      return
    fi

    pass "$name"
    return
  fi

  if [ "$validation_status" -eq 2 ] && is_team_not_found_error "$response"; then
    skip "$name" "$LAST_FAILURE_REASON"
    return
  fi

  fail "$name" "$LAST_FAILURE_REASON"
}

test_get_dashboard_widget_data() {
  local name="get_dashboard_widget_data"
  local response
  local dashboard_project

  dashboard_project="${AZDO_DASHBOARD_PROJECT:-$FIRST_PROJECT}"

  if [ -z "$dashboard_project" ]; then
    skip "$name" "no project available for dashboard lookup"
    return
  fi

  if [ -z "${AZDO_DASHBOARD_ID:-}" ] || [ -z "${AZDO_WIDGET_ID:-}" ]; then
    skip "$name" "AZDO_DASHBOARD_ID or AZDO_WIDGET_ID not set"
    return
  fi

  if ! response="$(mcp_call 23 "get_dashboard_widget_data" "$(jq -cn --arg project "$dashboard_project" --arg dashboardId "$AZDO_DASHBOARD_ID" --arg widgetId "$AZDO_WIDGET_ID" '{project:$project, dashboardId:$dashboardId, widgetId:$widgetId}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.widgetName != null'; then
    fail "$name" "widgetName missing"
    return
  fi

  pass "$name" "$(json_value "$response" '.result.structuredContent.widgetName')"
}

test_get_wiki_page() {
  local name="get_wiki_page"
  local response
  local wiki_project

  wiki_project="${AZDO_WIKI_PROJECT:-$FIRST_PROJECT}"

  if [ -z "$wiki_project" ]; then
    skip "$name" "no project available for wiki lookup"
    return
  fi

  if [ -z "${AZDO_WIKI_IDENTIFIER:-}" ] || [ -z "${AZDO_WIKI_PATH:-}" ]; then
    skip "$name" "AZDO_WIKI_IDENTIFIER or AZDO_WIKI_PATH not set"
    return
  fi

  if ! response="$(mcp_call 24 "get_wiki_page" "$(jq -cn --arg project "$wiki_project" --arg wikiIdentifier "$AZDO_WIKI_IDENTIFIER" --arg path "$AZDO_WIKI_PATH" '{project:$project, wikiIdentifier:$wikiIdentifier, path:$path}')")"; then
    fail "$name" "request failed"
    return
  fi

  if ! validate_tool_response "$response"; then
    fail "$name" "$LAST_FAILURE_REASON"
    return
  fi

  if ! check_result "$response" '.result.structuredContent.content != null'; then
    fail "$name" "wiki content missing"
    return
  fi

  pass "$name" "$(json_value "$response" '.result.structuredContent.path')"
}

test_health_check
test_initialize
test_tools_list
test_list_projects
test_list_repositories
test_list_pull_requests
test_get_pull_request_work_items
test_search_work_items
test_get_work_item
test_get_cross_project_dependencies
test_list_pipelines
test_list_pipeline_runs
test_list_pipeline_artifacts
test_analyze_pipeline_failure
test_list_test_plans
test_list_test_suites
test_list_test_cases
test_list_test_runs
test_analyze_test_failure_impact
test_get_my_daily_digest
test_get_sprint_summary
test_get_blocked_items
test_get_sprint_capacity
test_get_dashboard_widget_data
test_get_wiki_page

echo
echo "================================"
echo "MCP Server Test Results"
echo "================================"
printf '%s\n' "${RESULT_LINES[@]}"
echo "================================"
printf 'PASSED:  %d\n' "$PASS"
printf 'FAILED:  %d\n' "$FAIL"
printf 'SKIPPED: %d\n' "$SKIP"
echo "================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
