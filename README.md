# VS Code Profile Development Environment

이 저장소는 새 컴퓨터에서도 VS Code 프로필별 개발 환경을 빠르게 복구하기 위한 개인 개발 환경 템플릿입니다.

핵심 원칙은 간단합니다.

- 개인 취향 설정은 이 repo의 `vscode/<profile>/settings.json`에 둡니다.
- 프로젝트 실행에 꼭 필요한 설정만 각 프로젝트 repo의 `.vscode/settings.json`에 둡니다.
- 비밀 정보, 토큰, API key, SSH private key, 실제 `.env` 값은 저장하지 않습니다.
- 자동화 스크립트는 설치와 안내 위주로만 동작하며 destructive command를 실행하지 않습니다.

## Repository Layout

```text
dev-env/
├─ README.md
├─ git/
│  └─ gitconfig.example
├─ languages/
│  ├─ cpp.md
│  ├─ docker.md
│  ├─ java.md
│  ├─ node.md
│  ├─ python.md
│  └─ rust.md
├─ scripts/
│  ├─ install-macos.sh
│  ├─ install-ubuntu.sh
│  └─ install-windows.ps1
├─ shell/
└─ vscode/
   ├─ common/
   ├─ frontend/
   ├─ rust/
   ├─ cpp/
   ├─ backend/
   ├─ ai-python/
   ├─ fullstack/
   ├─ graphics/
   └─ java/
```

## Profile Folder Strategy

GitHub 폴더 아래에 프로필별 상위 폴더를 두고, 각 프로젝트를 해당 VS Code 프로필로 엽니다.

```text
GitHub/
├─ Frontend/
├─ Rust/
├─ C++/
├─ Backend/
├─ AI-Python/
├─ Fullstack/
└─ Graphics/
```

예시는 다음과 같습니다.

```bash
code --profile "Frontend" "$HOME/Documents/GitHub/Frontend/my-next-app"
code --profile "Rust" "$HOME/Documents/GitHub/Rust/my-cli"
code --profile "AI(Python)" "$HOME/Documents/GitHub/AI-Python/rag-lab"
```

Windows PowerShell에서는 다음처럼 사용합니다.

```powershell
code --profile "Backend" "$HOME\Documents\GitHub\Backend\api-server"
```

## Restore On A New Computer

1. Git, GitHub CLI, VS Code를 설치합니다.
2. VS Code에서 `code` CLI를 활성화합니다.
3. 이 repo를 clone합니다.
4. 필요하면 VS Code Settings Sync를 켜고, 프로필을 생성하거나 import합니다.
5. `scripts/install-*` 스크립트로 프로필별 확장을 설치합니다.
6. Git user, shell alias, runtime 도구를 확인합니다.
7. `GitHub/<Profile>/...` 아래에 프로젝트를 clone합니다.
8. 프로젝트를 `code --profile "<ProfileName>" "<Path>"`로 엽니다.

macOS 예시:

```bash
brew install git gh visual-studio-code
gh auth login
git clone https://github.com/<owner>/dev-env.git
cd dev-env
bash scripts/install-macos.sh --profile frontend
```

Ubuntu 예시:

```bash
sudo apt update
sudo apt install git curl
gh auth login
git clone https://github.com/<owner>/dev-env.git
cd dev-env
bash scripts/install-ubuntu.sh --profile rust
```

Windows 예시:

```powershell
winget install Git.Git
winget install GitHub.cli
winget install Microsoft.VisualStudioCode
gh auth login
git clone https://github.com/<owner>/dev-env.git
cd dev-env
.\scripts\install-windows.ps1 -Profile fullstack
```

## Extension Files

각 프로필의 `extensions.json`은 다음 구조를 사용합니다.

```json
{
  "recommendations": ["publisher.extension-id"],
  "reviewNeeded": ["publisher.extension-id"]
}
```

- `recommendations`: 설치 스크립트가 자동 설치 대상으로 사용하는 확장입니다.
- `reviewNeeded`: 유용할 수 있지만 직접 확인 후 설치할 후보입니다.

