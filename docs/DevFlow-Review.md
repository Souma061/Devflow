# DevFlow — Review of PRD and Architecture

**Reviewer:** opencode (engineering review)
**Subject:** `DevFlow-PRD.md` (v0.2), `DevFlow-Architecture.md` (v0.2)
**Date:** 14 October 2026

---

## 1. Verdict

The two documents are unusually coherent for a v0.2 MVP spec. They agree on
scope, principles, data model, lifecycle, and privacy, and they mostly resist
the temptation to over-build. The MVP is the right size: one CLI, one SQLite
file, manual notes, metadata-only Git snapshots, no daemon.

My concerns are not "wrong direction." They are a small number of **concrete
gaps that will bite during implementation** — a missing dependency for the
interactive `finish` prompt, a Windows path-casing bug hiding behind a unique
constraint, and one dependency choice (`better-sqlite3`) that drags native-build
complexity into a project whose whole selling point is "works everywhere with no
fuss." Everything else is polish or documentation hygiene.

Nothing here blocks starting Milestone 1.

---

## 2. What is genuinely strong

- **The core refusal to over-build.** Deferring the daemon, watcher, AI, and
  editor integration behind "only if CLI usage validates it" is the single best
  decision in both docs. Keep that spine. Most tooling projects die of daemon
  scope creep.
- **"Human intent is the source of truth; Git is supporting context."** Stated in
  both docs and it correctly shapes the data model (notes are first-class, Git is
  nullable JSON). This is the product's actual differentiator and it is protected.
- **Privacy stance is precise.** An explicit allowlist of what is *not* collected
  (`Architecture §15`, `PRD §12`) plus "don't execute notes as commands" is better
  than the usual "we take privacy seriously" hand-wave.
- **Git adapter seam is clean.** `GitSnapshot` as a structured value, parsing
  isolated behind the adapter, `execFile`/`spawn` over shell strings, porcelain
  over human output (`Architecture §9`). This is exactly the boundary that makes
  Git integration testable.
- **Lifecycle honesty.** "A stale session must not be silently marked complete"
  (`Architecture §8`) and `interrupted` as a distinct state shows the author
  thought about the failure modes, not just the happy path.
- **Consistency between docs.** Schema, command list, data location, and edge
  cases line up almost line-for-line. That is rare.

---

## 3. Concerns, ranked by impact

### 3.1 `better-sqlite3` is the wrong default for this project — HIGH leverage

`Architecture §5` picks `better-sqlite3` and then immediately has to warn:
"install and build dependencies independently in Windows and Linux environments.
Never copy a Windows `node_modules` directory into Linux."

That warning is the smell. `better-sqlite3` is a native addon: prebuilds usually
work, but on a version mismatch (new Node, musl vs glibc in the container, ARM)
it falls back to `node-gyp`, which needs a C++ toolchain on both Windows and in
`node:24-bookworm`. For a local-first CLI whose pitch is "just works," that is
imported fragility.

**Node 24 ships SQLite in the standard library.** `node:sqlite`
(`DatabaseSync`) is at **Stability 1.2 – Release candidate** as of Node 24.15,
is **no longer behind `--experimental-sqlite`** (since 22.13/23.4), exposes a
synchronous `prepare/get/run/all` API, supports WAL, transactions, and even
`backup()`.

Recommendation: use `node:sqlite` for the MVP. It removes a native dependency,
removes the "never copy node_modules across OSes" footgun, and removes an entire
class of Docker/Windows build failures — for zero lost functionality at this
scale. Revisit `better-sqlite3` only if Node's module proves limiting.

Caveat the docs should record: `node:sqlite` is still Stability 1.2 (RC), and
Node reserves the right to change experimental APIs. Pin the exact Node patch,
test on upgrade. That is a smaller risk than a cross-platform native build.

### 3.2 The stack is missing an interactive-prompt dependency — HIGH (real gap)

`PRD §9` and `Architecture §8` have `devflow finish` **prompt** for
accomplishments, blockers, and next action, with the ability to "deliberate skip"
fields. But the technology table (`Architecture §5`) lists only Commander and
Zod. Neither performs interactive prompts.

