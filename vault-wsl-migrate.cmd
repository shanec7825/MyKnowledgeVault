@echo off
setlocal
title claude-obsidian vault migration (Windows -^> WSL)
echo ============================================================
echo   claude-obsidian vault migration: Windows -^> WSL
echo ============================================================
echo.
echo   Vault writes require WSL (per the claude-obsidian README),
echo   so the whole migration runs INSIDE WSL.
echo.
echo   Source : C:\Users\Lenovo\Documents\MyKnowledgeVault
echo   Target : \\wsl.localhost\Ubuntu\home\lenovo\Documents\MyKnowledgeVault
echo   Log    : \\wsl.localhost\Ubuntu\home\lenovo\migration\migrate-vault.log
echo.
echo   Prefer a preview first? Run:
echo     wsl.exe -d Ubuntu bash -c "sed -i 's/\r$//' /home/lenovo/migration/migrate-vault.sh; bash /home/lenovo/migration/migrate-vault.sh --preview"
echo.
wsl.exe -d Ubuntu bash -c "sed -i 's/\r$//' /home/lenovo/migration/migrate-vault.sh; bash /home/lenovo/migration/migrate-vault.sh"
echo.
echo   Exit code: %ERRORLEVEL%
echo   Details:  \\wsl.localhost\Ubuntu\home\lenovo\migration\migrate-vault.log
echo.
pause
