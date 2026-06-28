# dev-env control plane

개인 개발 환경을 macOS, Windows/WSL, Ubuntu에서 선언적으로 설치하고 진단하는 도구입니다.

```text
YAML configuration → plan → approval → apply → doctor → dashboard
```

패키지, mise 런타임, Shell 설정, 심볼릭 링크, VS Code 프로필을 동일한 CLI와 로컬 웹 대시보드에서 관리합니다. 실제 비밀값과 credential은 이 저장소에 넣지 않습니다.

## First setup

새 컴퓨터에서는 OS별 부트스트랩을 사용합니다. 부트스트랩은 Node.js 24와 pnpm을 준비하고 control plane을 빌드한 뒤 setup 계획을 생성합니다.

macOS 또는 Ubuntu/WSL:

```bash
./bootstrap.sh
```

Windows PowerShell:

```powershell
.\bootstrap.ps1
```

Windows에서는 두 층을 함께 사용합니다. PowerShell의 `bootstrap.ps1`이 WinGet으로 PowerToys·Windows Terminal 같은 네이티브 앱을 관리하고, WSL Ubuntu 안에서는 같은 저장소의 `./bootstrap.sh`를 실행해 APT·mise·Shell 환경을 `wsl-ubuntu` 기기로 관리합니다.

setup은 기본적으로 미리보기만 수행합니다. 출력된 plan을 검토한 뒤 적용합니다.

```bash
dev-env apply-plan <plan-id>
```

특정 부분만 설정할 수도 있습니다.

```bash
dev-env setup --only packages,runtimes
dev-env setup --profile base develop
dev-env links apply
dev-env links restore comfyui-models-external
```

## Daily commands

```bash
# 환경 진단
dev-env doctor

# 변경 전 계획 생성
dev-env update
dev-env cleanup

# 저장된 plan 적용
dev-env apply-plan <plan-id>

# 저장소 전체 검사와 포맷
dev-env check
dev-env format

# 로컬 웹 대시보드
dev-env dashboard

# 현재 OS의 네이티브 패키지 manifest 생성 위치 확인
dev-env config generate
```

비대화형 변경은 실수 방지를 위해 두 플래그를 모두 요구합니다.

```bash
dev-env update --apply --yes
```

## Configuration

커밋되는 단일 진실 원천은 `config/`입니다.

- `machines.yaml`: 기기 선택, 프로필, 개인 경로
- `packages.yaml`: 논리 패키지와 Brew/WinGet/APT 공급자
- `runtimes.yaml`: mise 런타임 버전
- `links.yaml`: 파일·디렉터리 링크와 Windows Junction
- `checks.yaml`: 포맷, 타입, 테스트, Shell 검사

네이티브 Brewfile, WinGet JSON, APT 패키지 목록은 중복해서 커밋하지 않습니다. `dev-env setup` 또는 `dev-env config generate`가 현재 기기 선언에서 OS 상태 디렉터리의 `generated/` 아래에 만듭니다.

경로는 `~`, `${HOME}`, `${repoRoot}`, `${paths.externalAi}` 형태만 허용합니다. 환경변수나 machine path가 없으면 doctor가 경고하며 링크를 만들지 않습니다.

ComfyUI 외장 저장소 링크는 예제로 포함되어 있지만 기본 비활성화 상태입니다. 외장 볼륨 경로를 확인한 뒤 대시보드의 Links 화면에서 활성화합니다.

## Safety

- setup, update, cleanup, link 변경은 항상 plan을 먼저 생성합니다.
- 기존 링크 위치는 OS 데이터 디렉터리에 타임스탬프 백업 후 변경합니다.
- cleanup은 dev-env가 설치 기록을 가진 패키지만 제거 후보로 취급합니다.
- 대시보드는 `127.0.0.1`에만 열리고 임시 세션 토큰을 요구합니다.
- 관리자 작업은 웹 서버에서 실행하지 않고 `dev-env apply-plan` 터미널 승인으로 넘깁니다.
- 저장 전 모든 설정 편집은 Zod 스키마 검증과 revision 충돌 검사, YAML diff를 거칩니다.
- plan은 30분 후 만료되며 적용 시 현재 설정 revision을 다시 확인합니다.
- Git 이름과 이메일은 변경하지 않습니다.

상태와 로그는 저장소가 아니라 플랫폼 데이터 디렉터리에 저장됩니다.

- macOS: `~/Library/Application Support/dev-env`
- Windows: `%LOCALAPPDATA%\dev-env`
- Linux/WSL: `${XDG_STATE_HOME:-~/.local/state}/dev-env`

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e

# API :4545 + Vite :5173
pnpm dev
```

구조:

```text
apps/dashboard/   React + Vite UI
packages/core/    config, planner, adapters, doctor, runner
packages/cli/     dev-env CLI
packages/server/  localhost API and SSE
config/           committed machine declarations
shell/            linked shell and Git configuration
```

기존 VS Code 프로필과 workspace template 생성기는 유지됩니다.

```bash
node scripts/advanced/apply-vscode-profile-files.mjs all --dry-run
node scripts/create-workspace.mjs --name my-app --preset fullstack-web --runtime pnpm
```
