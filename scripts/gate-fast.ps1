$ErrorActionPreference = "Stop"

function Run-Or-Throw([string]$title, [scriptblock]$cmd) {
  Write-Host ""
  Write-Host "=== $title ==="
  & $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "FAIL: $title (exit code $LASTEXITCODE)"
  }
}

Run-Or-Throw "GATE FAST: Frontend tests (Vitest FAST)" { npm run test:fast }
Run-Or-Throw "GATE FAST: Frontend coverage (Strategy gate)" { npm run gate:coverage }
Run-Or-Throw "GATE FAST: Backend tests (pytest FAST)" { python -m pytest -q -m "not slow" --cov=modules --cov-report=term-missing --cov-config=.coveragerc }

Write-Host ""
Write-Host "=== GATE FAST: OK ==="
