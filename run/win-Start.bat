@echo off
:loop
node ../src/index.js
@echo Restarting server		
goto loop