Either the author intends hand-rolled `readline` (fine, but it is real work:
multi-line input, cancellation, non-TTY behavior, Ctrl-C) or a prompt library is
missing from the list.

**Options considered**, and where each fits:

| Option | Tier | Verdict |
|--------|------|---------|
| `node:readline/promises` (stdlib) | line editing | Recommended default. Zero deps, covers three text fields + a numbered menu. Manual multi-line and Ctrl-C handling. |
| `@clack/prompts` | prompts + polish | Best-looking wizard library; adopt if you want visual polish and `group()` for the `finish` flow. Interactive-only. |
| `@inquirer/prompts` (modular) | prompts | Broadest prompt set incl. `editor` (multi-line), autocomplete, validation loops. Heavier, older feel. |
| `@poppinss/prompts`, `@topcli/prompts`, `consola.prompt` | prompts | Viable alternatives; no capability the above lack for this spec. |
| `Ink` | full-screen TUI | See below — explicitly deferred. |

Decision: commit to `node:readline/promises` and state the non-TTY contract.
Reach for clack/inquirer only when a real menu-driven wizard or validated
select/multi-line prompt appears.

**On Ink.** Ink is React components rendered to the terminal — the right tool
for a live, full-screen, focus-managed UI (dashboards, log viewers, a running
`devflow status --watch`). The architecture's "Later, not required" section
already defers exactly this: "Editor integrations, remote synchronization,
**dashboards**." A dashboard is what Ink is for, so adopt it *with* that
milestone, not before. Pulling React plus a reconciler into a CLI whose spec has
one menu and three text fields is the over-build this project is otherwise
carefully avoiding. Note also that Ink containers the whole interaction model
(it owns the render loop and raw mode), so mixing it with ad-hoc readline prompts
is awkward — pick one per surface. For editor integration later,
`--json` command output is the cheaper first step than any embedded TUI.

Related and more important: **`finish` must work non-interactively.** A CLI that
can only produce a handoff by answering three prompts is a CLI you cannot script,
test, or pipe. Add flags so the same data can be supplied inline, e.g.
`devflow finish --accomplishments "..." --blockers "..." --next "..."`, and
define what happens when stdin is not a TTY (error clearly, or accept flags only).
This directly serves the "near-instantaneous, minimal friction" goal.

### 3.3 Windows path case-insensitivity is not actually enforced — HIGH (correctness)

`Architecture §10` says "Canonical repository paths should be unique" and
"handle Windows path case-insensitivity," and the acceptance checklist wants
"A repository cannot accidentally have duplicate active sessions." But the
schema only has `repo_path TEXT`. SQLite's default `BINARY` collation is
**case-sensitive**, so `C:\Projects\Foo` and `c:\projects\foo` are two different
keys on Windows. The intended uniqueness silently fails on exactly the platform
the project develops on first.

Fix: store a normalized lookup key in addition to the display path.

- Add `repo_path_key TEXT NOT NULL UNIQUE` (or `COLLATE NOCASE`, but only on the
  key, never on the human-readable path).
- On Windows, derive the key with case-folding and normalized separators; on
  Linux, leave case intact (case-folding there would be wrong).
- Keep `repo_path` as the display value.

Without this, FR-10 / the duplicate-active-session guarantee is not real. This is
the one item I would treat as a must-fix before writing `start`.

### 3.4 The "one active session per project" index needs a precise definition — MEDIUM

`Architecture §10` suggests "a partial unique index if supported by the chosen
schema." SQLite supports it:
`CREATE UNIQUE INDEX ux_active ON sessions(project_id) WHERE status='active'`.
Good — but pin the exact semantics in the doc:

- Only `active` is unique. Multiple `interrupted` and `completed` rows per project
  are allowed (correct).
- Reopening an `interrupted` session sets it to `active`; the writer must confirm
  no other `active` row exists in the same transaction, or the index will (rightly)
  fail. Define that error path.

Also note this index cannot reference the `repo_path_key` above unless the
project row is resolved first — make the sequence explicit: resolve project (by
key) → then enforce active-uniqueness on `project_id`.

### 3.5 Two documents, one source of truth — MEDIUM (maintainability)

