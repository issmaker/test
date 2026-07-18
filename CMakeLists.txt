cmake_minimum_required(VERSION 3.24)
project(AGRAdaptiveTextureOptimizer VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.6 REQUIRED COMPONENTS Quick QuickControls2 Concurrent)

include(FetchContent)
set(LIBDEFLATE_BUILD_GZIP OFF CACHE BOOL "" FORCE)
set(LIBDEFLATE_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LIBDEFLATE_BUILD_SHARED_LIB OFF CACHE BOOL "" FORCE)
FetchContent_Declare(libdeflate
    GIT_REPOSITORY https://github.com/ebiggers/libdeflate.git
    GIT_TAG v1.24
    GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(libdeflate)

qt_standard_project_setup(REQUIRES 6.6)
qt_add_executable(AdaptiveTextureOptimizer
    src/main.cpp
    src/OptimizerEngine.cpp
    src/PngEncoder.cpp
    src/TextureProcessor.cpp)

qt_add_qml_module(AdaptiveTextureOptimizer
    URI AGR.TextureOptimizer
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/AppButton.qml
        qml/GlassCard.qml
        qml/MetricChip.qml
        qml/LimitSelector.qml
        qml/ZoomView.qml
        qml/Sparkline.qml
        qml/SpaceBackground.qml)

target_include_directories(AdaptiveTextureOptimizer PRIVATE src)
target_link_libraries(AdaptiveTextureOptimizer PRIVATE
    Qt6::Quick Qt6::QuickControls2 Qt6::Concurrent libdeflate_static)

if(WIN32)
    set_target_properties(AdaptiveTextureOptimizer PROPERTIES WIN32_EXECUTABLE TRUE)
endif()

install(TARGETS AdaptiveTextureOptimizer
    BUNDLE DESTINATION . RUNTIME DESTINATION bin)
