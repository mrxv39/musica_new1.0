# C:\Users\Usuario\Desktop\proyectos\poker_boss\scripts\gate-coverage-strategy.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== Running coverage (Vitest) ==="

$gateDir = Join-Path $PSScriptRoot "..\.gate"
$gateDir = (Resolve-Path $gateDir).Path
New-Item -ItemType Directory -Force $gateDir | Out-Null

$reportPath = Join-Path $gateDir "vitest-coverage.txt"

$cmd = "npm run test:coverage"
Write-Host ""
Write-Host "> $cmd"
Write-Host ""

cmd /c "$cmd 1> `"$reportPath`" 2>&1"
if ($LASTEXITCODE -ne 0) {
  throw "FAIL: coverage run failed (exit code $LASTEXITCODE). Revisa $reportPath"
}

$lines = Get-Content -LiteralPath $reportPath -ErrorAction Stop

# Parse de tabla: "File | % Stmts | % Branch | % Funcs | % Lines |"
$rows = @{}
foreach ($ln in $lines) {
  if ($ln -match '^\s*(?<file>[^|]+?)\s*\|\s*(?<stmts>[\d.]+)\s*\|\s*(?<branch>[\d.]+)\s*\|\s*(?<funcs>[\d.]+)\s*\|\s*(?<lines>[\d.]+)\s*\|') {
    $f = $matches["file"].Trim()
    $pctLines = [double]$matches["lines"]
    $rows[$f] = $pctLines
  }
}

function Find-RowKeyBySuffix([string]$suffix) {
  $s = $suffix.Trim()
  foreach ($k in $rows.Keys) {
    if ($k -eq $s) { return $k }
    if ($k -like "*$s") { return $k }   # soporta "...pages/strategy"
  }
  return $null
}

function Require-Group([string]$label, [string[]]$candidates, [double]$minPct) {
  $key = $null
  foreach ($c in $candidates) {
    $k = Find-RowKeyBySuffix $c
    if ($null -ne $k) { $key = $k; break }
  }

  if ($null -eq $key) {
    $avail = ($rows.Keys | Sort-Object) -join ", "
    throw "No se encontró el grupo '$label' en el reporte de coverage. Candidatos: $($candidates -join ' OR '). Disponibles: $avail. Revisa $reportPath"
  }

  $v = $rows[$key]
  if ($v -lt $minPct) {
    throw "FAIL: $label lines: $v (min $minPct). Key='$key'. Revisa $reportPath"
  }

  Write-Host ("OK: {0} lines: {1} (min {2}) [{3}]" -f $label, $v, $minPct, $key)
}

Write-Host ""
Write-Host "=== Strategy coverage check ==="

Require-Group "pages/strategy" @("pages/strategy", "src/pages/strategy") 63
Require-Group "strategy"       @("strategy", "src/strategy")             55

Write-Host "OK: Strategy coverage thresholds met."
