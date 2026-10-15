# DevFlow --- Product Requirements Document

**Status:** MVP requirements\
**Version:** 0.2\
**Last updated:** 14 October 2026

## 1. Product summary

DevFlow is a local-first developer workflow and coding-session manager.
It helps developers resume work across breaks and project switches by
preserving a structured handoff: what was accomplished, what remains
blocked, the next action, and relevant Git metadata.

The first release is a TypeScript CLI backed by SQLite. It does not
require an account, cloud service, dashboard, or background daemon.

## 2. Problem statement

When a developer stops mid-task, returning to the work can require
reconstructing context from memory, Git history, terminal scrollback,
editor tabs, and scattered notes. Git captures version-control state but
not reliably the developer's intent, discoveries, blockers, or next
action.

DevFlow combines a lightweight manual handoff with a metadata-only Git
snapshot. It is not intended to infer task completion from file changes.

## 3. Vision and value proposition

**Vision:** Make it easy for a developer to stop coding and return later
without losing the thread.

**Value proposition:** Every coding session can end with a durable,
repository-aware handoff that makes the next useful action clear.

### Product principles

-   Local-first and usable offline.
-   Minimal friction: short CLI commands and concise output.
-   Human-authored context is the source of truth for intent.
-   Git metadata provides supporting context, not a replacement for
    notes.
-   Transparent, limited data collection.
-   Build a useful CLI before adding background automation.

## 4. Goals

1.  Reduce the cognitive overhead of returning to unfinished coding
    work.
2.  Keep project context and handoffs organized by Git repository.
3.  Make discoveries, blockers, and next steps durable.
4.  Preserve history locally across terminal and system restarts.
5.  Establish a cross-platform foundation for optional future
    monitoring.

## 5. Non-goals

The MVP will not:

-   replace Git, issue trackers, or project-management tools;
-   automatically understand source code or infer intent;
-   record full source files or diffs;
-   capture keystrokes, terminal output, shell history, or screenshots;
-   run AI summaries in the background;
-   sync data across devices;
-   provide team accounts, a hosted dashboard, or collaboration
    features;
-   install a Windows service or Linux daemon;
-   continuously monitor every file change.

## 6. Target user and primary scenario

### Target user

An individual developer working in multiple local Git repositories who
wants a dependable way to pause and resume coding sessions.

### Example scenario

A developer is debugging an API retry issue. They discover that a retry
handler is not respecting a configured limit, but must stop before
completing the fix. They run `devflow finish`, record the discovery and
blocker, and set the next action. Later, `devflow resume` shows that
handoff beside the repository's current Git state.

## 7. User stories

-   As a developer, I want DevFlow to detect the current repository so
    my session is linked to the correct project.
-   As a developer, I want to start a session with one command.
-   As a developer, I want to see the current session and working-tree
    summary.
-   As a developer, I want to add a short note without leaving my
    terminal workflow.
-   As a developer, I want to finish a session with accomplishments,
    blockers, and a concrete next action.
-   As a developer, I want to resume a handoff without searching through
    old terminal output.
-   As a developer, I want to review session history for a repository.
-   As a developer, I want my session to survive terminal closure or a
    system restart.
-   As a privacy-conscious developer, I want to know what is stored and
    keep it local by default.
-   As a developer using Windows, I want the core workflow to be
    testable on Linux without maintaining a second primary development
    environment.

## 8. Functional requirements

Priority: **P0** = MVP required; **P1** = next iteration; **P2** =
future.

  -----------------------------------------------------------------------------
  ID                Priority          Requirement       Acceptance criteria
  ----------------- ----------------- ----------------- -----------------------
  FR-01             P0                Repository        Running inside a Git
                                      detection         worktree resolves the
                                                        repository root.

  FR-02             P0                Git snapshot      Snapshot includes
                                                        branch, HEAD
                                                        hash/subject, staged
                                                        paths, modified paths,
                                                        untracked paths, and
                                                        timestamp.

  FR-03             P0                Start session     `devflow start`
                                                        persists a new active
                                                        session and its
                                                        starting snapshot.

  FR-04             P0                Status            `devflow status` shows
                                                        the active session and
                                                        current Git summary.

  FR-05             P0                Notes             `devflow note "text"`
                                                        appends a timestamped
                                                        note to the active
                                                        session.

  FR-06             P0                Finish            `devflow finish` saves
                                                        accomplishments,
                                                        blockers, next action,
                                                        ending snapshot, and
                                                        completion time.

  FR-07             P0                Resume            `devflow resume`
                                                        displays the latest
                                                        relevant handoff and
                                                        separately reports
                                                        current Git state.

  FR-08             P0                History           `devflow history` lists
                                                        recent sessions newest
                                                        first.

  FR-09             P0                Crash recovery    An active session
                                                        remains stored after
                                                        the CLI or system exits
                                                        unexpectedly.

  FR-10             P0                Lifecycle safety  A second active session
                                                        in the same repository
                                                        is not created
                                                        silently.

  FR-11             P0                Local persistence Projects and sessions
                                                        are stored in SQLite
                                                        with schema migrations.

  FR-12             P0                Actionable errors Missing Git, non-Git
                                                        directory, invalid
                                                        operation, and database
                                                        failure produce useful
                                                        errors.

  FR-13             P0                Cross-platform    Core tests pass on
                                      tests             Windows and in a Linux
                                                        container.

  FR-14             P0                Privacy defaults  No source contents,
                                                        diffs, terminal output,
                                                        keystrokes, secrets, or
                                                        screenshots are
                                                        collected by default.

  FR-15             P1                Export            Users can export
                                                        selected or all
                                                        sessions in a
                                                        documented format.

  FR-16             P1                Delete            Users can delete
                                                        individual sessions or
                                                        all local data with
                                                        confirmation.

  FR-17             P1                Configuration     Users can configure
                                                        selected defaults and
                                                        the data directory.

  FR-18             P2                Optional watcher  Opt-in path-level
                                                        monitoring is available
                                                        with clear controls.

  FR-19             P2                Optional daemon   A separate process can
                                                        reconcile repository
                                                        metadata and be
                                                        started/stopped
                                                        explicitly.

  FR-20             P2                Optional AI       Any AI summary requires
                                                        explicit consent and
                                                        documented data
                                                        handling.
  -----------------------------------------------------------------------------

