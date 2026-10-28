@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Papeliz Image to SVG

where node >nul 2>nul
if errorlevel 1 (
  echo  [error] Node.js was not found. Install Node.js 24 LTS from https://nodejs.org, then run this again.
  set "PAPELIZ_IMAGE_TO_SVG_EXIT_CODE=1"
  goto papeliz_image_to_svg_end
)

rem Runs from the current folder, so picture and output paths may be relative to it.
node "%~dp0..\..\shared\image-to-svg\papeliz-image-to-svg.mjs" %*
set "PAPELIZ_IMAGE_TO_SVG_EXIT_CODE=%ERRORLEVEL%"

:papeliz_image_to_svg_end
rem Keep the window open on failure when the script was double-clicked (no arguments shows the help and fails).
if not "%PAPELIZ_IMAGE_TO_SVG_EXIT_CODE%"=="0" (
  echo %CMDCMDLINE% | findstr /i /c:"%~nx0" >nul && pause
)
exit /b %PAPELIZ_IMAGE_TO_SVG_EXIT_CODE%
