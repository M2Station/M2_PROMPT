@echo off
REM ============================================================
REM  M2_PROMPT - remove the Explorer right-click menu
REM
REM  Deletes the per-user "open project in M2_PROMPT" folder right-click entry.
REM ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0context-menu.ps1" -Uninstall
echo.
pause
