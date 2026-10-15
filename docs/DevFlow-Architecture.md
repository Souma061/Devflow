# DevFlow --- Complete System Architecture

**Status:** MVP architecture and implementation reference\
**Version:** 0.2\
**Last updated:** 14 October 2026

## 1. Purpose

DevFlow is a local-first developer workflow and coding-session manager.
It preserves the useful context around a coding session---what the
developer was doing, what changed in Git, what they learned, what is
blocked, and what to do next---so returning to a project is easier.

The initial product is a TypeScript CLI backed by SQLite. The
architecture leaves room for an optional background daemon, but the
first release must work fully without one.

## 2. Product and architecture principles

1.  **Local-first:** no account, hosted database, or network connection
    required for normal operation.
2.  **Session-oriented:** a session is a bounded period of work with a
    beginning snapshot and a handoff.
3.  **Git-aware, not Git-replacing:** Git provides repository facts; the
    developer supplies intent and interpretation.
4.  **Explicit and privacy-conscious:** capture only documented metadata
    and notes the developer chooses to enter.
5.  **CLI-first:** deliver a complete workflow before building
    dashboards, editor integrations, or background services.
6.  **Cross-platform:** develop primarily on Windows 11 and verify Linux
    compatibility in Docker; use WSL 2 for interactive Linux-specific
    testing if necessary.
7.  **Small, testable modules:** keep command parsing, application
    rules, Git operations, and persistence separate.
8.  **Incremental evolution:** add monitoring only when the core product
    demonstrates value.

## 3. Scope

### MVP

-   TypeScript CLI distributed/run through Node.js.
-   pnpm package management.
-   Git repository and working-tree detection.
-   `init`, `start`, `status`, `note`, `finish`, `resume`, and `history`
    commands.
-   SQLite persistence.
-   Timestamped manual notes.
-   Start/end Git metadata snapshots.
-   Active-session recovery after an unexpected exit.
-   Unit and integration tests.
-   Windows development and Linux-container test workflow.

### Later, not required for the first release

-   Background daemon that survives terminal closure.
-   Filesystem watching through Chokidar.
-   Periodic Git-state reconciliation.
-   Git hooks for selected events.
-   Export/import and configurable data retention.
-   Optional AI summaries, only with explicit consent and a documented
    data boundary.
-   Editor integrations, remote synchronization, dashboards, and team
    features.

## 4. High-level system diagram

``` mermaid
flowchart TD
    Developer[Developer]
    CLI[DevFlow CLI]
    Commands[Command handlers]
    Service[Session application service]
    GitAdapter[Git adapter]
    Repository[Persistence repository]
    SQLite[(Local SQLite database)]
    GitCLI[Git executable]
    Worktree[Project Git worktree]

    Developer --> CLI
    CLI --> Commands
    Commands --> Service
    Service --> GitAdapter
    Service --> Repository
    GitAdapter --> GitCLI
    GitCLI --> Worktree
    Repository --> SQLite
```

### Responsibilities

-   **CLI:** arguments, prompts, output formatting, and exit codes.
-   **Command handlers:** translate a command into an
    application-service call.
-   **Session service:** enforce session lifecycle and business rules.
-   **Git adapter:** execute Git safely and return structured metadata.
-   **Repository layer:** perform SQL operations and transactions.
-   **SQLite:** durable local source of truth.

Do not let command handlers directly contain SQL queries or raw Git
parsing logic.

## 5. Technology stack

  -----------------------------------------------------------------------
  Area                    Technology              Use
  ----------------------- ----------------------- -----------------------
  Runtime                 Node.js 24-compatible   Execute the CLI
                          runtime                 

  Language                TypeScript              Main application
                                                  language

  Package manager         pnpm                    Dependency and script
                                                  management

  CLI framework           Commander.js            Command parsing and
                                                  help

  Local database          SQLite                  Persistent
                                                  project/session records

  SQLite driver           `better-sqlite3`        Synchronous local
                                                  database access

  Input validation        Zod                     Validate command inputs
                                                  and JSON payloads

  Tests                   Vitest                  Unit and integration
                                                  tests

  Git integration         `node:child_process`    Read repository state
                          with Git CLI            

  Future file watcher     Chokidar                Optional path-level
                                                  monitoring

  Linux verification      Docker Desktop / Linux  Repeatable Linux
                          container               testing

  Optional Linux shell    WSL 2 with Ubuntu       Interactive
                                                  Linux-specific testing
  -----------------------------------------------------------------------

