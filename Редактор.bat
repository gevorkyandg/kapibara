@echo off
rem ASCII only: see the note in the game launcher next to this file.
cd /d "%~dp0"
title Kapibara - level editor
echo Starting the editor. The browser will open by itself.
echo Keep this window open while you work. Ctrl+C stops the server.
echo.
call npm run dev -- --open /editor.html
echo.
echo Server stopped.
pause
