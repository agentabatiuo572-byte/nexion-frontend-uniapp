$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $PSScriptRoot
Set-Location $scriptRoot

# This is an opt-in local acceptance launcher. It does not modify production
# configuration and it starts only when an operator invokes this script.
$env:VITE_NEXGRID_API_MODE = 'sandbox'
$env:VITE_NEXGRID_API_PREVIEW_TARGET = 'http://127.0.0.1:8110'
& npm.cmd run dev:h5 -- --mode acceptance-h5
