import { readFile } from "node:fs/promises";

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

/**
 * Reads a single variable from a dotenv-style file without mutating `process.env`.
 *
 * @param {string} envPath Absolute or relative path to the env file.
 * @param {string} name Environment variable name to read.
 * @returns {Promise<string | undefined>} The parsed value when present.
 */
export async function readEnvValue(
  envPath: string,
  name: string,
): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await readFile(envPath, "utf8");
  } catch {
    return undefined;
  }

  const line = raw
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  if (!line) return undefined;
  const parsed = stripQuotes(line.slice(name.length + 1).trim());
  return parsed.length > 0 ? parsed : undefined;
}