## 9. CLI command requirements

### `devflow init`

Initialize the local data store, run migrations, and validate
prerequisites. It should be safe to run more than once.

### `devflow start`

-   Resolve the current repository.
-   Create or retrieve its project record.
-   Check for an existing active session.
-   Capture a start snapshot.
-   Persist the session.
-   Print a concise confirmation.

If an active session exists, show its details and guide the user toward
continuing or resolving it. Never silently create duplicate active
sessions.

### `devflow status`

Show repository name/path, branch, active-session status, elapsed time
when available, and counts of staged, modified, and untracked paths.
Avoid dumping large file lists by default.

### `devflow note "text"`

Append a timestamped note to the active session. Validate non-empty text
and provide a clear error when no active session exists. Do not create a
session implicitly.

### `devflow finish`

Prompt for: - **Accomplishments:** what was completed or learned? -
**Blockers:** what remains unclear or prevents progress? - **Next
action:** what is the next concrete step?

Capture the ending Git snapshot and complete the session
transactionally. Allow cancellation without partially completing the
session. If a field is skipped, make the omission clear.

### `devflow resume`

Display the latest relevant handoff and current Git status. Clearly
label historical snapshot information versus current repository
information. If a session is still active, offer to continue it rather
than create another.

### `devflow history`

List recent sessions with project, branch, start/end times, lifecycle
status, and a short handoff summary. A configurable limit and
detailed-session view can be added later.

### Future commands, not MVP

-   `devflow export`
-   `devflow delete`
-   `devflow daemon start`
-   `devflow daemon status`
-   `devflow daemon stop`

## 10. Data requirements

The minimum schema has `projects` and `sessions`.

### Project record

-   Stable ID.
-   Display name.
-   Canonical repository path.
-   Created and updated timestamps.

### Session record

-   Stable ID and project reference.
-   Branch at session start.
-   Start and optional end timestamps.
-   Lifecycle status: `active`, `completed`, or `interrupted`.
-   Accomplishments, blockers, and next action.
-   Ordered timestamped notes.
-   Start and end Git metadata snapshots.
-   Created and updated timestamps.

### Data rules

-   Use UTC ISO-8601 timestamps.
-   Enable SQLite foreign-key enforcement.
-   Use transactions for multi-step state changes.
-   Version schema changes with migrations.
-   Preserve active sessions after unexpected process termination.
-   Normalize repository paths in an OS-aware manner.
-   Do not store file contents or diffs in the MVP.
-   Keep the database in the user's application-data directory by
    default:
    -   Windows: `%LOCALAPPDATA%\\DevFlow\\devflow.sqlite`
    -   Linux: `$XDG_DATA_HOME/devflow/devflow.sqlite`, falling back to
        `~/.local/share/devflow/devflow.sqlite`

## 11. Session lifecycle and edge cases

Expected lifecycle:

1.  `start` creates an active session.
2.  `note` and `status` operate on the active session.
3.  `finish` marks it completed after saving the handoff.
4.  If the application exits unexpectedly, the record remains active.
5.  The next invocation detects the active record and offers recovery.

Additional cases to test:

-   Repository has no commits.
-   Detached HEAD.
-   Repository has staged, modified, deleted, renamed, or untracked
    files.
-   User runs a command outside a Git repository.
-   Git is missing or not on PATH.
-   A database migration fails.
-   The same command is run repeatedly.
-   The repository path contains spaces or Unicode.
-   A completed session is resumed for reading without being silently
    reopened.

