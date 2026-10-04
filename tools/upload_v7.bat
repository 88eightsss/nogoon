@echo off
start /min powershell -NonInteractive -File "C:\Users\jtshi\nogoon\open_file.ps1"
timeout 2 /nobreak > nul
powershell -NonInteractive -File "C:\Users\jtshi\nogoon\sendclick.ps1"
