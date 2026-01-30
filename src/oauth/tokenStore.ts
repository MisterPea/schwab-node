import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export type TokenSet = {
  access_token: string;
  refresh_token: string;
  refresh_expiration: number; // now + 7 days
  token_type: "Bearer";
  expires_in: number;         // seconds 
  id_token?: string;
  obtained_at: number;        // epoch ms
  scope?: string;
};

export class FileTokenStore {
  constructor(private filePath: string) { }

  async load(): Promise<TokenSet | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as TokenSet;
    } catch {
      return null;
    }
  }

  async save(tokens: TokenSet): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(tokens, null, 2), "utf8");
    await rename(tmp, this.filePath); // atomic on same filesystem
  }
}