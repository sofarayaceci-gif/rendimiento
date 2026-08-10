@echo off
rem  Rendimientos - abre la app en http://localhost:8126/
rem  Doble clic aqui. La ventana negra aparece un segundo y se va; el servidor
rem  sigue atras, sin ventana, y se apaga solo a la media hora sin uso.
rem  Que hace falta esto y como se instala la app: ver README.md
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0servidor-local.ps1"
