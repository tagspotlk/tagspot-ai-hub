# CLAUDE.md — tagspot-ai-hub

## Project

Tagspot AI Hub: a local-first desktop app (Electron + TypeScript UI, Spring Boot server
with bundled JRE, SQLite + sqlite-vec, MCP gateway with PATs in Windows Credential Manager).

Monorepo layout (ADR 11):

| Path | Holds |
|---|---|
| `ui/` | Electron app and the client generated from OpenAPI |
| `server/` | Spring Boot modules |
| `api/openapi.yaml` | The UI ↔ server contract |
| `packaging/` | jlink and installer |
| `openspec/` | Changes and capability specs |

Architecture and decisions live in the docs repo — read them before exploring a change:

- `../tagspot-ai-platform-docs/AI-Hub/docs/architecture.md`
- `../tagspot-ai-platform-docs/AI-Hub/docs/adr/` (ADRs 1–11)
- `../tagspot-ai-platform-docs/AI-Hub/docs/specs/` — only specs that cross products

Key rules from the architecture:

- The hub never reads provider tokens; providers sign in through their own CLI.
- MCP PATs live only in Credential Manager; SQLite stores a reference key.
- The UI talks only to the local REST API through the generated client.

## Development workflow (OpenSpec + Superpowers)

Every feature or behavior change goes through these seven phases, in order.
One OpenSpec change = one feature. Don't skip a phase; if one doesn't apply,
say so and why.

**Phase gates: never move to the next phase without asking.**
- At the end of each phase, stop. State which phase just finished, what it
  produced, and which phase comes next, then ask explicitly:
  "Move to <next phase>?" Wait for a clear yes.
- A "yes" to a question inside a phase (e.g. "capture this?") is not
  permission to start the next phase. Ask the phase question separately.
- Do the work of one phase per approval. Don't fold the next phase into the
  current one (e.g. don't write proposal artifacts while still in explore).
- Always tell the user which phase you're in when it changes.

```
explore ─► propose ─► plan ─► apply ─► verify ─► sync ─► archive
 (+design)
```

| # | Phase | Tool / skill | Output |
|---|---|---|---|
| 1 | Explore | `openspec-explore` (`/opsx:explore`) + design stage | Shared understanding, prototype(s) |
| 2 | Propose | `openspec-propose` (`/opsx:propose`) | `openspec/changes/<id>/` with proposal, design, specs, tasks |
| 3 | Plan | `superpowers:writing-plans` | `openspec/changes/<id>/plan.md` |
| 4 | Apply | `superpowers:subagent-driven-development` (+ `openspec-apply-change`) | Code, tests, ticked `tasks.md` |
| 5 | Verify | `superpowers:verification-before-completion`, `superpowers:requesting-code-review` | Evidence that tests, build and specs pass |
| 6 | Sync | `openspec-sync-specs` (`/opsx:sync`) | Delta specs merged into `openspec/specs/` |
| 7 | Archive | `openspec-archive-change` (`/opsx:archive`) | Change moved to `openspec/changes/archive/` |

### 1. Explore

- Use `openspec-explore` as the thinking partner: read the relevant ADRs and
  architecture, investigate the code, list open questions and options.
- In this repo `openspec-explore` fills the role of `superpowers:brainstorming`;
  don't run both for the same question.
- No production code in this phase.

**Design stage (UI-facing changes).** Build a prototype before proposing. Pick one:

- **Claude Design:** run `/design` for one prototype.
- **Tagspot designer (1–3 options):** run `/tagspot-design <count> <brief>`
  (global skill). It starts `count` `tagspot-ui-ux-designer` agents in parallel,
  each with a different direction (e.g. minimal, information-dense, guided), and
  writes them to `prototypes/<feature-slug>/`. Compare them side by side and
  pick one or mix them.

Record the chosen design (link or file) and the reasons in the explore notes so the
proposal can reference it.

### 2. Propose

- Run `openspec-propose` to create the change with `proposal.md`, `design.md`,
  delta `specs/`, and `tasks.md`.
- Reference the chosen prototype and any ADRs the change relies on.
- If the change contradicts an ADR, propose a new ADR in the docs repo instead of
  silently diverging.
- If the change alters `api/openapi.yaml`, say so in the proposal (breaking or not).
- Wait for the user's approval of the proposal before planning.

### 3. Plan

- Run `superpowers:writing-plans` with the approved change as its spec
  (`proposal.md`, `design.md`, `specs/`, `tasks.md`).
- Save the plan as `openspec/changes/<id>/plan.md` (not the skill's default folder),
  so the plan lives with its change.
- Each plan step maps to one or more items in `tasks.md`; `tasks.md` stays the
  source of truth for progress.
- Wait for the user's "go" before applying.

### 4. Apply

- Work on a branch named `<type>/<ticket-id>-<short-description>`, in a worktree
  (`superpowers:using-git-worktrees`).
- Execute the plan with `superpowers:subagent-driven-development`: one fresh
  subagent per task, review between tasks.
- Every task follows `superpowers:test-driven-development` (red → green → refactor).
- Tick items in `openspec/changes/<id>/tasks.md` as they finish
  (`openspec-apply-change` handles this when used for a task).
- On a bug or failing test, use `superpowers:systematic-debugging` before fixing.
- If the plan turns out wrong, stop and revise the change with
  `openspec-update-change`; don't drift from the specs.

### 5. Verify

- `superpowers:verification-before-completion`: run tests, build and linters for
  every area touched (`ui/`, `server/`, `api/`) and report the actual output.
- Check that each requirement and scenario in the delta specs is met and that
  every item in `tasks.md` is ticked.
- `superpowers:requesting-code-review` for a review; handle feedback with
  `superpowers:receiving-code-review`.
- `superpowers:finishing-a-development-branch` to decide how to integrate
  (commit and push only with the user's explicit permission).

### 6. Sync

- Run `openspec-sync-specs` to merge the change's delta specs into `openspec/specs/`.
- If the change affects other products (Marketplace, Forge), update
  `AI-Hub/docs/specs/` in the docs repo too.
- If an architectural decision changed, add or update the ADR and `architecture.md`.

### 7. Archive

- Run `openspec-archive-change` once the change is merged, verified and synced.
- Confirm `openspec/changes/<id>/` moved to the archive and `openspec/specs/`
  reflects the new behavior.

## Conventions

Personal defaults in `~/.claude/CLAUDE.md` apply (Conventional Commits, SOLID,
size limits, Given/When/Then tests, no commits without explicit permission).
