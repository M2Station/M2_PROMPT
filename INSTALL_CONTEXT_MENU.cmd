@echo off
REM ============================================================
REM  M2_PROMPT - register the Explorer right-click menu (dev checkout)
REM
REM  Adds a per-user (HKCU, no admin) "open project in M2_PROMPT" entry to the
REM  folder right-click menu, pointing at this checkout via run-hidden.vbs.
REM  Installed builds register this automatically from the NSIS installer.
REM ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0context-menu.ps1"
echo.
pause
