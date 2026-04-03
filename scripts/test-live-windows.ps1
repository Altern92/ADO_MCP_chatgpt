#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

if (Test-Path .env) {
    Get-Content .env |
        Where-Object { $_ -match '^\s*[^#]' } |
        ForEach-Object {
            $key, $val = $_ -split '=', 2
            Set-Variable -Name $key.Trim() -Value $val.Trim() -Scope Script
        }
}

$script:BaseUrl = if ($script:MCP_TEST_URL) { $script:MCP_TEST_URL } else { "http://localhost:3000" }
$script:Pat = $script:AZDO_PAT
$script:PassCount = 0
$script:FailCount = 0
$script:SkipCount = 0
$script:LastHttpStatus = 0
$script:LastHttpBody = $null
$script:LastFailureReason = ""
$script:FirstProject = $null
$script:FirstRepo = $null
$script:FirstPullRequestId = $null
$script:FirstWorkItemId = $null
$script:FirstPipelineRunId = $null
$script:FirstTestPlanId = $null
$script:FirstTestSuiteId = $null
$script:FirstTestRunId = $null
$script:ResultLines = New-Object System.Collections.Generic.List[string]
$script:PassSymbol = [char]0x2713
$script:FailSymbol = [char]0x2717

Write-Host "Testing MCP server at: $($script:BaseUrl)"
Write-Host "Azure DevOps org: $(if ($script:AZDO_ORG) { $script:AZDO_ORG } else { '<not set>' })"

if ([string]::IsNullOrWhiteSpace($script:Pat)) {
    Write-Host "ERROR: AZDO_PAT not set. Add it to .env or export it."
    exit 1
}

function Format-ResultLine {
    param(
        [Parameter(Mandatory = $true)][string]$Symbol,
        [Parameter(Mandatory = $true)][string]$Status,
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Info = ""
    )

    $suffix = ""
    if (-not [string]::IsNullOrWhiteSpace($Info)) {
        $suffix = " ($Info)"
    }

    return "{0} {1,-5} {2,-18}{3}" -f $Symbol, $Status, $Name, $suffix
}

function Write-Pass {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Info = ""
    )

    $script:PassCount++
    $line = Format-ResultLine -Symbol $script:PassSymbol -Status "PASS" -Name $Name -Info $Info
    $script:ResultLines.Add($line)
    Write-Host $line
}

function Write-Fail {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Reason = "unknown error"
    )

    $script:FailCount++
    $line = Format-ResultLine -Symbol $script:FailSymbol -Status "FAIL" -Name $Name -Info "- $Reason"
    $script:ResultLines.Add($line)
    Write-Host $line
}

function Write-Skip {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Reason = "skipped"
    )

    $script:SkipCount++
    $line = Format-ResultLine -Symbol "-" -Status "SKIP" -Name $Name -Info "- $Reason"
    $script:ResultLines.Add($line)
    Write-Host $line
}

function Get-StatusCodeFromException {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return 0
    }

    try {
        if ($response -is [System.Net.Http.HttpResponseMessage]) {
            return [int]$response.StatusCode
        }

        return [int]$response.StatusCode.value__
    } catch {
        return 0
    }
}

function Get-ErrorBodyFromException {
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return $null
    }

    try {
        if ($response -is [System.Net.Http.HttpResponseMessage]) {
            return $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }

        $stream = $response.GetResponseStream()
        if ($null -eq $stream) {
            return $null
        }

        $reader = [System.IO.StreamReader]::new($stream)
        try {
            return $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
        }
    } catch {
        return $null
    }
}

function Invoke-JsonGet {
    param([Parameter(Mandatory = $true)][string]$Url)

    $script:LastHttpStatus = 0
    $script:LastHttpBody = $null

    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -Headers @{
            Accept = "application/json"
        }

        $script:LastHttpStatus = 200
        $script:LastHttpBody = $response
        return $response
    } catch {
        $script:LastHttpStatus = Get-StatusCodeFromException -ErrorRecord $_
        $script:LastHttpBody = Get-ErrorBodyFromException -ErrorRecord $_
        return $null
    }
}

