import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockListenForAuthCode, mockTryOpenBrowser } = vi.hoisted(() => ({
  mockListenForAuthCode: vi.fn(),
  mockTryOpenBrowser: vi.fn(),
}));

vi.mock("../src/oauth/server.js", () => ({
  listenForAuthCode: mockListenForAuthCode,
  tryOpenBrowser: mockTryOpenBrowser,
}));

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SchwabAuth } from "../src/oauth/schwabAuth.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "schwab-node-auth-"));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  mockListenForAuthCode.mockReset();
  mockTryOpenBrowser.mockReset();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("SchwabAuth", () => {
  test("uses injected secret providers and token stores", async () => {
    const dir = await makeTempDir();
    const store = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    mockListenForAuthCode.mockResolvedValue({
      code: "oauth-code-1",
      session: "session-1",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            token_type: "Bearer",
            expires_in: 1800,
            scope: "api",
          }),
          { status: 200 },
        ),
      ),
    );

    const auth = new SchwabAuth({
      secrets: {
        getClientId: () => "client-from-provider",
        getClientSecret: () => "secret-from-provider",
        getRedirectUri: () => "https://127.0.0.1:8443/callback",
      },
      tokenStore: store,
      paths: {
        cwd: dir,
        storageRoot: "runtime/secrets",
      },
    });

    const token = await auth.getAuth();

    expect(token.access_token).toBe("new-access-token");
    expect(store.load).toHaveBeenCalledTimes(1);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(mockTryOpenBrowser).toHaveBeenCalledWith(
      expect.stringContaining("client_id=client-from-provider"),
    );
    expect(mockListenForAuthCode).toHaveBeenCalledWith(
      "https://127.0.0.1:8443/callback",
      60,
      expect.objectContaining({
        storageRoot: expect.stringContaining("runtime/secrets"),
      }),
    );

    await auth.clearAuth();
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  describe("delegated mode", () => {
    function makeStore(token: object) {
      return { load: vi.fn().mockResolvedValue(token), save: vi.fn(), clear: vi.fn() };
    }

    function liveToken(overrides?: object) {
      return {
        access_token: "delegated-token",
        token_type: "Bearer",
        expires_in: 1800,
        obtained_at: Date.now(),
        refresh_token: "r",
        refresh_obtained_at: Date.now(),
        scope: "api",
        ...overrides,
      };
    }

    test("reads token from store and returns it", async () => {
      const store = makeStore(liveToken());
      const auth = new SchwabAuth({ tokenMode: "delegated", tokenStore: store });

      const token = await auth.getAuth();

      expect(token.access_token).toBe("delegated-token");
      expect(store.load).toHaveBeenCalledTimes(1);
    });

    test("caches token in memory so second getAuth call skips the store", async () => {
      const store = makeStore(liveToken());
      const auth = new SchwabAuth({ tokenMode: "delegated", tokenStore: store });

      await auth.getAuth();
      await auth.getAuth();

      expect(store.load).toHaveBeenCalledTimes(1);
    });

    test("re-reads store when cached token is expired", async () => {
      const expired = liveToken({ obtained_at: Date.now() - 2_000_000 });
      const fresh = liveToken();
      const store = makeStore(expired);
      store.load.mockResolvedValueOnce(expired).mockResolvedValue(fresh);

      const auth = new SchwabAuth({ tokenMode: "delegated", tokenStore: store });

      await expect(auth.getAuth()).rejects.toThrow("token expired");
    });

    test("clearAuth clears in-memory cache so next getAuth re-reads store", async () => {
      const store = makeStore(liveToken());
      const auth = new SchwabAuth({ tokenMode: "delegated", tokenStore: store });

      await auth.getAuth();
      await auth.clearAuth();
      await auth.getAuth();

      expect(store.load).toHaveBeenCalledTimes(2);
      expect(store.clear).toHaveBeenCalledTimes(1);
    });

    test("throws when no token in store", async () => {
      const store = makeStore(null);
      const auth = new SchwabAuth({ tokenMode: "delegated", tokenStore: store });

      await expect(auth.getAuth()).rejects.toThrow("no token found");
    });
  });

  test("reads credentials from an overridden env path", async () => {
    const dir = await makeTempDir();
    const envDir = join(dir, "config");
    const envPath = join(envDir, "schwab.env");
    const store = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    await mkdir(envDir, { recursive: true });
    await writeFile(
      envPath,
      [
        "SCHWAB_CLIENT_ID=client-from-env",
        "SCHWAB_CLIENT_SECRET=secret-from-env",
        "SCHWAB_REDIRECT_URI=https://localhost:9443/callback",
      ].join("\n"),
      "utf8",
    );

    mockListenForAuthCode.mockResolvedValue({
      code: "oauth-code-2",
      session: "session-2",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "env-access-token",
            refresh_token: "env-refresh-token",
            token_type: "Bearer",
            expires_in: 1800,
          }),
          { status: 200 },
        ),
      ),
    );

    const auth = new SchwabAuth({
      tokenStore: store,
      paths: {
        cwd: dir,
        envPath: "config/schwab.env",
      },
    });

    const token = await auth.getAuth();

    expect(token.access_token).toBe("env-access-token");
    expect(mockTryOpenBrowser).toHaveBeenCalledWith(
      expect.stringContaining("client_id=client-from-env"),
    );
    expect(mockListenForAuthCode).toHaveBeenCalledWith(
      "https://localhost:9443/callback",
      60,
      expect.objectContaining({
        envPath,
      }),
    );
  });
});
