@echo off
:Start
node index.js
:: Wait 30 seconds before restarting.
TIMEOUT /T 2
GOTO:Start