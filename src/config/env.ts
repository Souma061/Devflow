export const ENV_KEYS = {
  //optional custom directory override for the DB
  DEVFLOW_DATA_DIR: "DEVFLOW_DATA_DIR",
  LOCALAPPDATA: "LOCALAPPDATA",
  XDG_DATA_HOME: "XDG_DATA_HOME",
} as const;

export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];

/**
 * Application constants and default filenames.
 */
export const APP_CONFIG = {
  APP_NAME: "DevFlow",
  APP_NAME_LOWER: "devflow",
  DB_FILENAME: "devflow.sqlite",
} as const;
