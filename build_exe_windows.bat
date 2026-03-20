@echo off
setlocal
python -m pip install --upgrade pip
python -m pip install pyinstaller reportlab
pyinstaller --noconfirm --onefile --windowed --name KP_Generator desktop_kp_generator.py
echo.
echo EXE собран: dist\KP_Generator.exe
pause
