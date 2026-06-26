# Tool Permissions

## Requires Explicit Human Approval

- Secrets, credentials, OTPs, tokens, private keys, billing, or production data access.
- Production deploys, destructive cloud operations, database deletion, or irreversible migration.
- OAuth console changes, app-store submissions, domain/DNS changes, and permission grants.
- Legal, pricing, product-priority, brand, or subjective visual decisions.

## Human Handoff Categories

- Permission: approval, OTP, billing, deploy, OAuth, secret access.
- Judgment: design choice, product priority, legal or business judgment.
- External state: console configuration, browser login, account setup, non-reversible change.
- Visual verification: real UI polish, responsive quality, brand tone, subjective inspection.

## Agent Can Continue

- Local code edits within the task contract.
- Local tests, builds, typechecks, and static analysis.
- Mocked integration work that does not require real credentials.
- Drafting a human handoff card in `tasks/human/`.

## Handoff Rule

When a human-only step is needed, create `tasks/human/HUMAN-BLOCKED-<topic>.md` with:

- Needed by
- Why human
- Agent can continue
- Minimal GUI path
- Do not share
- Evidence to return