function Extract-JsonPayload {
    param([Parameter(Mandatory = $true)]$RawBody)

    if ($RawBody -isnot [string]) {
        return $RawBody
    }

    try {
        return $RawBody | ConvertFrom-Json -Depth 100
    } catch {
        $payloadLines = @($RawBody -split "`r?`n" | Where-Object { $_ -match '^data:\s*' })
        if ($payloadLines.Count -eq 0) {
            throw "Could not extract JSON payload from MCP response."
        }

        $payload = $payloadLines[-1] -replace '^data:\s*', ''
        return $payload | ConvertFrom-Json -Depth 100
    }
}

function Get-ArrayValues {
    param($Value)

    if ($null -eq $Value) {
        return @()
    }

    if ($Value -is [System.Array]) {
        return $Value
    }

    return @($Value)
}

function Invoke-McpRequest {
    param(
        [Parameter(Mandatory = $true)][int]$Id,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)]$Params
    )

    $payload = @{
        jsonrpc = "2.0"
        id = $Id
        method = $Method
        params = $Params
    } | ConvertTo-Json -Depth 100 -Compress

    $script:LastHttpStatus = 0
    $script:LastHttpBody = $null

    try {
        $response = Invoke-RestMethod -Uri "$($script:BaseUrl)/mcp" -Method Post -Headers @{
            Authorization = "Bearer $($script:Pat)"
            Accept = "application/json, text/event-stream"
        } -ContentType "application/json" -Body $payload

        $script:LastHttpStatus = 200
        $script:LastHttpBody = $response
        return Extract-JsonPayload -RawBody $response
    } catch {
        $script:LastHttpStatus = Get-StatusCodeFromException -ErrorRecord $_
        $script:LastHttpBody = Get-ErrorBodyFromException -ErrorRecord $_
        return $null
    }
}

function Invoke-McpToolCall {
    param(
        [Parameter(Mandatory = $true)][int]$Id,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)]$Arguments
    )

    return Invoke-McpRequest -Id $Id -Method "tools/call" -Params @{
        name = $Name
        arguments = $Arguments
    }
}

function Get-ToolText {
    param($Response)

    $content = Get-ArrayValues -Value $Response.result.content
    if ($null -ne $Response.result -and $content.Count -gt 0) {
        return [string]$content[0].text
    }

    if ($null -ne $Response.error) {
        return [string]$Response.error.message
    }

    return "Unknown error"
}

function Test-ToolResponse {
    param($Response)

    $script:LastFailureReason = ""

    if ($script:LastHttpStatus -ne 200) {
        $script:LastFailureReason = "HTTP status $($script:LastHttpStatus)"
        return 1
    }

    if ($null -eq $Response) {
        $script:LastFailureReason = "response body missing"
        return 1
    }

    if ($null -eq $Response.result) {
        $script:LastFailureReason = "response does not contain result"
        return 1
    }

    if ($null -ne $Response.error) {
        $script:LastFailureReason = "JSON-RPC error returned"
        return 1
    }

    if ($Response.result.isError -eq $true) {
        $script:LastFailureReason = Get-ToolText -Response $Response
        return 2
    }

    $content = Get-ArrayValues -Value $Response.result.content
    if ($content.Count -eq 0) {
        $script:LastFailureReason = "result.content missing or empty"
        return 1
    }

    return 0
}

function Test-TeamNotFoundError {
    param($Response)

    $text = Get-ToolText -Response $Response
    return $text -match 'team|iteration'
}

function Test-HealthCheck {
    $name = "health_check"
    $response = Invoke-JsonGet -Url "$($script:BaseUrl)/health"

    if ($null -eq $response) {
        Write-Fail -Name $name -Reason "could not reach $($script:BaseUrl)/health"
        return
    }

    if ($script:LastHttpStatus -ne 200) {
        Write-Fail -Name $name -Reason "HTTP status $($script:LastHttpStatus)"
        return
    }

    if ($response.status -ne "ok") {
        Write-Fail -Name $name -Reason 'status != "ok"'
        return
    }

    Write-Pass -Name $name
}