There is heavy duplication: principles, scope, data model, privacy, testing, and
data location appear in near-identical form in both files. `DevFlow-PRD.md §10`
restates the schema that `DevFlow-Architecture.md §10` owns; `§12` restates
privacy; the command list is duplicated in `PRD §9` and `Architecture §7`.

Duplication between a PRD and an architecture doc is normal to a point (the PRD
says *what*, the architecture says *how*). The issue here is that the *how*
details — column names, JSON layout, file paths — have leaked into the PRD. When
they drift, readers won't know which is authoritative.

Recommendation: keep the PRD at the level of requirements and acceptance
criteria; let the architecture doc own schema, paths, and interfaces. Add one
line to each doc stating the precedence ("Architecture is authoritative for
implementation detail; PRD for requirements"). Cheap insurance.

### 3.6 Notes and snapshots as unbounded JSON with read-modify-write — MEDIUM

`Architecture §10` stores `notes_json` and snapshot JSON as text and defers
normalization ("normalize later if querying becomes important"). Reasonable for
MVP. Two caveats to record:

- **Lost updates.** Appending a note is read → mutate array → write whole column.
  Two concurrent `devflow note` invocations (two terminals) can drop one. For a
  solo local tool this is minor, but state the assumption explicitly, and prefer
  `UPDATE ... SET notes_json = json_insert(...)` style mutation or a transaction
  with a version check so the write is atomic.
- **Growth.** `history`/`resume` should not parse every note of every session;
  keep them limited. Unbounded JSON is fine to store, not to always load.

### 3.7 SQLite concurrency settings are unstated — MEDIUM

Two terminals, or a long `finish` transaction during a `status`, will contend for
the database lock. Not mentioned anywhere. Specify, once, in `db/database.ts`:

- `PRAGMA journal_mode = WAL;`
- `PRAGMA busy_timeout = <ms>;` (so a competing writer waits instead of erroring)
- `PRAGMA foreign_keys = ON;` (already required by §10 — good, keep it here too)

This is a few lines and prevents intermittent "database is locked" errors that
are miserable to debug later.

### 3.8 No exit-code contract — MEDIUM (scriptability)

`Architecture §4` lists "exit codes" as a CLI responsibility, but no contract is
given. For a tool people will eventually script and hook, define it in one place:
e.g. `0` success, `1` generic/runtime failure, `2` usage error, `3` not-a-git-repo,
`4` no-active-session, `5` database error. `FR-12` ("actionable errors") is much
easier to test against fixed codes.

### 3.9 `history` scope is ambiguous — LOW/UX

`FR-08` says "lists recent sessions newest first"; the user story says "session
history for a repository." Those differ. Pick a default — I'd suggest **current
repository**, with `--all` to span repositories — and say so. Otherwise the first
implementation surprises someone.

### 3.10 `init` vs. lazy migration — LOW/UX

`PRD §9` says `init` "initialize[s] the local data store, run migrations."
Question the docs don't answer: what happens if the user runs `devflow start`
without ever running `init`? Requiring a separate init step is friction for a
tool selling "minimal friction." Cheaper and safer: run migrations idempotently
on every command that opens the DB, and keep `init` as an explicit
validate/health-check command. One less thing to document and forget.

### 3.11 `resume` "most relevant recent session" is undefined — LOW

Latest completed? Latest regardless of status? If an active session exists,
`resume` should offer to continue it (both docs say as much). Define the fallback
order explicitly so the behavior is deterministic and testable.

### 3.12 Minor / polish

- **Node version pinning.** §5 says "pin supported Node versions" but there is no
  `.nvmrc` / `engines` field in the suggested tree. Add one. If you adopt
  `node:sqlite`, the minimum Node version becomes a hard requirement — say so.
- **Git porcelain version.** §9 says "porcelain status formats." For paths with
  spaces and Unicode, prefer `git status --porcelain=v2 -z` (NUL-delimited) so you
  never have to guess at quoting. One sentence in the doc saves a parser rewrite.
- **Package name.** Confirm `devflow` is free on npm before committing to it as
  the bin name; a collision forces rename late.
- **Doc file location mismatch.** The tree (`Architecture §6`) references
  `docs/architecture.md` and `docs/prd.md`, but the actual files in the repo root
  are `DevFlow-Architecture.md` and `DevFlow-PRD.md`. Align them so instructions
  and reality match.
- **Chokidar in the stack table.** It is listed under "Technology stack" for a
  feature that is explicitly deferred. Harmless, but it invites someone to install
  it "early." Move it to a clearly labeled "future" row or footnote.
- **Timestamp display.** Store UTC (good), but state that user-facing output is
  rendered in local time. Otherwise "started at" will look wrong to every user.
- **`--json` output.** Not needed now, but a single structured-output flag would
  future-proof editor integration and make tests less brittle than asserting on
  human text. Worth a line in "Later."

---

## 4. Open decisions — where I'd land

The PRD's `§18` list is good discipline. My suggested defaults, so implementation
isn't blocked:

| # | Question | My recommendation |
|---|----------|-------------------|
| 1 | `start` when an active session exists: continue or require explicit choice? | Show the existing session; require an explicit `--continue` / `--finish` flag or interactive choice. Never silently reuse. |
| 2 | Handoff fields mandatory or skippable? | Skippable, but flag the omission in output. Forcing fields breeds junk data. |
| 3 | `resume` default scope? | Current repository only; `--all` to widen. |
| 4 | Default history limit? | 20. |
| 5 | First export format? | JSON (lossless, scriptable). Markdown second. |
| 6 | Supported Node versions? | Whatever you build on, pinned exactly (`.nvmrc` + `engines`). If `node:sqlite`, no lower bound below 24. |

---

## 5. Small additions I would make to the docs

1. A short **"Non-interactive / scripting contract"** subsection (flags, TTY
   detection) — see §3.2.
2. An explicit **exit-code table** — see §3.8.
3. The **`repo_path_key` normalization rule** spelled out — see §3.3.
4. The **SQLite pragmas** block (WAL, busy_timeout, foreign_keys) — see §3.7.
5. One line on **document precedence** (architecture is authoritative for
   implementation detail) — see §3.5.

---

## 6. Bottom line

Ship Milestone 1 as written, with two changes made first:

1. **Drop `better-sqlite3` for `node:sqlite`** (or consciously accept the native
   build tax and document it).
2. **Add a normalized, case-folded `repo_path_key` unique column** so the
   duplicate-session guarantee actually holds on Windows.

Then close the interactive-prompt gap (§3.2) before `finish`. Everything else is
tuning. The instinct to keep this small is correct — protect it and resist letting
the deferred daemon/watcher features leak back into the MVP.

---

## 7. Second review: response to the meta-analysis

Source: `devflow_comprehensive_analysis_critique_architectural_recommendations.md`.

A third document cross-reviews the PRD, the architecture, and this review. Its
**gap analysis is stronger than the original review's** and most of it should be
accepted; its **headline tooling recommendation should be rejected**; and it
raises the right unresolved question without answering it.

### 7.1 Accepted gaps (better than the first review)

- **Commits made *during* a session — the single best catch.** `GitSnapshot`
  (`Architecture §9`) captures only point-in-time tree state. A productive session
  that ends on a clean tree records `start=abc1234`, `end=def5678` and **zero**
  changed paths — the handoff is empty exactly when the most work happened. Fix:
  on `finish`, if `start.headCommit.hash !== end.headCommit.hash`, capture
  `git log --oneline <start>..<end>` (capped, e.g. 20) into the end snapshot.
  **Guard:** verify `start` is still an ancestor (`git merge-base --is-ancestor`)
  first — after a rebase/amend the range is meaningless.
- **Realpath before normalization.** `repo_path_key` must be derived from
  `fs.realpathSync.native(worktreeRoot)` *before* separator normalization and
  Windows case-folding, or symlinks/junctions/`~`-paths create duplicate projects.
  (The proposed `relink` command is P1 — defer.)
- **Path-array cap + `--untracked-files=normal`.** Cap stored path arrays (e.g.
  500) with `isTruncated` + counts so a broken `.gitignore` (a dropped `dist/`)
  cannot write megabytes into a snapshot row. Note: the default is already
  `normal`; the blow-up only occurs if you pass `--untracked-files=all`.
- **Drift warning on `resume`.** Beyond "label historical vs current" (`PRD §9`),
  compute and show the *difference*: branch changed, HEAD advanced, dirty count
  moved. ~20 lines, high UX value.
- **Build & distribution gap.** Neither original doc says how the CLI is built or
  executed. Must be documented (build step, `package.json#bin`, ESM, global link
  test on Windows + Linux).
- **Lazy init + `doctor`.** Every command runs `ensureDatabaseInitialized()`
  (create data dir, pragmas, pending migrations in an `IMMEDIATE` transaction);
  `init` becomes `doctor` (or an alias) that validates Git, DB path, schema
  version, permissions.
- **Non-interactive contract + `--json`.** As in §3.2 / §3.8.

### 7.2 Rejected: adopt Ink now

The doc's centerpiece recommendation is to build the terminal UI on **Ink
(`ink` + `@inkjs/ui` + React)** in v1. Reject for the MVP — it is the same
over-build this project is otherwise avoiding:

- The doc lists **five pitfalls** (ESM-only, JSX build step via `tsup`, raw-mode
  TTY crashes, startup overhead, alt-buffer traps) to serve an interactive surface
  of *one menu and three text fields*. A five-item mitigation list for a
  readline-sized job is the tell that it is the wrong rung.
- **It argues against itself.** It requires `--json` to *bypass Ink entirely*.
  If a JSON path is mandatory anyway (tests, IDE), the service layer is already
  UI-agnostic and Ink becomes a **swappable add-on** — which is the argument to
  defer, not adopt. It also concedes ~35–60ms React/Yoga startup against the NFR
  that commands feel *near-instantaneous*.
- Ink's only real value is the wizard/menu, which `node:readline/promises`
  already covers. The two-column `resume` card is narrow-terminal- and
  PowerShell-ANSI-fragile; a width-aware plain formatter gets ~80% with no deps.

Keep the doc's Ink *design* (component split, `ink-testing-library`,
Commander-for-parsing) as a ready v1.1 plan. Do not pay for it in v1.

