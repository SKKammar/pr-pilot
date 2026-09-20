@echo off
echo ===================================================
echo             PR PILOT - LOCAL STARTUP
echo ===================================================
echo Starting FastAPI backend on http://127.0.0.1:8000 ...
start "PR Pilot Backend (FastAPI)" cmd /k "cd backend && venv\Scripts\activate && uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo Starting Next.js frontend on http://localhost:3000 ...
start "PR Pilot Frontend (Next.js)" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers started!
echo Frontend: http://localhost:3000
echo Backend:  http://127.0.0.1:8000
echo ===================================================
pause
