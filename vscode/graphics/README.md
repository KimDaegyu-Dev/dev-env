# Graphics Profile

Graphics 프로필은 Vulkan, shader, GLSL, Slang, RenderDoc workflow, GLB/image viewer, C++/Rust graphics 개발을 위한 VS Code 프로필입니다.

## VS Code Scope

이 프로필은 다음 편집/빌드 경험을 담당합니다.

- clangd, CMake, Makefile, LLDB
- rust-analyzer, TOML, LLDB
- GLSL/Slang shader syntax
- shader compile task examples
- GLB, PPM/PGM image viewing

## RenderDoc

RenderDoc은 VS Code 확장이 아니라 외부 GPU debugging/capture 도구입니다.

설치 예시:

```bash
# macOS
brew install --cask renderdoc

# Ubuntu, 배포판 패키지 이름은 환경마다 다를 수 있습니다.
sudo apt install renderdoc
```

Windows에서는 공식 설치 프로그램 또는 패키지 매니저를 사용합니다.

```powershell
winget search RenderDoc
```

## Typical Workflow

1. VS Code에서 Graphics 프로필로 프로젝트를 엽니다.
2. `graphics: cmake configure` task로 빌드 디렉터리를 준비합니다.
3. `graphics: compile vertex shader` 또는 `graphics: compile fragment shader` task로 shader compile 예시를 확인합니다.
4. 앱 실행과 GPU capture는 RenderDoc에서 직접 수행합니다.

## Project Notes

프로젝트별 `.vscode/settings.json`에는 SDK path, sample executable path, asset path처럼 프로젝트에 필요한 값만 둡니다. 개인 취향 테마나 formatter 설정은 이 프로필 설정에 둡니다.
