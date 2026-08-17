cmake_minimum_required(VERSION 3.24)
project(AGRAdaptiveTextureOptimizer VERSION 58.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 6.6 REQUIRED COMPONENTS Widgets WebEngineWidgets WebChannel Concurrent)

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

qt_add_resources(AdaptiveTextureOptimizer web_interface
    PREFIX "/web"
    BASE "web/dist"
    FILES
        web/dist/index.html
        web/dist/assets/app.js
        web/dist/assets/app.css)

qt_add_resources(AdaptiveTextureOptimizer app_icons
    PREFIX "/icons"
    BASE "assets"
    FILES
        assets/liquid.svg
        assets/lucide/house.svg
        assets/lucide/scan-line.svg
        assets/lucide/images.svg
        assets/lucide/columns-2.svg
        assets/lucide/activity.svg
        assets/lucide/log-out.svg)

target_include_directories(AdaptiveTextureOptimizer PRIVATE src)
target_compile_definitions(AdaptiveTextureOptimizer PRIVATE
    AGR_APP_VERSION="${PROJECT_VERSION_MAJOR}")
target_link_libraries(AdaptiveTextureOptimizer PRIVATE
    Qt6::Widgets Qt6::WebEngineWidgets Qt6::WebChannel Qt6::Concurrent libdeflate_static)

if(WIN32)
    enable_language(RC)
    configure_file(resources/windows/app.rc.in
        ${CMAKE_CURRENT_BINARY_DIR}/app_icon.rc @ONLY)
    target_sources(AdaptiveTextureOptimizer PRIVATE
        ${CMAKE_CURRENT_BINARY_DIR}/app_icon.rc)
    target_link_libraries(AdaptiveTextureOptimizer PRIVATE Psapi)
    set_target_properties(AdaptiveTextureOptimizer PROPERTIES WIN32_EXECUTABLE TRUE)
endif()

install(TARGETS AdaptiveTextureOptimizer
    BUNDLE DESTINATION . RUNTIME DESTINATION bin)
