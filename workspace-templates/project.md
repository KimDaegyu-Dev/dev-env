# Workspace Templates

This folder is organized as a modular template system.

## Structure

- `common/`: base files shared by every generated workspace.
- `packs/`: domain boundary packs. They define ownership, non-ownership, handoffs, and public interfaces.
- `bundles/`: reusable library and tooling stacks.
- `runtimes/`: package-manager/runtime profiles.
- `presets/`: named pack + bundle combinations for common project shapes.

## Usage

```bash
node scripts/create-workspace.mjs --name my-app --preset fullstack-web --runtime pnpm
node scripts/create-workspace.mjs --name shader-lab --packs common,computer-graphics,3d-graphics --runtime bun
node scripts/create-workspace.mjs --name infra-api --packs common,backend,infra --runtime pnpm
node scripts/create-workspace.mjs --name custom-ui --packs frontend,ui-ux --bundles react-tanstack,storybook-quality --runtime pnpm
```

Use `--dry-run` before writing files:

```bash
node scripts/create-workspace.mjs --name preview --preset frontend-app --runtime pnpm --dry-run
```

## Merge Rules

- JSON files are deep merged.
- JSON arrays append unique values by default.
- `.vscode/tasks.json` merges tasks by `label`.
- `.gitignore`, `.env.example`, and markdown checklists append unique lines.
- Non-mergeable file conflicts fail with the source pack and target file path.

Each pack owns its own `README.md` and `pack.json`; generated projects receive the relevant template files only.

## Domain Boundaries

Packs are not library buckets. A pack answers:

- What does this domain own?
- What does it explicitly not own?
- Which artifacts cross into other domains?
- Which public interfaces must stay stable?

Generated projects receive `docs/BOUNDARIES.md` from selected pack metadata.

## Library Bundles

Bundles are reusable dependency stacks. Use them when the same libraries are usually selected together, for example `react-tanstack`, `backend-nest`, `graphics-web`, or `rust-vulkan`.

Generated projects receive `docs/LIBRARIES.md` from selected bundles.
