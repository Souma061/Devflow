import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { APP_CONFIG, ENV_KEYS } from "./env.js";

export interface PathOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homedir?: string;
}

export function getDataDir(options: PathOptions = {}): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const userhome = options.homedir ?? os.homedir();

  const overrideDir = env[ENV_KEYS.DEVFLOW_DATA_DIR];
  if (overrideDir) {
    return path.resolve(overrideDir);
  }

  // Windows
  if (platform === "win32") {
    const localAppData = env[ENV_KEYS.LOCALAPPDATA];
    if (localAppData) {
      return path.join(localAppData, APP_CONFIG.APP_NAME);
    }
    return path.join(userhome, "AppData", "Local", APP_CONFIG.APP_NAME);
  }

  // macOS (darwin)
  if (platform === "darwin") {
    const xdgDataHome = env[ENV_KEYS.XDG_DATA_HOME];
    if (xdgDataHome) {
      return path.join(xdgDataHome, APP_CONFIG.APP_NAME_LOWER);
    }
    return path.join(
      userhome,
      "Library",
      "Application Support",
      APP_CONFIG.APP_NAME,
    );
  }

  // Linux / other POSIX
  const xdgDataHome = env[ENV_KEYS.XDG_DATA_HOME];
  if (xdgDataHome) {
    return path.join(xdgDataHome, APP_CONFIG.APP_NAME_LOWER);
  }
  return path.join(userhome, ".local", "share", APP_CONFIG.APP_NAME_LOWER);
}

export function getDatabasePath(options: PathOptions = {}): string {
  return path.join(getDataDir(options), APP_CONFIG.DB_FILENAME);
}

// Ensure that the data directory exists, creating it if necessary
export function ensureDataDir(options: PathOptions = {}): string {
  const dir = getDataDir(options);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Normalize a repo path into a canonical lookup key.
// On Windows, paths are case-insensitive, so we normalize to lower-case for consistency.
export function normalizeRepoPathKey(
  repoPath: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const normalized = pathModule.normalize(repoPath).replace(/[/\\]+$/, "");
  if (platform === "win32") {
    return normalized.toLowerCase();
  }
  return normalized;
}