Pin supported Node versions and dependency versions in the project.
`better-sqlite3` contains native components; install and build
dependencies independently in Windows and Linux environments. Never copy
a Windows `node_modules` directory into Linux.

## 6. Suggested source tree

``` text
devflow/
├── docs/
│   ├── architecture.md
│   └── prd.md
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── init.ts
│   │       ├── start.ts
│   │       ├── status.ts
│   │       ├── note.ts
│   │       ├── finish.ts
│   │       ├── resume.ts
│   │       └── history.ts
│   ├── services/
│   │   └── session.service.ts
│   ├── git/
│   │   └── git.adapter.ts
│   ├── db/
│   │   ├── database.ts
│   │   ├── migrations/
│   │   └── session.repository.ts
│   ├── domain/
│   │   ├── project.ts
│   │   └── session.ts
│   ├── config/
│   │   └── paths.ts
│   └── utils/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .dockerignore
├── Dockerfile.test
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

Keep the structure proportional to the implementation. It is acceptable
to combine a few small modules initially; avoid empty abstractions
created solely to match the diagram.

## 7. CLI contract

The initial user-facing commands are:

  -----------------------------------------------------------------------
  Command                             Purpose
  ----------------------------------- -----------------------------------
  `devflow init`                      Initialize the local database and
                                      validate prerequisites

  `devflow start`                     Start a session in the current Git
                                      repository

  `devflow status`                    Show current session and Git state

  `devflow note "text"`               Append a timestamped note to the
                                      active session

  `devflow finish`                    Capture a handoff and close the
                                      session

  `devflow resume`                    Display the latest handoff and
                                      current repository state

  `devflow history`                   List recent sessions

  `devflow --help`                    Show usage and available commands

  `devflow --version`                 Show installed version
  -----------------------------------------------------------------------

Potential future daemon commands---`devflow daemon start`,
`devflow daemon status`, and `devflow daemon stop`---are not part of the
MVP CLI contract.

## 8. Core workflows

### Start a session

1.  Resolve the current directory to a Git worktree root.
2.  Normalize the repository path for the current OS.
3.  Create or retrieve the project record.
4.  Check whether the project already has an active session.
5.  Capture a starting Git snapshot.
6.  Persist the session and snapshot transactionally.
7.  Print the session ID, repository, branch, and working-tree summary.

If an active session already exists, do not create another silently.
Display the existing session and offer a clear continue/recover/finish
path.

### Add a note

1.  Resolve the project and active session.
2.  Validate non-empty note text and reasonable length limits.
3.  Append the note with a UTC timestamp.
4.  Persist the change and report success.

Do not create a session implicitly when no active session exists.

### Finish a session

1.  Prompt for accomplishments, blockers, and next action.
2.  Allow deliberate skips where appropriate and clearly identify
    omitted fields.
3.  Capture the final Git snapshot.
4.  Mark the session completed and persist the handoff atomically.
5.  Print a concise handoff summary.

Cancellation should not partially complete a session.

### Resume

1.  Resolve the current repository.
2.  Retrieve the most relevant recent session for that repository.
3.  Display its handoff and start/end metadata.
4.  Query current Git state separately.
5.  Clearly distinguish historical snapshot data from present-day
    repository state.

### Recover an interrupted session

The active record remains in SQLite if the terminal or computer closes
unexpectedly. On the next invocation, DevFlow detects it and offers a
recovery path. A stale session must not be silently marked complete,
because DevFlow cannot know whether the developer considers the work
done.

## 9. Git adapter design

Suggested interface:

``` ts
export interface GitSnapshot {
  capturedAt: string;
  repositoryRoot: string;
  branch: string | null;
  headCommit: {
    hash: string;
    subject: string;
  } | null;
  stagedPaths: string[];
  modifiedPaths: string[];
  untrackedPaths: string[];
}

