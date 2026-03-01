@echo off
set ROOT=%~dp0

start cmd /k "cd /d "%ROOT%backend" && npm run dev"
start cmd /k "cd /d "%ROOT%frontend" && npm start"

exit
