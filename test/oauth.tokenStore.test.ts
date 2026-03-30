import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  EncryptedFileTokenStore,
  FileTokenStore,
  type TokenCipher,
  type TokenSet,
} from "../src/oauth/tokenStore.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "schwab-node-token-store-"));
  tempDirs.push(dir);
  return dir;
}

function sampleToken(): TokenSet {
  return {
    access_token: "access-123",
    refresh_token: "refresh-456",
    refresh_obtained_at: 1700000000000,
    token_type: "Bearer",
    expires_in: 1800,
    obtained_at: 1700000000000,
    scope: "api",
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("token stores", () => {
  test("FileTokenStore round-trips plaintext tokens and clears them", async () => {
    const dir = await makeTempDir();
    const tokenPath = join(dir, "token.json");
    const store = new FileTokenStore(tokenPath);
    const token = sampleToken();

    await store.save(token);

    expect(await store.load()).toEqual(token);
    expect(await readFile(tokenPath, "utf8")).toContain("access-123");

    await store.clear();
    expect(await store.load()).toBeNull();
  });

  test("EncryptedFileTokenStore persists encrypted payloads", async () => {
    const dir = await makeTempDir();
    const tokenPath = join(dir, "token.enc");
    const cipher: TokenCipher = {
      async encrypt(plainText: string): Promise<string> {
        return Buffer.from(plainText, "utf8").toString("base64");
      },
      async decrypt(cipherText: string): Promise<string> {
        return Buffer.from(cipherText, "base64").toString("utf8");
      },
    };
    const store = new EncryptedFileTokenStore(tokenPath, cipher);
    const token = sampleToken();

    await store.save(token);

    expect(await store.load()).toEqual(token);
    const raw = await readFile(tokenPath, "utf8");
    expect(raw).not.toContain("access-123");

    await store.clear();
    expect(await store.load()).toBeNull();
  });
});
