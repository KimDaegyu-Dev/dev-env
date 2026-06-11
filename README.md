# My Development Environment

## 목표

새 컴퓨터에서 빠르게 개발 환경을 복구하기 위한 개인 설정 저장소입니다.

## 기본 환경

- OS:
- Shell:
- Editor: VS Code
- Git hosting: GitHub
- Main languages:
- Package managers:

## 1. 필수 프로그램 설치

### macOS

```bash
brew install git gh node pnpm python docker xcodegen cocoapods wakeonlan neovim
```

### Windows

```bash
winget install Git.Git
winget install GitHub.cli
winget install Microsoft.VisualStudioCode
```

### Ubuntu

```bash
sudo apt update
sudo apt install git curl build-essential
```

## 2. GitHub 로그인

```bash
gh auth login
gh auth status
```

## 3. Git 기본 설정

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
git config --global init.defaultBranch main
git config --global core.editor "code --wait"
```

## 4. VS Code 확장 설치

VSCode 실행 후 Ctrl+Shift+P -> "쉘 명령: Path에 'code' 명령 설치" 실행

```bash
cat vscode/extensions.txt | xargs -L 1 code --install-extension
```

## 5. Shell alias 적용

```bash
source shell/aliases.sh
```

## 6. 프로젝트 시작 루틴

```bash
gh repo clone owner/repository
cd repository
code .
```

## 7. 새 환경 체크리스트

- [ ] Git 설치
- [ ] GitHub CLI 설치
- [ ] GitHub 로그인
- [ ] SSH 키 등록
- [ ] VS Code 설치
- [ ] Settings Sync 활성화
- [ ] VS Code 확장 설치
- [ ] Git user.name 설정
- [ ] Git user.email 설정
- [ ] Node/Python/Java 버전 확인
- [ ] Docker 실행 확인
- [ ] 자주 쓰는 프로젝트 clone

1단계: README에 수동 설치 순서 작성
2단계: 자주 반복하는 명령어만 scripts/install-\*로 분리
3단계: VS Code 확장 자동 설치
4단계: Git 설정 자동 적용
5단계: shell alias 자동 연결
6단계: 언어별 런타임 설치 자동화
7단계: devcontainer로 프로젝트별 환경 고정
