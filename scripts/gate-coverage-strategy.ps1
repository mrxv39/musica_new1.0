$ErrorActionPreference = "Stop"

# Umbrales (incremental)
# Hoy: desbloqueo mínimo para no frenar (63).
# Siguiente objetivo: subir a 65 y luego 70 cuando cubramos useStrategyPage.ts.
$minPagesStrategyLines = 63.0
$minStrategyLines = 55.0

New-Item -ItemType Directory -Force ".gate" | Out-Null
$logPath = ".gate\vitest-coverage.txt"

if (Test-Path $logPath) {
  Remove-Item -Force $logPath -ErrorAction SilentlyContinue
}

Write-Host "=== Running coverage (Vitest) ==="
& cmd /c "npm run test:coverage 1> `"$logPath`" 2>&1"

Get-Content $logPath -Raw | Write-Host

function Get-LinesPct($groupName) {
  $lines = Get-Content $logPath
  $pattern = "^\s*$([regex]::Escape($groupName))\s+\|\s+[\d\.]+\s+\|\s+[\d\.]+\s+\|\s+[\d\.]+\s+\|\s+([\d\.]+)\s+\|"
  $match = $lines | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if (-not $match) {
    throw "No se encontró el grupo '$groupName' en el reporte de coverage. Revisa $logPath"
  }
  $m = [regex]::Match($match, $pattern)
  return [double]$m.Groups[1].Value
}

$pagesStrategyLines = Get-LinesPct "pages/strategy"
$strategyLines = Get-LinesPct "strategy"

Write-Host "=== Strategy coverage check ==="
Write-Host ("pages/strategy lines: {0} (min {1})" -f $pagesStrategyLines, $minPagesStrategyLines)
Write-Host ("strategy lines:       {0} (min {1})" -f $strategyLines, $minStrategyLines)

if ($pagesStrategyLines -lt $minPagesStrategyLines) {
  throw "FAIL: pages/strategy lines coverage ($pagesStrategyLines) < $minPagesStrategyLines"
}
if ($strategyLines -lt $minStrategyLines) {
  throw "FAIL: strategy lines coverage ($strategyLines) < $minStrategyLines"
}

Write-Host "OK: Strategy coverage thresholds met."