function Test-Initialize {
    $name = "initialize"
    $response = Invoke-McpRequest -Id 1 -Method "initialize" -Params @{
        protocolVersion = "2024-11-05"
        capabilities = @{}
        clientInfo = @{
            name = "test-client"
            version = "1.0"
        }
    }

    if ($null -eq $response) {
        Write-Fail -Name $name -Reason "request failed"
        return
    }

    if ($script:LastHttpStatus -ne 200) {
        Write-Fail -Name $name -Reason "HTTP status $($script:LastHttpStatus)"
        return
    }

    if ($null -ne $response.error) {
        Write-Fail -Name $name -Reason ([string]$response.error.message)
        return
    }

    if ([string]::IsNullOrWhiteSpace([string]$response.result.protocolVersion)) {
        Write-Fail -Name $name -Reason "protocolVersion missing"
        return
    }

    Write-Pass -Name $name -Info "protocol $($response.result.protocolVersion)"
}

function Test-ToolsList {
    $name = "tools_list"
    $response = Invoke-McpRequest -Id 2 -Method "tools/list" -Params @{}

    if ($null -eq $response) {
        Write-Fail -Name $name -Reason "request failed"
        return
    }

    if ($script:LastHttpStatus -ne 200) {
        Write-Fail -Name $name -Reason "HTTP status $($script:LastHttpStatus)"
        return
    }

    if ($null -ne $response.error) {
        Write-Fail -Name $name -Reason ([string]$response.error.message)
        return
    }

    if ($null -eq $response.result.tools) {
        Write-Fail -Name $name -Reason "tools list missing"
        return
    }

    $tools = Get-ArrayValues -Value $response.result.tools
    if ($tools.Count -eq 0) {
        Write-Fail -Name $name -Reason "tools list missing"
        return
    }

    Write-Pass -Name $name -Info "$($tools.Count) tools found"
}

function Test-ListProjects {
    $name = "list_projects"
    $response = Invoke-McpToolCall -Id 3 -Name "list_projects" -Arguments @{}

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.projects) {
        Write-Fail -Name $name -Reason "projects array missing"
        return
    }

    $projects = Get-ArrayValues -Value $response.result.structuredContent.projects
    if ($projects.Count -eq 0) {
        Write-Fail -Name $name -Reason "no projects found"
        return
    }

    $script:FirstProject = [string]$projects[0].name
    $projectNames = ($projects | ForEach-Object { $_.name }) -join ", "
    Write-Pass -Name $name -Info $projectNames
}

function Test-ListRepositories {
    $name = "list_repositories"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 4 -Name "list_repositories" -Arguments @{
        project = $script:FirstProject
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.repositories) {
        Write-Fail -Name $name -Reason "repositories array missing"
        return
    }

    $repositories = Get-ArrayValues -Value $response.result.structuredContent.repositories
    if ($repositories.Count -gt 0) {
        $script:FirstRepo = [string]$repositories[0].name
    }

    Write-Pass -Name $name -Info "$($repositories.Count) repos found"
}

function Test-ListPullRequests {
    $name = "list_pull_requests"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ([string]::IsNullOrWhiteSpace($script:FirstRepo)) {
        Write-Skip -Name $name -Reason "no repository available from list_repositories"
        return
    }

    $response = Invoke-McpToolCall -Id 5 -Name "list_pull_requests" -Arguments @{
        project = $script:FirstProject
        repository = $script:FirstRepo
        status = "active"
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.pullRequests) {
        Write-Fail -Name $name -Reason "pullRequests array missing"
        return
    }

    $pullRequests = Get-ArrayValues -Value $response.result.structuredContent.pullRequests
    if ($pullRequests.Count -gt 0) {
        $script:FirstPullRequestId = [int]$pullRequests[0].id
    }

    Write-Pass -Name $name -Info "$($pullRequests.Count) active PRs found"
}