export interface GitAdapter {
  getRepositoryRoot(cwd: string): Promise<string>;
  getSnapshot(repositoryRoot: string): Promise<GitSnapshot>;
}
```

This is an illustrative contract; adjust sync/async choices to the
selected process API and implementation.

### Implementation rules

-   Use `execFile` or `spawn` with argument arrays instead of
    concatenating shell commands.
-   Set timeouts and handle missing Git executables.
-   Prefer machine-readable Git output, such as porcelain status
    formats, over parsing localized human output.
-   Handle detached HEAD, renamed paths, deleted paths, and repositories
    with no commits.
-   Preserve spaces and Unicode in paths.
-   Do not save diffs or file contents in the MVP.
-   Keep Git-specific parsing inside the adapter so it can be tested
    independently.

## 10. Data model

Use stable IDs and UTC ISO-8601 timestamps. A UUID is suitable for
project and session IDs.

### `projects`

  Field          Type   Rules
  -------------- ------ ------------------------------------
  `id`           TEXT   Primary key
  `name`         TEXT   Required display name
  `repo_path`    TEXT   Required canonical repository root
  `created_at`   TEXT   Required UTC timestamp
  `updated_at`   TEXT   Required UTC timestamp

Canonical repository paths should be unique. Normalize separators and
handle Windows path case-insensitivity without incorrectly changing
Linux path semantics.

### `sessions`

  Field                   Type            Rules
  ----------------------- --------------- -----------------------------------------
  `id`                    TEXT            Primary key
  `project_id`            TEXT            Foreign key to `projects.id`
  `branch`                TEXT nullable   Branch at start
  `started_at`            TEXT            Required UTC timestamp
  `ended_at`              TEXT nullable   Null while active
  `status`                TEXT            `active`, `completed`, or `interrupted`
  `accomplishments`       TEXT nullable   Developer-written summary
  `blockers`              TEXT nullable   Developer-written blockers
  `next_action`           TEXT nullable   Concrete next step
  `notes_json`            TEXT            Ordered timestamped notes
  `start_snapshot_json`   TEXT nullable   Git metadata at start
  `end_snapshot_json`     TEXT nullable   Git metadata at finish
  `created_at`            TEXT            Required UTC timestamp
  `updated_at`            TEXT            Required UTC timestamp

For the MVP, notes and snapshots can be JSON text validated with Zod.
Normalize them into separate tables later if querying individual notes
or paths becomes important.

### Integrity rules

-   Enable SQLite foreign-key enforcement.
-   Use migrations and a schema version.
-   Use transactions for multi-record lifecycle changes.
-   Enforce one active session per project in application logic; add a
    partial unique index if supported by the chosen schema.
-   Do not silently overwrite completed sessions.
-   Treat database migration failures as explicit errors and recommend a
    backup before destructive recovery.

## 11. Session state machine

``` mermaid
stateDiagram-v2
    [*] --> Active: start
    Active --> Active: note / status
    Active --> Completed: finish
    Active --> Interrupted: explicit recovery decision
    Interrupted --> Active: resume/reopen
    Completed --> [*]
