@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Papeliz Image Metadata Remover

where node >nul 2>nul
if errorlevel 1 (
  echo  [error] Node.js was not found. Install Node.js 24 LTS from https://nodejs.org, then run this again.
  set "PAPELIZ_STRIP_IMAGE_METADATA_EXIT_CODE=1"
  goto papeliz_strip_image_metadata_end
)

rem Runs from the current folder, so file and folder paths may be relative to it.
node "%~dp0..\..\shared\image-metadata\papeliz-strip-image-metadata.mjs" %*
set "PAPELIZ_STRIP_IMAGE_METADATA_EXIT_CODE=%ERRORLEVEL%"

:papeliz_strip_image_metadata_end
rem Keep the window open on failure when the script was double-clicked (no arguments shows the help and fails).
if not "%PAPELIZ_STRIP_IMAGE_METADATA_EXIT_CODE%"=="0" (
  echo %CMDCMDLINE% | findstr /i /c:"%~nx0" >nul && pause
)
exit /b %PAPELIZ_STRIP_IMAGE_METADATA_EXIT_CODE%
