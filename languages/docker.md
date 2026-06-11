# Backend / Docker

Backend 프로필은 Docker, Dev Containers, DB Client, Redis, Supabase, Terraform, Remote 개발에 맞춥니다.

## Recommended Tools

- Docker Desktop 또는 Docker Engine
- Docker Compose v2
- GitHub CLI
- Terraform, 필요 시
- DB CLI, 필요 시

## Safety

`docker compose down`은 컨테이너와 네트워크 상태를 바꿀 수 있으므로 자동 실행하지 않습니다. 필요한 경우 터미널에서 직접 확인 후 실행합니다.

## Project Settings

프로젝트 repo에는 다음을 둡니다.

- `.env.example`
- `docker-compose.yml`
- `.devcontainer/devcontainer.json`
- migration/seed 실행 방법

실제 DB password나 cloud credential은 commit하지 않습니다.
