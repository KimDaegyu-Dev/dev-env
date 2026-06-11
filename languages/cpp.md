# C++

C++ 프로필은 clangd, CMake, Makefile, LLDB, `compile_commands.json` 중심입니다.

## Recommended Tools

- clang / clang++
- clangd
- cmake
- ninja 또는 make
- lldb

## VS Code Profile Settings

`vscode/cpp/settings.json`에는 clangd argument, CMake UI, formatter 같은 개인 선호 설정을 둡니다.

## Project Settings

프로젝트 repo에는 빌드 시스템에 필요한 설정만 둡니다.

- CMake presets
- compiler path
- build directory
- `compile_commands.json` 생성 여부
- test executable path

가능하면 `cmake -S . -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON`을 사용합니다.
