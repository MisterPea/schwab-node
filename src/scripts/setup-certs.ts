#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

type ValidationResult =
  | { ok: true; parsed: URL; }
  | { ok: false; reason: string; };

type CertGenerationParams = {
  hostname: string;
  certPath: string;
  keyPath: string;
};

function getArgValue(name: string): string | null {
  const args = process.argv.slice(2);
  const idx = args.findIndex((arg) => arg === name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(name);
}

function resolveProjectRoot(): string {
  return process.env.INIT_CWD || process.cwd();
}

async function readRedirectUriFromEnvFile(projectRoot: string): Promise<string | null> {
  const envPath = join(projectRoot, ".env");
  if (!existsSync(envPath)) return null;

  const raw = await readFile(envPath, "utf8");
  const line = raw
    .split(/\r?\n/)
    .map((v) => v.trim())
    .find((v) => v.startsWith("SCHWAB_REDIRECT_URI="));
  if (!line) return null;
  return line.slice("SCHWAB_REDIRECT_URI=".length).replace(/^["']|["']$/g, "") || null;
}

function validateCallbackUrl(callbackUrl: string): ValidationResult {
  let parsed;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { ok: false, reason: `Invalid URL: ${callbackUrl}` };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Callback URL must use https." };
  }

  if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    return {
      ok: false,
      reason: "Callback hostname must be local (127.0.0.1 or localhost).",
    };
  }

  if (!parsed.port) {
    return { ok: false, reason: "Callback URL must include an explicit port." };
  }

  return { ok: true, parsed };
}

async function promptForCallbackUrl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return (await rl.question("Enter Schwab callback URL (https://127.0.0.1:PORT/path): ")).trim();
  } finally {
    rl.close();
  }
}

function ensureOpenSslAvailable(): boolean {
  const check = spawnSync("openssl", ["version"], { stdio: "ignore" });
  return check.status === 0;
}

function ensureMkcertAvailable(): boolean {
  const check = spawnSync("mkcert", ["--version"], { stdio: "ignore" });
  return check.status === 0;
}

function generateCertsWithOpenSsl({ hostname, certPath, keyPath }: CertGenerationParams): void {
  const sanValue = "DNS:localhost,IP:127.0.0.1";
  const args = [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-days",
    "3650",
    "-nodes",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-subj",
    `/CN=${hostname}`,
    "-addext",
    `subjectAltName=${sanValue}`,
  ];

  const result = spawnSync("openssl", args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || "OpenSSL failed to generate certificates.");
  }
}

function generateCertsWithMkcert({ certPath, keyPath }: CertGenerationParams): void {
  const args = [
    "-cert-file",
    certPath,
    "-key-file",
    keyPath,
    "localhost",
    "127.0.0.1",
  ];
  const result = spawnSync("mkcert", args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "mkcert failed to generate certificates.");
  }
}

async function writeCallbackFile(projectRoot: string, callbackUrl: string): Promise<void> {
  const callbackPath = join(projectRoot, ".secrets", "callback-url");
  await mkdir(dirname(callbackPath), { recursive: true });
  await writeFile(callbackPath, `${callbackUrl}\n`, "utf8");
}

async function ensureSecretsIgnored(projectRoot: string): Promise<void> {
  const gitignorePath = join(projectRoot, ".gitignore");
  const entry = ".secrets/";

  let current = "";
  if (existsSync(gitignorePath)) {
    current = await readFile(gitignorePath, "utf8");
  }

  const hasEntry = current
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === ".secrets" || line === entry);

  if (hasEntry) return;

  const needsLeadingNewline = current.length > 0 && !current.endsWith("\n");
  const prefix = needsLeadingNewline ? "\n" : "";
  await writeFile(gitignorePath, `${current}${prefix}${entry}\n`, "utf8");
  console.info(`[schwab-node] Added ${entry} to .gitignore`);
}

async function run() {
  console.clear();
  const projectRoot = resolveProjectRoot();
  await ensureSecretsIgnored(projectRoot);
  const force = hasFlag("--force");
  let callbackUrl = getArgValue("--callback");

  if (!callbackUrl) {
    callbackUrl = process.env.SCHWAB_REDIRECT_URI || (await readRedirectUriFromEnvFile(projectRoot));
  }

  if (!callbackUrl && process.stdin.isTTY) {
    callbackUrl = await promptForCallbackUrl();
  }

  if (!callbackUrl) {
    console.info("[schwab-node] Skipping cert setup: no callback URL provided.");
    console.info("[schwab-node] To install certificates, run: npx schwab-node-certs");
    return;
  }

  const validated = validateCallbackUrl(callbackUrl);
  if (!validated.ok) {
    throw new Error(`[schwab-node] ${validated.reason}`);
  }

  const { parsed } = validated;
  const certsDir = join(projectRoot, ".secrets", "certs");
  const certPath = join(certsDir, `${parsed.hostname}.pem`);
  const keyPath = join(certsDir, `${parsed.hostname}-key.pem`);

  await mkdir(certsDir, { recursive: true });

  const alreadyExists = existsSync(certPath) && existsSync(keyPath);
  if (alreadyExists && !force) {
    await writeCallbackFile(projectRoot, callbackUrl);
    console.info(`[schwab-node] Certs already exist for ${parsed.hostname}.`);
    console.info("[schwab-node] Use --force to regenerate.");
    return;
  }

  if (ensureMkcertAvailable()) {
    generateCertsWithMkcert({
      hostname: parsed.hostname,
      certPath,
      keyPath,
    });
    console.info("[schwab-node] Generated trusted local certs with mkcert.");
  } else {
    if (!ensureOpenSslAvailable()) {
      throw new Error("[schwab-node] Either mkcert or OpenSSL is required to generate certificates.");
    }

    generateCertsWithOpenSsl({
      hostname: parsed.hostname,
      certPath,
      keyPath,
    });
    console.info("[schwab-node] mkcert not found; generated self-signed certs with OpenSSL.");
  }

  await writeCallbackFile(projectRoot, callbackUrl);
  console.info(`\x1b[32m \n[schwab-node] Generated certs at ${certsDir}`);
  console.info(`[schwab-node] Callback URL saved to ${join(projectRoot, ".secrets", "callback-url")}`);
  console.info(`\n[schwab-node] Be sure to add a .env file in your project root with your SCHWAB_CLIENT_SECRET, SCHWAB_CLIENT_ID, and SCHWAB_REDIRECT_URI \n  \x1b[0m`);
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
