@echo off
title S10 BizSmartHub — Fix Docker Rebuild
color 0A
echo.
echo  ================================================
echo   S10 BizSmartHub - Fix y Rebuild Docker
echo  ================================================
echo.

set "SCRIPT=%~dp0fix_docker_rebuild.sh"
set "GITBASH=C:\Program Files\Git\bin\bash.exe"

if not exist "%GITBASH%" (
  set "GITBASH=C:\Program Files (x86)\Git\bin\bash.exe"
)

if not exist "%GITBASH%" (
  echo ERROR: Git Bash no encontrado.
  pause
  exit /b 1
)

echo Lanzando fix con Git Bash...
echo.
"%GITBASH%" --login -i "%SCRIPT%"
