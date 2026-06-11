# AI(Python) Profile

`ai-python`은 Python, notebook, data, ML/RAG, AI tooling 실험을 위한 프로필입니다.

## Best For

- Jupyter notebook
- data exploration
- pytest / Ruff 기반 Python 개발
- uv 또는 poetry 환경 관리
- AI assistant / MCP 실험

## Includes

- Python, Pylance, Jupyter
- Ruff
- CSV / data viewer
- Copilot / Copilot Chat
- `uv sync`, `pytest`, `ruff check`, `ruff format`, `jupyter lab` tasks
- Python snippets

## Project Notes

프로필 설정은 interpreter 기본 경로, notebook 편의성, type checking 정도만 다룹니다.

프로젝트별 `.vscode/settings.json`에는 다음처럼 프로젝트 고유 항목만 두세요.

- 실제 interpreter path가 기본값과 다른 경우
- notebook kernel 안내
- data directory / cache directory 문서
- 실험용 launch 설정
