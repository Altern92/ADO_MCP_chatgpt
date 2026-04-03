$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$healthUrl = "http://localhost:3000/health"
$stdoutLog = Join-Path $projectRoot "npm-dev.out.log"
$stderrLog = Join-Path $projectRoot "npm-dev.err.log"

function Test-McpServerReady {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

$process = $null

if (-not (Test-McpServerReady)) {
  $process = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru
}

$timeoutAt = (Get-Date).AddSeconds(60)

while ((Get-Date) -lt $timeoutAt) {
  if (Test-McpServerReady) {
    Write-Host "Ready! Open ChatGPT Desktop and start chatting"
    exit 0
  }

  if ($process) {
    $process.Refresh()
    if ($process.HasExited) {
      throw "npm run dev exited before the server became ready. Check $stdoutLog and $stderrLog for details."
    }
  }

  Start-Sleep -Seconds 1
}

throw "Timed out waiting for the MCP server on $healthUrl. Check $stdoutLog and $stderrLog for details."
