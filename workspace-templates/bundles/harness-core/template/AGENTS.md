# Agent Start Map

## Start

1. Run `./scripts/agent-status.sh`.
2. Read `docs/00-project-map.md`.
3. Read `docs/01-current-state.md`.
4. Read `feature_list.json`.
5. Choose exactly one unfinished feature.
6. Read only the task package and code relevant to that feature.

## Non-Negotiable Rules

- Do not mark a feature passing without evidence.
- Do not weaken acceptance criteria to make tests pass.
- Do not access secrets, production, billing, permissions, or destructive operations without explicit approval.
- Create a human handoff card for GUI-only, approval-only, external-state, or subjective visual decisions.
- End every meaningful task with verification evidence, state update, and a commit-ready diff.

## Work Loop

1. Confirm the task contract in `tasks/active/<id>/task.yaml`.
2. Load only the needed docs and source files.
3. Implement one feature or fix.
4. Run `./scripts/verify.sh fast`; run the relevant `full` scope before handoff.
5. Record evidence in `RESULTS.md`.
6. Update `feature_list.json` and `docs/01-current-state.md`.
7. Leave the next session with a clear resume point.

## Reference Map

- Domain ownership: `docs/BOUNDARIES.md`.
- Selected libraries: `docs/LIBRARIES.md`.
- Tool permissions: `docs/policies/tool-permissions.md`.
- Human handoffs: `tasks/human/`.
- Learning candidates: `docs/learning/candidates.md`.
