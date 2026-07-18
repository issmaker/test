@echo off
setlocal
cd /d "%~dp0"

if "%QT_ROOT%"=="" (
  echo Set QT_ROOT to your MSVC Qt folder first.
  echo Example: set QT_ROOT=C:\Qt\6.8.3\msvc2022_64
  pause
  exit /b 1
)
where cmake >nul 2>nul || (echo CMake was not found & pause & exit /b 1)
where ninja >nul 2>nul || (echo Ninja was not found & pause & exit /b 1)

cmake -S . -B build -G Ninja ^
  -DCMAKE_BUILD_TYPE=Release ^
  -DCMAKE_PREFIX_PATH="%QT_ROOT%"
if errorlevel 1 goto :failed

cmake --build build --config Release
if errorlevel 1 goto :failed

"%QT_ROOT%\bin\windeployqt.exe" ^
  --release --qmldir "%cd%\qml" ^
  "%cd%\build\AdaptiveTextureOptimizer.exe"
if errorlevel 1 goto :failed

echo.
echo Ready: %cd%\build\AdaptiveTextureOptimizer.exe
pause
exit /b 0

:failed
echo Build failed. Read the error above.
pause
exit /b 1
