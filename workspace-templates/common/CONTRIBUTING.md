# Contributing

## Workflow

- Use short-lived feature branches.
- Keep pull requests focused.
- Run the standard checks before requesting review.
- Include screenshots or recordings for visible UI changes.

## Commit Messages

Use Conventional Commits:

```text
<type>(scope): <summary>
```

## Local Hooks

The `.githooks/` folder contains examples. Enable them per project only after reviewing their cost:

```bash
git config core.hooksPath .githooks
```
