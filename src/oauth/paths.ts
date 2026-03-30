import { isAbsolute, join, resolve } from "node:path";
import process from "node:process";

export type PathOptions = {
  cwd?: string;
  envPath?: string;
  storageRoot?: string;
};

export type SchwabPaths = {
  cwd: string;
  envPath: string;
  storageRoot: string;
  tokenPath: string;
  certsDir: string;
  callbackUrlPath: string;
};

function resolveFromCwd(cwd: string, target: string): string {
  return isAbsolute(target) ? target : resolve(cwd, target);
}

/**
 * Resolves the filesystem layout used by auth, token, and certificate helpers.
 * Relative overrides are resolved from the provided `cwd`.
 *
 * @param {PathOptions} [options] Optional cwd and path overrides.
 * @returns {SchwabPaths} Fully resolved absolute paths used by the package.
 */
export function resolveSchwabPaths(options: PathOptions = {}): SchwabPaths {
  const cwd = resolve(options.cwd ?? process.cwd());
  const envPath = resolveFromCwd(cwd, options.envPath ?? ".env");
  const storageRoot = resolveFromCwd(cwd, options.storageRoot ?? ".secrets");

  return {
    cwd,
    envPath,
    storageRoot,
    tokenPath: join(storageRoot, "token"),
    certsDir: join(storageRoot, "certs"),
    callbackUrlPath: join(storageRoot, "callback-url"),
  };
}