function Test-GetPullRequestWorkItems {
    $name = "get_pull_request_work_items"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ([string]::IsNullOrWhiteSpace($script:FirstRepo)) {
        Write-Skip -Name $name -Reason "no repository available from list_repositories"
        return
    }

    if ($null -eq $script:FirstPullRequestId) {
        Write-Skip -Name $name -Reason "no pull request available from list_pull_requests"
        return
    }

    $response = Invoke-McpToolCall -Id 16 -Name "get_pull_request_work_items" -Arguments @{
        project = $script:FirstProject
        repository = $script:FirstRepo
        pullRequestId = $script:FirstPullRequestId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.workItems) {
        Write-Fail -Name $name -Reason "workItems array missing"
        return
    }

    $workItems = Get-ArrayValues -Value $response.result.structuredContent.workItems
    Write-Pass -Name $name -Info "$($workItems.Count) linked work items found"
}

function Test-SearchWorkItems {
    $name = "search_work_items"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 6 -Name "search_work_items" -Arguments @{
        project = $script:FirstProject
        top = 5
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.workItems) {
        Write-Fail -Name $name -Reason "workItems array missing"
        return
    }

    $workItems = Get-ArrayValues -Value $response.result.structuredContent.workItems
    if ($workItems.Count -eq 0) {
        Write-Fail -Name $name -Reason "workItems array missing"
        return
    }

    $script:FirstWorkItemId = [int]$workItems[0].id
    Write-Pass -Name $name -Info "$($workItems.Count) work items found"
}

