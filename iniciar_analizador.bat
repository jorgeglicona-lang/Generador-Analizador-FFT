@echo off
title Analizador de Fourier - Servidor Local
echo ========================================================
echo    Iniciando Servidor Local para el Analizador FFT
echo    (Requerido por los navegadores para el Microfono)
echo ========================================================
echo.

cd /d "%~dp0"

start http://localhost:8080/analizador_espectral_fft.html
python -m http.server 8080

pause
