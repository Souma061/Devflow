/**
 * DevFlow CLI Exit Codes
 *
 * Rules:
 * 1. Grouped by caller action / failure category:
 *    - Success: OK (0)
 *    - Usage / Validation: USAGE (2)
 *    - State Preconditions: NO_ACTIVE (4), SESSION_ACTIVE (6)
 *    - Environment Faults: NOT_A_REPO (3), DB (5), GIT_UNAVAILABLE (7)
 *    - Interruption: CANCELLED (130 = 128 + SIGINT)
 * 2. EXIT.ERROR (1) is the floor / catch-all for unexpected runtime faults.
 */
export const EXIT = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  NOT_A_REPO: 3,
  NO_ACTIVE: 4,
  DB: 5,
  SESSION_ACTIVE: 6,
  GIT_UNAVAILABLE: 7,
  CANCELLED: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: ExitCode | number = EXIT.ERROR,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

