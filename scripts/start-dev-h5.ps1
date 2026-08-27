param(
  [int]$Port = 5173,
  [string]$BackendBaseUrl = "http://127.0.0.1:8110",
  [string]$AcceptanceRunId = $env:NEXION_ACCEPTANCE_RUN_ID
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$acceptanceRunIdValue = if ([string]::IsNullOrWhiteSpace($AcceptanceRunId)) {
  "nexion-local-dev"
} else {
  $AcceptanceRunId.Trim()
}
if ($acceptanceRunIdValue -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{7,95}$') {
  throw "AcceptanceRunId must contain 8-96 safe characters"
}

$previousTarget = $env:VITE_NEXGRID_API_PREVIEW_TARGET
$previousAcceptanceRunId = $env:VITE_NEXGRID_ACCEPTANCE_RUN_ID
try {
  $env:VITE_NEXGRID_API_PREVIEW_TARGET = $BackendBaseUrl
  $env:VITE_NEXGRID_ACCEPTANCE_RUN_ID = $acceptanceRunIdValue
  $process = Start-Process `
    -FilePath "D:\software\nodejs\npm.cmd" `
    -ArgumentList "run", "dev:h5", "--", "--mode", "development", "--host", "0.0.0.0", "--port", $Port, "--strictPort" `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "h5-dev.out.log") `
    -RedirectStandardError (Join-Path $logDir "h5-dev.err.log") `
    -PassThru
  [pscustomobject]@{
    Service = "nexion-uniapp-h5"
    Environment = "dev"
    Port = $Port
    ProcessId = $process.Id
    BackendBaseUrl = $BackendBaseUrl
    AcceptanceRunId = $acceptanceRunIdValue
  }
} finally {
  $env:VITE_NEXGRID_API_PREVIEW_TARGET = $previousTarget
  $env:VITE_NEXGRID_ACCEPTANCE_RUN_ID = $previousAcceptanceRunId
}
