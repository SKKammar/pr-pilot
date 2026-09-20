# PR Pilot - Concurrent Local Startup Script
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "             PR PILOT - LOCAL STARTUP              " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$backendPath = Join-Path $PSScriptRoot "backend"
$frontendPath = Join-Path $PSScriptRoot "frontend"

Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendPath'; .\venv\Scripts\activate; uvicorn app.main:app --host 127.0.0.1 --port 8000"

Write-Host "Starting Next.js Frontend on http://localhost:3000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendPath'; npm run dev"

Write-Host "`nBoth processes launched in separate windows!" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
