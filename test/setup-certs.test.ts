import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { setupCerts } from "../src/scripts/setup-certs.js";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "schwab-node-certs-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("setupCerts", () => {
  test("uses resolved paths for env, callback metadata, and gitignore entries", async () => {
    const projectRoot = await makeTempDir();
    const envPath = join(projectRoot, "config", "schwab.env");
    const storageRoot = join(projectRoot, "runtime", "schwab-secrets");
    const certsDir = join(storageRoot, "certs");

    vi.spyOn(console, "clear").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await mkdir(join(projectRoot, "config"), { recursive: true });
    await mkdir(certsDir, { recursive: true });
    await writeFile(
      envPath,
      "SCHWAB_REDIRECT_URI=https://127.0.0.1:8443/callback\n",
      "utf8",
    );
    await writeFile(join(certsDir, "127.0.0.1.pem"), "cert", "utf8");
    await writeFile(join(certsDir, "127.0.0.1-key.pem"), "key", "utf8");

    await setupCerts({
      paths: {
        cwd: projectRoot,
        envPath: "config/schwab.env",
        storageRoot: "runtime/schwab-secrets",
      },
    });

    expect(await readFile(join(storageRoot, "callback-url"), "utf8")).toBe(
      "https://127.0.0.1:8443/callback\n",
    );
    expect(await readFile(join(projectRoot, ".gitignore"), "utf8")).toContain(
      "runtime/schwab-secrets/",
    );
  });
});