```

Keep lifecycle transitions explicit. `resume` can mean displaying a
handoff; if reopening a completed session is added, make that a separate
deliberate operation rather than changing a completed record silently.

## 12. Local data and configuration

Store the database in the user's application-data directory, not in the
project repository by default.

-   **Windows:** `%LOCALAPPDATA%\\DevFlow\\devflow.sqlite`
-   **Linux:** `$XDG_DATA_HOME/devflow/devflow.sqlite`, falling back to
    `~/.local/share/devflow/devflow.sqlite`

Implement path resolution in one module. A future configuration option
may override the data directory. Do not store configuration values that
are unnecessary for the MVP.

## 13. Testing strategy

### Unit tests

-   Session lifecycle rules.
-   Git porcelain-output parser.
-   Path normalization.
-   Input validation.
-   Data serialization and schema validation.
-   Error mapping.

### Integration tests

-   Create temporary Git repositories.
-   Test clean, staged, modified, deleted, renamed, and untracked files.
-   Start, note, finish, resume, and history end to end.
-   Simulate an active session left behind by process termination.
-   Verify database transactions and migrations.

### Windows tests

Develop primarily on Windows 11 with PowerShell 7. Test drive-letter
paths, spaces, Unicode, missing Git, and SQLite installation.

### Linux container tests

Use Docker Desktop to run the project in Linux. Install dependencies
inside the container. A starting `Dockerfile.test` can be:

``` dockerfile
FROM node:24-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
CMD ["pnpm", "test"]
```

This assumes `package.json` has a `test` script and the lockfile is
committed.

Suggested `.dockerignore`:

``` text
node_modules
.git
dist
coverage
.env
.env.*
```

Run watcher tests against files created inside the container, not only
files bind-mounted from Windows. Filesystem event behavior can differ
across mount boundaries.

### WSL 2

Use WSL 2 with Ubuntu if interactive Linux debugging or daemon lifecycle
testing becomes necessary. For native Linux filesystem behavior, keep a
WSL project copy under `~/projects/devflow` instead of `/mnt/c/...`.

Docker validates CLI behavior and Linux dependencies, but does not fully
validate Windows service management or a production Linux `systemd`
service.

## 14. Future daemon architecture

A daemon is a later milestone, not a prerequisite for MVP.

``` mermaid
flowchart TD
    CLI[DevFlow CLI] --> DB[(SQLite)]
    Daemon[Optional background daemon] --> Git[Git adapter]
    Daemon --> Watcher[Optional Chokidar watcher]
    Git --> Repo[Git repositories]
    Watcher --> Repo
    Daemon --> DB
```

### Future daemon responsibilities

-   Monitor explicitly registered repositories only.
-   Reconcile repository state periodically.
-   Treat watcher events as hints, not authoritative truth.
-   Debounce event bursts and handle duplicated/missed events.
-   Persist a heartbeat and process identity.
-   Support clear `start`, `status`, and `stop` operations.
-   Handle stale PID/lock files and graceful shutdown.
-   Keep the CLI functional when the daemon is absent.
-   Make monitoring visible, opt-in, and easy to disable.

Git does not broadcast every file change to DevFlow. Git hooks can
observe selected Git actions but not arbitrary edits. Filesystem
watchers observe paths, not developer intent. Reconciliation against
actual Git state is therefore required if monitoring is eventually
added.

## 15. Privacy and security

Do not collect by default:

-   source contents or diffs;
-   keystrokes;
-   terminal output or shell history;
-   environment variables or credentials;
-   screenshots or browser history;
-   arbitrary files outside the repository.

Treat paths and Git output as untrusted input. Do not execute notes as
commands. Keep data local unless the developer explicitly exports it.
Document data collection before adding any watcher, AI feature, or
synchronization.

## 16. Implementation sequence

1.  Initialize TypeScript, pnpm, Commander, Vitest, Zod, and SQLite
    driver.
2.  Add database migrations and repository tests.
3.  Implement Git repository detection and snapshot adapter.
4.  Implement `init`, `start`, and `status`.
5.  Implement `note`, `finish`, `resume`, and `history`.
6.  Add interruption/recovery rules and lifecycle tests.
7.  Verify on Windows and Docker Linux.
8.  Document installation, commands, database location, and privacy
    guarantees.
9.  Gather usage feedback before deciding whether a daemon is worth
    building.

## 17. Architecture acceptance checklist

-   [ ] CLI works without a daemon.
-   [ ] Session records persist after CLI exit.
-   [ ] Git operations are isolated behind an adapter.
-   [ ] Database schema is migrated and foreign keys are enabled.
-   [ ] A repository cannot accidentally have duplicate active sessions.
-   [ ] Start/end snapshots are metadata-only.
-   [ ] Interrupted sessions are recoverable.
-   [ ] Core tests pass on Windows and Linux.
-   [ ] Data location and privacy behavior are documented.
-   [ ] No cloud account or remote service is required.
