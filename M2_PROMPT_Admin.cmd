@echo off
REM ============================================================
REM  M2 PROMPT - launch AS ADMINISTRATOR
REM  Use this launcher when you need M2 PROMPT to run elevated
REM  (for example, to match an elevated VS Code, or when your
REM  environment requires administrator rights). Windows blocks a
REM  normal-integrity app from talking to an elevated process, so
REM  running M2 PROMPT at the same level avoids that. This script
REM  self-elevates via UAC if needed.
REM
REM  (If you don't need elevation, just use M2_PROMPT.cmd.)
REM ============================================================
setlocal enableextensions

REM The "__elevated" arg is passed by the relaunch below so we never loop.
if "%~1"=="__elevated" goto run

REM net session succeeds only when already elevated.
net session >nul 2>&1
if %errorlevel% equ 0 goto run

echo [INFO] Requesting administrator privileges ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '__elevated' -Verb RunAs"
exit /b 0

:run
REM Elevated from here - hand off to the normal launcher (runs elevated).
call "%~dp0M2_PROMPT.cmd"
exit /b 0
