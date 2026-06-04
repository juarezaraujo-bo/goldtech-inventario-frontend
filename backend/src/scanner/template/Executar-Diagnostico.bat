@echo off
setlocal enabledelayedexpansion
title Goldtech - Diagnostico de Seguranca de Rede

echo ==========================================
echo  GOLDTECH - Diagnostico de Seguranca
echo ==========================================
echo.

:: Verificar Privilegios de Administrador
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Este script precisa ser executado como ADMINISTRADOR.
    echo.
    echo Clique com o botao direito e selecione "Executar como Administrador".
    echo.
    pause
    exit /b 1
)

echo [OK] Privilegios de Administrador verificados.
echo.

cd /d %~dp0

echo Iniciando o Diagnostico de Seguranca Goldtech...
echo.

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0Start-GoldtechScan.ps1"

if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [ERRO] O diagnostico encontrou falhas. Verifique as mensagens acima.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  Diagnostico concluido com sucesso!
echo  Encaminhe os arquivos .json ao analista.
echo ==========================================
echo.
pause
