import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_CONFIG, ENV_KEYS } from "../../src/config/env.js";
import {
  ensureDataDir,
  getDatabasePath,
  getDataDir,
  normalizeRepoPathKey,
} from "../../src/config/paths.js";

describe("paths configuration", () => {
  describe("getDataDir", () => {
    it("honors DEVFLOW_DATA_DIR override across all platforms", () => {
      const dataDir = getDataDir({
        platform: "win32",
        env: { [ENV_KEYS.DEVFLOW_DATA_DIR]: "/custom/devflow/dir" },
      });
      expect(dataDir).toBe(path.resolve("/custom/devflow/dir"));
    });

    it("uses %LOCALAPPDATA%\\DevFlow on win32 when LOCALAPPDATA is set", () => {
      const dataDir = getDataDir({
        platform: "win32",
        env: { [ENV_KEYS.LOCALAPPDATA]: "C:\\Users\\Alice\\AppData\\Local" },
      });
      expect(dataDir).toBe(
        path.join("C:\\Users\\Alice\\AppData\\Local", APP_CONFIG.APP_NAME),
      );
    });

    it("falls back to AppData\\Local\\DevFlow under homedir on win32 when LOCALAPPDATA is missing", () => {
      const dataDir = getDataDir({
        platform: "win32",
        env: {},
        homedir: "C:\\Users\\Alice",
      });
      expect(dataDir).toBe(
        path.join("C:\\Users\\Alice", "AppData", "Local", APP_CONFIG.APP_NAME),
      );
    });

    it("uses $XDG_DATA_HOME/devflow on darwin when set", () => {
      const dataDir = getDataDir({
        platform: "darwin",
        env: { [ENV_KEYS.XDG_DATA_HOME]: "/custom/mac/data" },
      });
      expect(dataDir).toBe(
        path.join("/custom/mac/data", APP_CONFIG.APP_NAME_LOWER),
      );
    });

    it("falls back to ~/Library/Application Support/DevFlow on darwin when XDG_DATA_HOME is missing", () => {
      const dataDir = getDataDir({
        platform: "darwin",
        env: {},
        homedir: "/Users/alice",
      });
      expect(dataDir).toBe(
        path.join(
          "/Users/alice",
          "Library",
          "Application Support",
          APP_CONFIG.APP_NAME,
        ),
      );
    });

    it("uses $XDG_DATA_HOME/devflow on linux when set", () => {
      const dataDir = getDataDir({
        platform: "linux",
        env: { [ENV_KEYS.XDG_DATA_HOME]: "/custom/data" },
      });
      expect(dataDir).toBe(
        path.join("/custom/data", APP_CONFIG.APP_NAME_LOWER),
      );
    });

    it("falls back to ~/.local/share/devflow on linux when XDG_DATA_HOME is missing", () => {
      const dataDir = getDataDir({
        platform: "linux",
        env: {},
        homedir: "/home/alice",
      });
      expect(dataDir).toBe(
        path.join("/home/alice", ".local", "share", APP_CONFIG.APP_NAME_LOWER),
      );
    });
  });

  describe("getDatabasePath", () => {
    it("appends devflow.sqlite to data directory", () => {
      const dbPath = getDatabasePath({
        platform: "linux",
        env: { [ENV_KEYS.XDG_DATA_HOME]: "/var/data" },
      });
      expect(dbPath).toBe(
        path.join(
          "/var/data",
          APP_CONFIG.APP_NAME_LOWER,
          APP_CONFIG.DB_FILENAME,
        ),
      );
    });
  });

  describe("ensureDataDir", () => {
    it("creates directory recursively if it does not exist", () => {
      const tempDir = path.join(os.tmpdir(), `devflow-test-${Date.now()}`);
      try {
        const created = ensureDataDir({
          env: { [ENV_KEYS.DEVFLOW_DATA_DIR]: tempDir },
        });
        expect(fs.existsSync(created)).toBe(true);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("normalizeRepoPathKey", () => {
    it("case-folds and normalizes separators on win32", () => {
      const key1 = normalizeRepoPathKey("C:\\Projects\\MyRepo\\", "win32");
      const key2 = normalizeRepoPathKey("c:/projects/myrepo", "win32");
      expect(key1).toBe(key2);
      expect(key1).toBe("c:\\projects\\myrepo");
    });

    it("preserves casing on linux", () => {
      const key1 = normalizeRepoPathKey("/home/user/MyRepo/", "linux");
      expect(key1).toBe("/home/user/MyRepo");
    });
  });
});
