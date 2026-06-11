# Python / AI

AI(Python) 프로필은 Python, Jupyter, Ruff, Pylance, pytest, uv/poetry, data viewer, AI assistant/MCP 실험에 맞춥니다.

## Recommended Tools

- Python 3.11+
- uv
- poetry, 필요 시
- pytest
- ruff
- jupyter

## VS Code Profile Settings

`vscode/ai-python/settings.json`에는 formatter, type checking, notebook, MCP 기본 비활성화 정책을 둡니다.

## Project Settings

프로젝트 repo에는 다음처럼 프로젝트 실행에 필요한 값만 둡니다.

- `.python-version`
- `pyproject.toml`
- local test env
- notebook kernel 안내
- `.env.example`

데이터셋 경로는 가능하면 상대 경로나 문서화된 환경변수로 표현합니다.
