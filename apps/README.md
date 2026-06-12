cd apps/macos
brew bundle

현재 설치된 목록
brew bundle dump --file=apps/macos/Brewfile --force

# 1. Homebrew 설치 후

cd ~/Documents/GitHub/\_dev-env

# 2. Brewfile 기반 설치

brew bundle --file apps/macos/Brewfile

# 3. Xcode 설치가 필요하면

mas install 497799835

# 4. Xcode 라이선스 동의

sudo xcodebuild -license accept

winget은 설치된 앱 목록을 JSON으로 export하고, 그 JSON을 import해서 batch install할 수 있습니다.

winget export
winget export -o apps/windows/winget.json
winget import
winget import -i apps/windows/winget.json --accept-package-agreements --accept-source-agreements

# App Categories

## Essential

새 환경에서 반드시 필요한 기본 도구.

- Git
- GitHub CLI
- VS Code
- Browser
- Terminal
- Package manager

## CLI

터미널 작업용.

- ripgrep
- fd
- jq
- fzf
- bat
- eza
- zoxide
- starship
- tmux

## Frontend

- Node.js
- pnpm
- Chrome
- Figma

## Backend

- Docker
- PostgreSQL client
- Redis client
- Terraform

## Rust

- rustup
- lldb

## C++

- CMake
- Ninja
- LLVM
- clangd

## Graphics

- Vulkan SDK
- RenderDoc
- shaderc
- glslang
- glslc

## AI / Python

- Python
- uv
- Jupyter
- Ollama, if used

## Optional

설치하면 좋지만 필수는 아닌 앱.

## Manual

패키지 매니저로 설치하기 어렵거나, 계정 로그인/라이선스가 필요한 앱.

### Vulkan SDK

- 설치 후 `VULKAN_SDK` 환경 변수 확인
- `glslc --version` 확인
- macOS에서는 MoltenVK 포함 여부 확인

### RenderDoc

- 설치 후 graphics project README의 capture workflow 확인
- capture 파일은 repo에 커밋하지 않기

### Docker Desktop

- 로그인 필요
- resource limit 설정 확인

### Figma

- 로그인 필요

## Fonts

- JetBrains Mono Nerd Font
- D2Coding