function Test-GetWorkItem {
    $name = "get_work_item"

    if ($null -eq $script:FirstWorkItemId) {
        Write-Skip -Name $name -Reason "no work item available from search_work_items"
        return
    }

    $response = Invoke-McpToolCall -Id 7 -Name "get_work_item" -Arguments @{
        id = $script:FirstWorkItemId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    $title = [string]$response.result.structuredContent.title
    if ([string]::IsNullOrWhiteSpace($title)) {
        Write-Fail -Name $name -Reason "title missing"
        return
    }

    Write-Pass -Name $name -Info $title
}

function Test-GetCrossProjectDependencies {
    $name = "get_cross_project_dependencies"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ($null -eq $script:FirstWorkItemId) {
        Write-Skip -Name $name -Reason "no work item available from search_work_items"
        return
    }

    $response = Invoke-McpToolCall -Id 20 -Name "get_cross_project_dependencies" -Arguments @{
        project = $script:FirstProject
        workItemId = $script:FirstWorkItemId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.workItem) {
        Write-Fail -Name $name -Reason "workItem summary missing"
        return
    }

    Write-Pass -Name $name -Info "cross-project count $($response.result.structuredContent.crossProjectCount)"
}

function Test-ListPipelines {
    $name = "list_pipelines"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 8 -Name "list_pipelines" -Arguments @{
        project = $script:FirstProject
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.pipelines) {
        Write-Fail -Name $name -Reason "pipelines array missing"
        return
    }

    $pipelines = Get-ArrayValues -Value $response.result.structuredContent.pipelines
    Write-Pass -Name $name -Info "$($pipelines.Count) pipelines found"
}

function Test-ListPipelineRuns {
    $name = "list_pipeline_runs"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 9 -Name "list_pipeline_runs" -Arguments @{
        project = $script:FirstProject
        top = 5
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.pipelineRuns) {
        Write-Fail -Name $name -Reason "pipelineRuns array missing"
        return
    }

    $pipelineRuns = Get-ArrayValues -Value $response.result.structuredContent.pipelineRuns
    if ($pipelineRuns.Count -gt 0) {
        $script:FirstPipelineRunId = [int]$pipelineRuns[0].id
    }

    Write-Pass -Name $name -Info "$($pipelineRuns.Count) runs found"
}

function Test-ListPipelineArtifacts {
    $name = "list_pipeline_artifacts"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ($null -eq $script:FirstPipelineRunId) {
        Write-Skip -Name $name -Reason "no pipeline run available from list_pipeline_runs"
        return
    }

    $response = Invoke-McpToolCall -Id 19 -Name "list_pipeline_artifacts" -Arguments @{
        project = $script:FirstProject
        runId = $script:FirstPipelineRunId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.artifacts) {
        Write-Fail -Name $name -Reason "artifacts array missing"
        return
    }

    $artifacts = Get-ArrayValues -Value $response.result.structuredContent.artifacts
    Write-Pass -Name $name -Info "$($artifacts.Count) artifacts found"
}

function Test-AnalyzePipelineFailure {
    $name = "analyze_pipeline_failure"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ($null -eq $script:FirstPipelineRunId) {
        Write-Skip -Name $name -Reason "no pipeline run available from list_pipeline_runs"
        return
    }

    $response = Invoke-McpToolCall -Id 21 -Name "analyze_pipeline_failure" -Arguments @{
        project = $script:FirstProject
        runId = $script:FirstPipelineRunId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ([string]::IsNullOrWhiteSpace([string]$response.result.structuredContent.summary)) {
        Write-Fail -Name $name -Reason "analysis summary missing"
        return
    }

    Write-Pass -Name $name -Info ([string]$response.result.structuredContent.summary)
}

function Test-ListTestPlans {
    $name = "list_test_plans"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 10 -Name "list_test_plans" -Arguments @{
        project = $script:FirstProject
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.testPlans) {
        Write-Fail -Name $name -Reason "testPlans array missing"
        return
    }

    $testPlans = Get-ArrayValues -Value $response.result.structuredContent.testPlans
    if ($testPlans.Count -gt 0) {
        $script:FirstTestPlanId = [int]$testPlans[0].id
    }

    Write-Pass -Name $name -Info "$($testPlans.Count) test plans found"
}

function Test-ListTestSuites {
    $name = "list_test_suites"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ($null -eq $script:FirstTestPlanId) {
        Write-Skip -Name $name -Reason "no test plan available from list_test_plans"
        return
    }

    $response = Invoke-McpToolCall -Id 17 -Name "list_test_suites" -Arguments @{
        project = $script:FirstProject
        planId = $script:FirstTestPlanId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.testSuites) {
        Write-Fail -Name $name -Reason "testSuites array missing"
        return
    }

    $testSuites = Get-ArrayValues -Value $response.result.structuredContent.testSuites
    if ($testSuites.Count -gt 0) {
        $script:FirstTestSuiteId = [int]$testSuites[0].id
    }

    Write-Pass -Name $name -Info "$($testSuites.Count) test suites found"
}

function Test-ListTestCases {
    $name = "list_test_cases"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ($null -eq $script:FirstTestPlanId) {
        Write-Skip -Name $name -Reason "no test plan available from list_test_plans"
        return
    }

    if ($null -eq $script:FirstTestSuiteId) {
        Write-Skip -Name $name -Reason "no test suite available from list_test_suites"
        return
    }

    $response = Invoke-McpToolCall -Id 18 -Name "list_test_cases" -Arguments @{
        project = $script:FirstProject
        planId = $script:FirstTestPlanId
        suiteId = $script:FirstTestSuiteId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.testCases) {
        Write-Fail -Name $name -Reason "testCases array missing"
        return
    }

    $testCases = Get-ArrayValues -Value $response.result.structuredContent.testCases
    Write-Pass -Name $name -Info "$($testCases.Count) test cases found"
}

function Test-ListTestRuns {
    $name = "list_test_runs"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 11 -Name "list_test_runs" -Arguments @{
        project = $script:FirstProject
        top = 5
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ($null -eq $response.result.structuredContent.testRuns) {
        Write-Fail -Name $name -Reason "testRuns array missing"
        return
    }

    $testRuns = Get-ArrayValues -Value $response.result.structuredContent.testRuns
    if ($testRuns.Count -gt 0) {
        $script:FirstTestRunId = [int]$testRuns[0].id
    }

    Write-Pass -Name $name -Info "$($testRuns.Count) test runs found"
}

function Test-AnalyzeTestFailureImpact {
    $name = "analyze_test_failure_impact"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    if ($null -eq $script:FirstTestRunId) {
        Write-Skip -Name $name -Reason "no test run available from list_test_runs"
        return
    }

    $response = Invoke-McpToolCall -Id 22 -Name "analyze_test_failure_impact" -Arguments @{
        project = $script:FirstProject
        testRunId = $script:FirstTestRunId
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ([string]::IsNullOrWhiteSpace([string]$response.result.structuredContent.impactSummary)) {
        Write-Fail -Name $name -Reason "impact summary missing"
        return
    }

    Write-Pass -Name $name -Info ([string]$response.result.structuredContent.impactSummary)
}

function Test-GetMyDailyDigest {
    $name = "get_my_daily_digest"

    if ([string]::IsNullOrWhiteSpace($script:AZDO_TEST_EMAIL)) {
        Write-Skip -Name $name -Reason "AZDO_TEST_EMAIL not set"
        return
    }

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 12 -Name "get_my_daily_digest" -Arguments @{
        project = $script:FirstProject
        myEmail = $script:AZDO_TEST_EMAIL
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ([string]::IsNullOrWhiteSpace([string]$response.result.structuredContent.generatedAt)) {
        Write-Fail -Name $name -Reason "daily digest result is empty"
        return
    }

    Write-Pass -Name $name -Info "generated at $($response.result.structuredContent.generatedAt)"
}

function Test-GetSprintSummary {
    $name = "get_sprint_summary"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 13 -Name "get_sprint_summary" -Arguments @{
        project = $script:FirstProject
        team = "$($script:FirstProject) Team"
    }

    $validationStatus = Test-ToolResponse -Response $response
    if ($validationStatus -eq 0) {
        if ($null -eq $response.result.structuredContent.sprint) {
            Write-Fail -Name $name -Reason "sprint result is empty"
            return
        }

        Write-Pass -Name $name
        return
    }

    if ($validationStatus -eq 2 -and (Test-TeamNotFoundError -Response $response)) {
        Write-Skip -Name $name -Reason $script:LastFailureReason
        return
    }

    Write-Fail -Name $name -Reason $script:LastFailureReason
}

function Test-GetBlockedItems {
    $name = "get_blocked_items"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 14 -Name "get_blocked_items" -Arguments @{
        project = $script:FirstProject
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    $blockedItems = Get-ArrayValues -Value $response.result.structuredContent.blockedItems
    if ($null -eq $response.result.structuredContent.blockedItems) {
        Write-Fail -Name $name -Reason "blocked items result is empty"
        return
    }

    Write-Pass -Name $name
}

function Test-GetSprintCapacity {
    $name = "get_sprint_capacity"

    if ([string]::IsNullOrWhiteSpace($script:FirstProject)) {
        Write-Skip -Name $name -Reason "no project available from list_projects"
        return
    }

    $response = Invoke-McpToolCall -Id 15 -Name "get_sprint_capacity" -Arguments @{
        project = $script:FirstProject
        team = "$($script:FirstProject) Team"
    }

    $validationStatus = Test-ToolResponse -Response $response
    if ($validationStatus -eq 0) {
        if ($null -eq $response.result.structuredContent.members) {
            Write-Fail -Name $name -Reason "sprint capacity result is empty"
            return
        }

        $members = Get-ArrayValues -Value $response.result.structuredContent.members
        Write-Pass -Name $name
        return
    }

    if ($validationStatus -eq 2 -and (Test-TeamNotFoundError -Response $response)) {
        Write-Skip -Name $name -Reason $script:LastFailureReason
        return
    }

    Write-Fail -Name $name -Reason $script:LastFailureReason
}

function Test-GetDashboardWidgetData {
    $name = "get_dashboard_widget_data"
    $dashboardProject = if ($script:AZDO_DASHBOARD_PROJECT) { $script:AZDO_DASHBOARD_PROJECT } else { $script:FirstProject }

    if ([string]::IsNullOrWhiteSpace($dashboardProject)) {
        Write-Skip -Name $name -Reason "no project available for dashboard lookup"
        return
    }

    if ([string]::IsNullOrWhiteSpace($script:AZDO_DASHBOARD_ID) -or [string]::IsNullOrWhiteSpace($script:AZDO_WIDGET_ID)) {
        Write-Skip -Name $name -Reason "AZDO_DASHBOARD_ID or AZDO_WIDGET_ID not set"
        return
    }

    $response = Invoke-McpToolCall -Id 23 -Name "get_dashboard_widget_data" -Arguments @{
        project = $dashboardProject
        dashboardId = $script:AZDO_DASHBOARD_ID
        widgetId = $script:AZDO_WIDGET_ID
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ([string]::IsNullOrWhiteSpace([string]$response.result.structuredContent.widgetName)) {
        Write-Fail -Name $name -Reason "widgetName missing"
        return
    }

    Write-Pass -Name $name -Info ([string]$response.result.structuredContent.widgetName)
}

function Test-GetWikiPage {
    $name = "get_wiki_page"
    $wikiProject = if ($script:AZDO_WIKI_PROJECT) { $script:AZDO_WIKI_PROJECT } else { $script:FirstProject }

    if ([string]::IsNullOrWhiteSpace($wikiProject)) {
        Write-Skip -Name $name -Reason "no project available for wiki lookup"
        return
    }

    if ([string]::IsNullOrWhiteSpace($script:AZDO_WIKI_IDENTIFIER) -or [string]::IsNullOrWhiteSpace($script:AZDO_WIKI_PATH)) {
        Write-Skip -Name $name -Reason "AZDO_WIKI_IDENTIFIER or AZDO_WIKI_PATH not set"
        return
    }

    $response = Invoke-McpToolCall -Id 24 -Name "get_wiki_page" -Arguments @{
        project = $wikiProject
        wikiIdentifier = $script:AZDO_WIKI_IDENTIFIER
        path = $script:AZDO_WIKI_PATH
    }

    if ((Test-ToolResponse -Response $response) -ne 0) {
        Write-Fail -Name $name -Reason $script:LastFailureReason
        return
    }

    if ([string]::IsNullOrWhiteSpace([string]$response.result.structuredContent.content)) {
        Write-Fail -Name $name -Reason "wiki content missing"
        return
    }

    Write-Pass -Name $name -Info ([string]$response.result.structuredContent.path)
}

Test-HealthCheck
Test-Initialize
Test-ToolsList
Test-ListProjects
Test-ListRepositories
Test-ListPullRequests
Test-GetPullRequestWorkItems
Test-SearchWorkItems
Test-GetWorkItem
Test-GetCrossProjectDependencies
Test-ListPipelines
Test-ListPipelineRuns
Test-ListPipelineArtifacts
Test-AnalyzePipelineFailure
Test-ListTestPlans
Test-ListTestSuites
Test-ListTestCases
Test-ListTestRuns
Test-AnalyzeTestFailureImpact
Test-GetMyDailyDigest
Test-GetSprintSummary
Test-GetBlockedItems
Test-GetSprintCapacity
Test-GetDashboardWidgetData
Test-GetWikiPage

Write-Host ""
Write-Host "================================"
Write-Host "MCP Server Test Results"
Write-Host "================================"
$script:ResultLines | ForEach-Object { Write-Host $_ }
Write-Host "================================"
Write-Host ("PASSED:  {0}" -f $script:PassCount)
Write-Host ("FAILED:  {0}" -f $script:FailCount)
Write-Host ("SKIPPED: {0}" -f $script:SkipCount)
Write-Host "================================"

if ($script:FailCount -gt 0) {
    exit 1
}
