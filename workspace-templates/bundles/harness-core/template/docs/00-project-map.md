# Project Map

## Generated Shape

- Project: `{{projectName}}`
- Runtime: `{{runtime}}`
- Packs: `{{packs}}`
- Library bundles: `{{bundles}}`

## Required Resume Commands

```bash
./scripts/agent-status.sh
cat AGENTS.md
cat docs/00-project-map.md
cat docs/01-current-state.md
git log --oneline -12
```

## Standard Commands

```bash
./scripts/init.sh
./scripts/verify.sh fast
./scripts/verify.sh full
./scripts/harness-doctor.sh
```

## Directories

- `docs/`: durable product, architecture, policy, and learning knowledge.
- `tasks/active/`: one active task package per in-progress feature.
- `tasks/completed/`: completed task packages after review.
- `tasks/human/`: human-only approval, GUI, external-state, or visual judgment handoffs.
- `evals/`: golden tasks used to evaluate harness changes.
- `scripts/`: setup, status, verification, and harness health checks.

## Generated References

- `docs/BOUNDARIES.md`: selected domain responsibilities.
- `docs/LIBRARIES.md`: selected library bundles.
- `docs/policies/tool-permissions.md`: approval and unsafe-operation policy.
