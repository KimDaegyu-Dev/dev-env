# Node / Frontend

Frontend 프로필은 React, Next.js, TypeScript, Tailwind CSS 중심입니다.

## Recommended Tools

- Node.js LTS
- pnpm 또는 npm
- TypeScript
- ESLint
- Prettier
- Tailwind CSS

## VS Code Profile Settings

개인 취향에 가까운 설정은 `vscode/frontend/settings.json`에 둡니다.

- theme, icon theme, title/status/activity bar colors
- formatter 선택
- lint on save
- import 정리 방식

## Project Settings

프로젝트 repo의 `.vscode/settings.json`에는 프로젝트 실행에 필요한 설정만 둡니다.

- monorepo package path
- test runner path
- workspace-specific TypeScript SDK
- 프로젝트 전용 env file 이름

실제 `.env` 값은 저장하지 말고 `.env.example`만 commit합니다.
