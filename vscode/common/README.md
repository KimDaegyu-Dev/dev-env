# Common Profile

`common`은 다른 프로필들이 공통으로 참고하는 기본 설정 모음입니다.

## Includes

- 한국어 언어팩
- GitLens
- GitHub Actions / PR 연동
- Remote SSH / Containers / WSL 후보
- CSV, Markdown, Shell, Docker 관련 기본 snippets

## Files

- `extensions.json`: 공통 추천 확장과 검토 후보
- `settings.json`: 전역 formatter 기본값, 자동 작업 금지, MCP 기본 비활성화
- `tasks.json`: 가벼운 확인용 task
- `keybindings.json`: 최소 공통 단축키
- `snippets/`: Markdown, shell, PowerShell, Docker, `.env.example` 템플릿

## Use

이 폴더는 단독 프로필로 써도 되지만, 보통은 다른 프로필의 출발점으로 사용합니다.

프로젝트 실행에 필요한 `.vscode/settings.json`는 각 프로젝트 repo에 두고, 개인 취향은 여기나 개별 프로필 설정에 둡니다.
