@echo off
REM Arranca el puente de impresion termica de Bodega 12 (RPP02N por COM4).
REM Deja esta ventana abierta mientras uses la caja. Doble clic para iniciar.
title Impresora termica Bodega 12 (RPP02N)
echo Iniciando puente de impresion termica...
echo Puerto impresora: COM4   Puerto local: 9110
echo Deja esta ventana ABIERTA. Cierrala para apagar la impresion automatica.
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0print-bridge.ps1" -Com COM4 -Port 9110
echo.
echo El puente se detuvo. Presiona una tecla para cerrar.
pause >nul
