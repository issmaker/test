# AGR Adaptive Texture Optimizer — C++ edition

Новая независимая реализация: C++20, Qt 6/QML и libdeflate. Она не использует
Python-код и не уменьшает 2K-текстуру во внутренние 50–60% с растягиванием.

## Сборка Windows

### Автоматически — готовый portable EXE

Проект содержит workflow `.github/workflows/windows-portable.yml`. После
загрузки проекта в GitHub откройте **Actions → Build Windows Portable EXE → Run
workflow**. В результате появится artifact
`AdaptiveTextureOptimizer-1.0-Windows-Portable`. Его нужно скачать, распаковать
и запустить `AdaptiveTextureOptimizer.exe`. Python, Qt и Visual Studio на
компьютере пользователя не нужны: необходимые Qt DLL и MSVC runtime уже лежат
рядом с EXE.

### Локально

Установите Visual Studio 2022 (Desktop development with C++), CMake, Git и Qt
6.6+ с комплектом MSVC. Затем откройте `x64 Native Tools Command Prompt`:

```bat
cmake -S . -B build -G Ninja -DCMAKE_PREFIX_PATH=C:/Qt/6.8.3/msvc2022_64 -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
C:/Qt/6.8.3/msvc2022_64/bin/windeployqt --qmldir qml build/AdaptiveTextureOptimizer.exe
```

Путь и версию Qt замените на установленные у вас. CMake самостоятельно загрузит
закреплённую версию libdeflate. Готовый EXE принимает PNG перетаскиванием на окно
или на сам файл программы.

## Текущий конвейер

1. Декодирование в RGB24; 8K уменьшается напрямую до 2K.
2. Lossless-поиск фильтров None/Sub/Up/Paeth/adaptive MinSum.
3. Упаковка libdeflate уровня 10.
4. Если 3 MB не достигнуты — локальная edge-aware обработка без уменьшения 2K.
5. Сильные границы сохраняются точно; похожие соседние пиксели обрабатываются
   мягко, без переноса цвета через границы UV-островов.
6. Финальный PNG декодируется и сверяется с выбранным RGB-массивом.

Это первая компилируемая архитектурная версия. Следующие профессиональные
этапы: Oklab/DeltaE2000-аудит, SSIMULACRA2-подобная mip-метрика, SIMD Highway,
тайловый параллельный анализ, синхронный zoom/pan и карта ошибок в UI.
