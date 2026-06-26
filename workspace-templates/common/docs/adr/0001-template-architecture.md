# ADR 0001: Modular Workspace Template Architecture

## Status

Accepted

## Context

Projects need repeatable setup across frontend, backend, infrastructure, graphics, UX, and visual design work without forcing every project to carry every tool.

## Decision

Use a common base plus composable domain packs and runtime profiles. Generated workspaces should expose the same command names while allowing implementation details to vary by pack.

## Consequences

- New projects can be created from presets or explicit pack lists.
- Pack conflicts must be detected during generation.
- Shared command names are more important than identical internal tooling.
