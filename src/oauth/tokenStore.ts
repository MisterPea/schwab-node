import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

export type TokenSet = {
  access_token: string;
  refresh_token: string;
  refresh_obtained_at: number;
  token_type: "Bearer";
  expires_in: number; // seconds
  id_token?: string;
  obtained_at: number; // epoch ms
  scope?: string;
};

export interface TokenStore {
  load(): Promise<TokenSet | null>;
  save(tokens: TokenSet): Promise<void>;
  clear?(): Promise<void>;
}

export interface TokenCipher {
  encrypt(plainText: string): Promise<string>;
  decrypt(cipherText: string): Promise<string>;
}

async function writeAtomic(filePath: string, payload: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, payload, "utf8");
  await rename(tmp, filePath); // atomic on same filesystem
}

/**
 * Stores tokens as plaintext JSON on disk.
 */
export class FileTokenStore {
  constructor(private filePath: string) {}

  /**
   * Loads tokens from disk when present.
   *
   * @returns {Promise<TokenSet | null>} Parsed token payload or `null`.
   */
  async load(): Promise<TokenSet | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as TokenSet;
    } catch {
      return null;
    }
  }

  /**
   * Persists tokens to disk.
   *
   * @param {TokenSet} tokens Token payload to write.
   * @returns {Promise<void>} Resolves when the file has been updated.
   */
  async save(tokens: TokenSet): Promise<void> {
    await writeAtomic(this.filePath, JSON.stringify(tokens, null, 2));
  }

  /**
   * Removes any persisted token file.
   *
   * @returns {Promise<void>} Resolves whether or not the file existed.
   */
  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}

/**
 * Stores encrypted token payloads on disk through an injected cipher.
 */
export class EncryptedFileTokenStore implements TokenStore {
  constructor(
    private filePath: string,
    private cipher: TokenCipher,
  ) {}

  /**
   * Loads and decrypts the stored token payload when present.
   *
   * @returns {Promise<TokenSet | null>} Parsed token payload or `null`.
   */
  async load(): Promise<TokenSet | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const decrypted = await this.cipher.decrypt(raw);
      return JSON.parse(decrypted) as TokenSet;
    } catch {
      return null;
    }
  }

  /**
   * Encrypts and persists the token payload.
   *
   * @param {TokenSet} tokens Token payload to write.
   * @returns {Promise<void>} Resolves when the file has been updated.
   */
  async save(tokens: TokenSet): Promise<void> {
    const encrypted = await this.cipher.encrypt(JSON.stringify(tokens));
    await writeAtomic(this.filePath, encrypted);
  }

  /**
   * Removes any persisted encrypted token file.
   *
   * @returns {Promise<void>} Resolves whether or not the file existed.
   */
  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}
