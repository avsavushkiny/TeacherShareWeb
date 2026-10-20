@echo off
setlocal
cd /d "%~dp0"

 title TeacherShare Web Server
 echo ==========================================
 echo       TeacherShare Web - Server Launcher
 echo ==========================================
 echo.

where node >nul 2>nul
if errorlevel 1 goto no_node

if not exist "node_modules\express" goto install_deps
goto start_server

:install_deps
echo Installing required components. Please wait...
call npm install
if errorlevel 1 goto install_error

goto start_server

:no_node
echo ERROR: Node.js is not installed or is not in PATH.
echo Install the LTS version from https://nodejs.org/ then run this file again.
echo.
pause
exit /b 1

:install_error
echo.
echo ERROR: Dependency installation failed.
echo Check your Internet connection and try running this file again.
echo.
pause
exit /b 1

:start_server
echo.
echo Server will be available on this laptop at:
echo http://localhost:8085/sender.html
echo.
echo On the projector PC, open this address using the laptop IP:
echo http://LAPTOP-IP:8085/receiver.html
echo.
echo Keep this window open while using TeacherShare. Press Ctrl+C to stop.
echo ==========================================
echo.
call npm start

echo.
echo Server stopped.
pause
