import {
  SchwabAuth,
  type PathOptions,
  type SchwabAuthConfig,
  type TokenStore,
} from "./schwabAuth.js";

type CreateAuthFromEnvOptions = {
  paths?: PathOptions;
  tokenStore?: TokenStore;
};

let defaultAuthInstance: SchwabAuth | null = null;

/**
 * Creates and stores the shared default auth instance.
 *
 * @param {SchwabAuthConfig} config Auth configuration and storage overrides.
 * @returns {SchwabAuth} The configured auth instance.
 */
export function configureDefaultAuth(config: SchwabAuthConfig): SchwabAuth {
  const auth = new SchwabAuth(config);
  defaultAuthInstance = auth;
  return auth;
}

/**
 * Replaces the shared default auth instance.
 *
 * @param {SchwabAuth} auth Auth instance to reuse across helper calls.
 * @returns {void}
 */
export function setDefaultAuth(auth: SchwabAuth): void {
  defaultAuthInstance = auth;
}

/**
 * Creates an auth instance that resolves credentials from the configured env file.
 *
 * @param {CreateAuthFromEnvOptions} [options] Path and token-store overrides.
 * @returns {SchwabAuth} New auth instance that reads credentials lazily.
 */
export function createAuthFromEnv(
  options: CreateAuthFromEnvOptions = {},
): SchwabAuth {
  return new SchwabAuth({
    paths: options.paths,
    tokenStore: options.tokenStore,
  });
}

/**
 * Returns the shared default auth instance, creating one from env defaults when needed.
 *
 * @returns {SchwabAuth} Shared auth instance.
 */
export function getDefaultAuth(): SchwabAuth {
  if (!defaultAuthInstance) {
    defaultAuthInstance = createAuthFromEnv();
  }
  return defaultAuthInstance;
}

export type { CreateAuthFromEnvOptions };
