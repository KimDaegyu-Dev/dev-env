# {{projectName}}

Generated from the modular workspace template system.

## Quick Start

```bash
{{runtimeInstallCommand}}
{{runtimeDevCommand}}
```

## Standard Commands

Use the commands below consistently across workspaces.

```bash
{{runtimeCommandPrefix}} check
{{runtimeCommandPrefix}} format
{{runtimeCommandPrefix}} lint
{{runtimeCommandPrefix}} typecheck
{{runtimeCommandPrefix}} test
{{runtimeCommandPrefix}} build
```

## Workspace Shape

- Runtime: `{{runtime}}`
- Packs: `{{packs}}`
- Bundles: `{{bundles}}`
- Environment variables are documented in `.env.example`.
- Operational notes belong in `docs/RUNBOOK.md`.
- Architecture decisions belong in `docs/ADR/`.
- Domain ownership is generated in `docs/BOUNDARIES.md`.
- Selected library stacks are generated in `docs/LIBRARIES.md`.

## Safety

- Do not commit `.env` files or real credentials.
- Prefer small changes and runnable checks.
- Keep generated assets and build output out of Git unless a pack explicitly says otherwise.
