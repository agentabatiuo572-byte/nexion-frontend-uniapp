param(
  [int]$Port = 5173,
  [string]$BackendBaseUrl = "http://127.0.0.1:8110"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$previousMode = $env:VITE_NEXGRID_API_MODE
$previousBaseUrl = $env:VITE_NEXGRID_API_DEV_BASE_URL
try {
  $env:VITE_NEXGRID_API_MODE = "remote"
  $env:VITE_NEXGRID_API_DEV_BASE_URL = $BackendBaseUrl
  $process = Start-Process `
    -FilePath "D:\software\nodejs\npm.cmd" `
    -ArgumentList "run", "dev:h5", "--", "--host", "0.0.0.0", "--port", $Port, "--strictPort" `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir "h5-dev.out.log") `
    -RedirectStandardError (Join-Path $logDir "h5-dev.err.log") `
    -PassThru
  [pscustomobject]@{
    Service = "nexion-uniapp-h5"
    Port = $Port
    ProcessId = $process.Id
    ApiMode = "remote"
    BackendBaseUrl = $BackendBaseUrl
  }
} finally {
  $env:VITE_NEXGRID_API_MODE = $previousMode
  $env:VITE_NEXGRID_API_DEV_BASE_URL = $previousBaseUrl
}
