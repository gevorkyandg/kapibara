@echo off
rem ASCII only: cmd reads .bat in the OEM codepage, and Cyrillic here breaks
rem the parser - lines fall apart into pieces. Messages come from Vite itself.
cd /d "%~dp0"
title Kapibara - game
echo Starting the game. The browser will open by itself.
echo Keep this window open while you play. Ctrl+C stops the server.
echo.
call npm run dev -- --open /
echo.
echo Server stopped.
pause
