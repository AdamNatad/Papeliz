@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Papeliz Help Build
pushd "%~dp0..\..\..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo  [error] Node.js was not found. Install Node.js 24 LTS from https://nodejs.org, then run this again.
  set "PAPELIZ_LAUNCHER_EXIT_CODE=1"
  goto papeliz_launcher_end
)

node "build_tools\shared\launcher\papeliz-launcher.mjs" help build windows %*
set "PAPELIZ_LAUNCHER_EXIT_CODE=%ERRORLEVEL%"

:papeliz_launcher_end
popd
rem Keep the window open on failure when the launcher was double-clicked.
if not "%PAPELIZ_LAUNCHER_EXIT_CODE%"=="0" (
  echo %CMDCMDLINE% | findstr /i /c:"%~nx0" >nul && pause
)
exit /b %PAPELIZ_LAUNCHER_EXIT_CODE%