수동 설치 예시:

```bash
code --install-extension rust-lang.rust-analyzer
code --list-extensions
```

## Settings, Tasks, Keybindings, Snippets

프로필 설정은 다음 파일을 기준으로 관리합니다.

- `vscode/<profile>/settings.json`: 개인 취향, formatter, lint, theme, MCP autostart 정책.
- `vscode/<profile>/tasks.json`: 반복 실행 명령. 위험한 명령은 자동 실행하지 않습니다.
- `vscode/<profile>/keybindings.json`: 최소 공통 단축키.
- `vscode/<profile>/snippets/*.json`: 언어/프로필별 코드 조각.
- `vscode/<profile>/mcp.json`: MCP 서버 후보와 기본 비활성화 정책.

VS Code 프로필에는 위 파일 내용을 필요에 따라 복사하거나 import합니다. 프로젝트별 `.vscode/settings.json`에는 runtime path, test env, workspace-specific tool path처럼 프로젝트 실행에 필요한 값만 둡니다.

## Profile Summary

- `common`: 한국어 언어팩, GitLens, GitHub Actions, Remote, CSV, Markdown/Shell/Docker snippets.
- `frontend`: React, Next.js, TypeScript, Tailwind CSS, ESLint, Prettier, Figma, Live Server.
- `rust`: rust-analyzer, LLDB, TOML, Cargo, Clippy, rustfmt.
- `cpp`: clangd, CMake, Makefile, LLDB, `compile_commands.json`.
- `backend`: Docker, Dev Containers, DB Client, Redis, Supabase, Terraform, Remote.
- `ai-python`: Python, Jupyter, Ruff, Pylance, pytest, uv/poetry, data viewer, AI/MCP.
- `fullstack`: Frontend + Backend + AI Python 통합.
- `graphics`: C++/Rust graphics, Vulkan/shader/GLSL/Slang/GLB/image viewer.
- `java`: Java Extension Pack, Gradle, Maven, Test/Debug.

## RenderDoc Note

RenderDoc은 VS Code 확장이 아니라 외부 그래픽 디버깅 도구입니다. `graphics` 프로필에서는 관련 shader/C++/Rust 편집 확장만 설치하고, RenderDoc은 OS별 패키지 매니저나 공식 설치 프로그램으로 별도 설치합니다.

## Safety Notes

- `.env` 실제 값은 commit하지 말고 `.env.example`만 관리합니다.
- SSH private key, access token, cloud credential, DB password는 저장하지 않습니다.
- 개인 PC 절대 경로는 문서 예시 외에는 넣지 않습니다.
- `git add`, `git commit`, `docker compose down`, `rm -rf`는 자동 승인 목록이나 자동 실행 스크립트에 넣지 않습니다.
- MCP는 기본 autostart를 끄고 필요한 서버만 명시적으로 켭니다.

## Checklist

- [ ] Git 설치
- [ ] GitHub CLI 설치
- [ ] GitHub 로그인
- [ ] SSH key 또는 credential helper 확인
- [ ] VS Code 설치
- [ ] `code` CLI 활성화
- [ ] VS Code Settings Sync 확인
- [ ] VS Code 프로필 생성 또는 import
- [ ] 프로필별 확장 설치
- [ ] shell alias 설정
- [ ] Git user.name/user.email 설정
- [ ] Node/Python/Rust/C++/Java runtime 확인
- [ ] Docker 실행 확인
- [ ] 프로젝트 clone
- [ ] 프로필별 task 실행 확인

## TODO For Human Review

- [ ] 실제로 사용할 VS Code color/icon/product icon theme 확정
- [ ] `reviewNeeded` 확장 설치 여부 결정
- [ ] 각 프로젝트별 `.env.example` 작성
- [ ] 각 프로젝트별 `.vscode/settings.json`가 개인 취향을 포함하지 않는지 확인
- [ ] RenderDoc, Vulkan SDK, GPU driver 설치 확인
- [ ] AI/MCP 서버 중 실제 사용할 서버만 활성화