## 12. Privacy and security requirements

-   Local-only operation is the default.
-   Collect only documented Git metadata and notes entered by the user.
-   Do not collect source contents/diffs, keystrokes, terminal output,
    shell history, environment variables, credentials, screenshots,
    browser history, or arbitrary files.
-   Do not execute notes or user-supplied strings as shell commands.
-   Invoke Git using safe process APIs and argument arrays.
-   Do not print environment variables or excessive repository details
    in errors.
-   Any future watcher, daemon, export, or AI feature must have clear
    data-handling documentation and explicit user controls.

## 13. Non-functional requirements

### Reliability

-   Persisted sessions survive CLI exit and system restart.
-   Failed operations do not leave contradictory state.
-   Commands have predictable, documented effects.
-   Database failures are visible and actionable.

### Performance

-   Common CLI commands should feel near-instantaneous in typical
    repositories.
-   Avoid unnecessary full-repository scans.
-   Avoid a continuously running process in the MVP.

### Portability

-   Support Windows and Linux for core commands.
-   Test Windows drive-letter paths, spaces, and Unicode.
-   Install native dependencies separately per platform.
-   Treat filesystem watcher behavior as platform-specific if added
    later.

### Maintainability

-   Separate CLI, session rules, Git integration, and database
    operations.
-   Use temporary Git repositories in integration tests.
-   Validate serialized JSON payloads.
-   Keep architecture proportional to the actual MVP.

## 14. Success metrics

MVP completion metrics:

-   A developer can complete the start → note → status → finish → resume
    → history flow.
-   A handoff can be retrieved after closing and reopening the terminal.
-   At least one active session per repository is enforced.
-   Core lifecycle and Git integration paths are covered by automated
    tests.
-   Tests pass on Windows and Linux container.
-   Normal use requires no cloud account or remote service.

After personal use, evaluate qualitative signals: - Is resuming faster
than reconstructing context manually? - Are next actions specific enough
to restart work? - Do developers remember to write handoffs? - Does any
command feel like unnecessary friction?

Do not claim quantified productivity gains until they are measured.

## 15. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Git metadata is mistaken for a full Keep manual notes and next action
  account of work                     central.

  The CLI becomes a complicated task  Keep the MVP centered on sessions
  manager                             and handoffs.

  Duplicate active sessions confuse   Enforce a clear per-repository
  users                               lifecycle policy.

  Native SQLite dependency differs by Install/test independently on
  OS                                  Windows and Linux.

  Watcher events are duplicated or    Defer watchers; if added, debounce
  missed                              and reconcile with Git.

  Monitoring feels invasive           Make future monitoring opt-in,
                                      metadata-only, visible, and
                                      stoppable.

  A stale active session is treated   Offer recovery; never infer
  as complete                         completion from elapsed time alone.

  Daemon work delays the MVP          Do not build it until CLI usage
                                      validates the need.
  -----------------------------------------------------------------------

## 16. Delivery roadmap

### Milestone 1 --- Foundation

-   Set up TypeScript, pnpm, Commander.js, Vitest, Zod, and SQLite.
-   Add database initialization and migrations.
-   Implement Git repository detection and snapshot retrieval.
-   Implement `init`, `start`, and `status`.

### Milestone 2 --- Session handoff

-   Implement timestamped notes.
-   Implement `finish`, `resume`, and `history`.
-   Add interruption recovery.
-   Add unit and integration tests.

### Milestone 3 --- Cross-platform hardening

-   Run tests on Windows 11.
-   Add a Linux Docker test image.
-   Verify Git edge cases, path handling, native SQLite installation,
    and persistence.
-   Write setup, command, data-location, and privacy documentation.

### Later --- Only based on feedback

-   Export and deletion.
-   Optional watcher and daemon.
-   Optional editor integration.
-   Optional AI summaries with explicit consent.

## 17. Definition of done

The MVP is done when:

-   [ ] All P0 requirements are implemented.
-   [ ] The full session workflow passes end-to-end.
-   [ ] Sessions survive CLI closure and interrupted execution.
-   [ ] Git metadata is captured without source contents or diffs.
-   [ ] Duplicate active sessions are handled safely.
-   [ ] Unit and integration tests pass on Windows and Linux Docker.
-   [ ] Setup and command usage are documented.
-   [ ] Local data location and privacy behavior are documented.
-   [ ] No daemon, cloud account, or remote service is required for
    normal use.

## 18. Open decisions

Decide these during implementation without blocking project setup:

1.  Should `start` offer to continue an existing active session or
    require a separate choice?
2.  Should handoff fields be mandatory, or may the user explicitly skip
    them?
3.  Should `resume` default to the current repository only?
4.  What should the default history limit be?
5.  Should the first export format be Markdown or JSON?
6.  Which Node.js versions will be officially supported in the first
    published release?
