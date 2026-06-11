# Backend Profile

`backend`는 API 서버, DB, infra, container workflow를 위한 프로필입니다.

## Best For

- Docker / Dev Containers
- DB 조회와 운영 보조 작업
- Redis / Supabase / Terraform
- Remote SSH / WSL / Containers 기반 서버 작업

## Includes

- Docker 관련 확장
- DB / Redis client
- Terraform
- `docker compose up`, `logs`, `ps` tasks
- 수동 확인용 `docker compose down` 안내 task

## Safety

위험하거나 상태를 크게 바꾸는 명령은 자동 실행하지 않습니다.

- `docker compose down`
- destructive migration
- credential 포함 명령

## Project Notes

프로젝트 repo에는 `.env.example`, compose 파일, migration 문서, devcontainer 설정을 두고 실제 비밀 값은 commit하지 않습니다.
