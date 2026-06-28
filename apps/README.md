# MacOS

현재 설치된 목록
brew bundle dump --file=apps/macos/Brewfile --force

### 1. Homebrew 설치 후

```bash
cd ~/Documents/GitHub/\_dev-env
```

### 2. Brewfile 기반 설치

```bash
brew bundle --file apps/macos/Brewfile
brew bundle --file apps/macos/Brewfile.ai
```

### 3. Brewfile 기반 삭제

```bash
chmod +x ./scripts/prune-macos-brewfile.sh

./scripts/prune-macos-brewfile.sh apps/macos/Brewfile.ai

#앱 설정 데이터까지 더 강하게 지우기:
#앱 설정, 캐시, Application Support 일부가 같이 삭제될 수 있어서, 로그인 정보나 설정을 보존하고 싶으면 쓰지 않는 게 좋습니다.
./scripts/prune-macos-brewfile.sh apps/macos/Brewfile.ai --zap
```

### 4. Appstore 설치가 필요하면

```bash
mas install 497799835
```

### 5. Xcode 라이선스 동의

```bash
sudo xcodebuild -license accept
```

# Windows

관리자 PowerShell에서 WinGet 앱, WSL 2 + Ubuntu, WSL CLI 도구를 한 번에 설치합니다.
기본 프로필에는 PowerToys와 Windows Terminal이 포함됩니다.

```powershell
# 기본 앱 + WSL
.\apps\windows\install.ps1

# 기본 앱에 개발 프로필 추가
.\apps\windows\install.ps1 -Profile develop

# 모든 프로필 설치
.\apps\windows\install.ps1 -Profile all

# 여러 프로필 선택
.\apps\windows\install.ps1 -Profile ai,develop
```

프로필 구성:

- `base`: CLI 도구, Chrome, PowerToys, Windows Terminal, 생산성/네트워크 앱
- `ai`: Anaconda, opencode, Codex, Kiro, Claude, Cursor
- `develop`: VS Code, GitHub Desktop, Neovim, FFmpeg, Terraform, Bun, Docker, Postman
- `design`: Blender, Figma, Adobe Creative Cloud

WSL 설치 후 재부팅이 필요하면 Windows를 재시작한 뒤 패키지 설치를 건너뛰고 이어서 실행합니다.

```powershell
.\apps\windows\install.ps1 -SkipPackages
```

선택 옵션:

```powershell
# WinGet 앱만 설치
.\apps\windows\install.ps1 -Profile all -SkipWsl

# WSL은 설치하지만 WSL 내부 apt 패키지는 생략
.\apps\windows\install.ps1 -SkipWslTools

# Ubuntu 대신 다른 배포판 사용
.\apps\windows\install.ps1 -Distribution Debian
```

현재 Windows 앱 목록을 다시 내보낼 때:

```powershell
winget export --output apps/windows/winget.exported.json
```

## Manual

패키지 매니저로 설치하기 어렵거나, 계정 로그인/라이선스가 필요한 앱.

[Vulkan SDK](https://vulkan.lunarg.com/sdk/home)

- 설치 후 `VULKAN_SDK` 환경 변수 확인
- `glslc --version` 확인
- macOS에서는 MoltenVK 포함 여부 확인

[Slang](https://shader-slang.org/)
shader 언어

[RenderDoc](https://renderdoc.org)

GPU 프레임 디버깅.

- 설치 후 graphics project README의 capture workflow 확인
- capture 파일은 repo에 커밋하지 않기

[Nsight Graphics](https://developer.nvidia.com/nsight-graphics)
GPU 파이프라인 분석.

[Nsight System](https://developer.nvidia.com/nsight-systems)
CPU/GPU 동시 프로파일링.

[USD Viewer](https://openusd.org/release/index.html)
USD 씬 검사.

[OpenEXR](https://openexr.com/en/latest)
AOV 디버깅.

[OpenImageIO](https://openimageio.readthedocs.io/en/v3.1.14.0)
EXR 분석.

```bash
oiiotool
```

[tev](https://github.com/Tom94/tev)
EDR viewer
렌더링 연구 쪽에서 많이 씀.
EXR 비교.

## Fonts

- JetBrains Mono Nerd Font
- D2Coding
