# Scripts

사용자용 환경 관리는 루트의 `dev-env` CLI로 통합되었습니다.

이 폴더에는 독립적인 고급 도구만 남깁니다.

```bash
# VS Code 프로필 확장 적용
node scripts/apply-vscode-profiles.mjs frontend

# 전체 프로필 파일 동기화 미리보기
node scripts/advanced/apply-vscode-profile-files.mjs all --dry-run

# 새 workspace 생성
node scripts/create-workspace.mjs --name my-app --preset frontend-app --runtime pnpm
```

패키지 설치·업데이트·정리, Shell 링크와 doctor는 다음 명령을 사용합니다.

```bash
dev-env setup
dev-env doctor
dev-env update
dev-env cleanup
dev-env links plan
```