### 7.3 The unanswered decision — repo vs worktree

§3.1 of the meta-analysis correctly raises, but never answers, the fork that
matters. **Project = worktree path**: unique `repo_path_key` per worktree, so two
simultaneous `git worktree` checkouts are two projects, each with one active
session — which is what worktree users want. Store `git_common_dir` (resolved to
absolute + realpath — `git rev-parse` can return a relative `.git`) so
`history`/`resume` can *optionally* roll up sessions across worktrees of the same
repo later. Add the column now (cheap); defer the roll-up behavior.

### 7.4 Scope inflation

The doc's §5 claims "~30 minutes of doc updates, then start coding," then lists
worktrees, relink, amend/undo, drift, commits, truncation, Ink, and `tsup`. That
is weeks, not minutes. Its triage is missing — hence §7.5.

### 7.5 Final triage

**v1 (in):** realpath-before-key; path cap + `--untracked-files=normal`;
commits-since-start (ancestor-guarded); drift warning on `resume`; build/dist
section; lazy init + `doctor`; flags + `--json`; `repo_path_key` + partial unique
index; `git_common_dir` column; the schema `CHECK (status IN ...)` + the
`(project_id, started_at DESC)` index.

**v1.1 (defer):** Ink; worktree roll-up behavior; `relink`; `note --amend/--undo`;
`finish --amend`.

**Optimization to keep from the doc:** the single
`git status --porcelain=v2 -z --branch --untracked-files=normal` call (branch +
HEAD oid + status in one spawn), plus a separate `git log -1 --format=%s` for the
subject.

### 7.6 Net

Adopt the meta-analysis's **factual** gaps almost wholesale — they are better than
this review's first pass. Reject its **tooling** leap. It is a good document that
got excited about Ink at the end.

### 7.7 Corrections to the meta-analysis

- `git log <start>..<end>` needs the ancestor check (see §7.1) or it lies after
  rebase/amend.
- `git rev-parse --git-common-dir` can return a relative path; resolve to absolute
  + realpath before storing.
- The `--untracked-files=all` blow-up is opt-in, not the default (see §7.1).
