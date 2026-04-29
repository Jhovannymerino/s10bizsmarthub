@echo off
title S10 BizSmartHub — Deploy al VPS
color 0A
echo.
echo  ================================================
echo   S10 BizSmartHub - Deploy automatico al VPS
echo  ================================================
echo.

set "SCRIPT=%~dp0deploy_vps.sh"
set "GITBASH=C:\Program Files\Git\bin\bash.exe"

if not exist "%GITBASH%" (
  set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
)

if not exist "%GITBASH%" (
  echo ERROR: Git Bash no encontrado.
  echo Instala Git para Windows desde https://git-scm.com
  pause
  exit /b 1
)

echo Lanzando deploy con Git Bash...
echo Script: %SCRIPT%
echo.

"%GITBASH%" --login -i "%SCRIPT%"
