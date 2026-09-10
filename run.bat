@echo off
echo Starting POS System...
echo.
echo Checking if database is configured...
echo Make sure PostgreSQL is running and pos_db is created.
echo.
echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
node dist/index.js
