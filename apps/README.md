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

# Window

winget은 설치된 앱 목록을 JSON으로 export하고, 그 JSON을 import해서 batch install할 수 있습니다.

winget export
winget export -o apps/windows/winget.json
winget import
winget import -i apps/windows/winget.json --accept-package-agreements --accept-source-agreements

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
