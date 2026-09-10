@echo off
cd /d "%~dp0"
echo Starting POS System Server...
echo.
echo Server running on http://localhost:3000
echo.
echo Demo Credentials:
echo   Username: admin
echo   Password: password123
echo.
echo Press Ctrl+C to stop the server
echo.
npm run dev
pause
