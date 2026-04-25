import { readEnvValue } from "./env.js";
import { resolveSchwabPaths, type PathOptions, type SchwabPaths } from "./paths.js";
import { listenForAuthCode, tryOpenBrowser } from "./server.js";
import {
  FileTokenStore,
  type TokenSet,
  type TokenStore,
} from "./tokenStore.js";

export type SecretProvider = {
  getClientId?: () => Promise<string | undefined> | string | undefined;
  getClientSecret?: () => Promise<string | undefined> | string | undefined;
  getRedirectUri?: () => Promise<string | undefined> | string | undefined;
};

export type TokenMode = "managed" | "delegated";

export type SchwabAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tokenStore?: TokenStore;
  paths?: PathOptions;
  secrets?: SecretProvider;
  tokenMode?: TokenMode;
};

type ResolvedCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const AUTH_ENDPOINT_BASE = "https://api.schwabapi.com/v1/oauth/authorize";
const DEFAULT_TOKEN_ENDPOINT = "https://api.schwabapi.com/v1/oauth/token";

async function resolveSecret(
  name: string,
  directValue: string | undefined,
  provider?: () => Promise<string | undefined> | string | undefined,
  envPath?: string,
): Promise<string> {
  if (directValue) return directValue;

  const provided = await provider?.();
  if (provided) return provided;

  if (envPath) {
    const fromEnv = await readEnvValue(envPath, name);
    if (fromEnv) return fromEnv;
  }

  throw new Error(`Missing auth value ${name}`);
}

/**
 * Handles Schwab OAuth token acquisition, refresh, and persistence.
 */
export class SchwabAuth {
  private readonly config: SchwabAuthConfig;
  private readonly paths: SchwabPaths;
  private readonly tokenStore: TokenStore;
  private refreshSkew: number = 2 * 60_000;
  private authInProgress: Promise<TokenSet> | null = null;
  private credentialsPromise: Promise<ResolvedCredentials> | null = null;
  private cachedDelegatedToken: TokenSet | null = null;

  constructor(config: SchwabAuthConfig = {}) {
    this.config = config;
    this.paths = resolveSchwabPaths(config.paths);
    this.tokenStore = config.tokenStore ?? new FileTokenStore(this.paths.tokenPath);
  }

  /**
   * Resolves the current token, serializing concurrent refresh or login work.
   *
   * @returns {Promise<TokenSet>} Valid token payload.
   */
  getAuth(): Promise<TokenSet> {
    if (this.authInProgress) return this.authInProgress;

    this.authInProgress = this.getAuthInternal().finally(() => {
      this.authInProgress = null;
    });

    return this.authInProgress;
  }

  /**
   * Clears the persisted token when the configured store supports it.
   *
   * @returns {Promise<void>} Resolves when the token has been cleared.
   */
  async clearAuth(): Promise<void> {
    this.cachedDelegatedToken = null;
    await this.tokenStore.clear?.();
  }

  /**
   * Returns the resolved path layout used by this auth instance.
   *
   * @returns {SchwabPaths} Absolute filesystem paths used by this auth instance.
   */
  getPaths(): SchwabPaths {
    return this.paths;
  }

  /**
   * Private method that coordinates the token service.
   *
   * @returns {Promise<TokenSet>} Current token payload.
   */
  private async getAuthInternal(): Promise<TokenSet> {
    if (this.config.tokenMode === "delegated") {
      if (this.cachedDelegatedToken && !this.isExpired(this.cachedDelegatedToken)) {
        return this.cachedDelegatedToken;
      }
      const token = await this.tokenStore.load();
      if (!token) throw new Error("Delegated mode: no token found. Is the daemon running?");
      if (this.isExpired(token)) throw new Error("Delegated mode: token expired. Daemon may be down.");
      this.cachedDelegatedToken = token;
      return token;
    }

    let token: TokenSet | null = await this.tokenStore.load();

    if (!token) {
      const code = await this.requestAuth();
      token = await this.retrieveAuthToken(code);
    } else if (!this.isExpired(token)) {
      return token;
    } else {
      const { refresh_token, refresh_obtained_at } = token;
      token = await this.refresh(refresh_token, refresh_obtained_at);
    }

    await this.tokenStore.save(token);
    return token;
  }

  /**
   * Resolves auth credentials from direct config, secret providers, or env file overrides.
   *
   * @returns {Promise<ResolvedCredentials>} Resolved credential payload.
   */
  private async getCredentials(): Promise<ResolvedCredentials> {
    if (!this.credentialsPromise) {
      this.credentialsPromise = Promise.all([
        resolveSecret(
          "SCHWAB_CLIENT_ID",
          this.config.clientId,
          this.config.secrets?.getClientId,
          this.paths.envPath,
        ),
        resolveSecret(
          "SCHWAB_CLIENT_SECRET",
          this.config.clientSecret,
          this.config.secrets?.getClientSecret,
          this.paths.envPath,
        ),
        resolveSecret(
          "SCHWAB_REDIRECT_URI",
          this.config.redirectUri,
          this.config.secrets?.getRedirectUri,
          this.paths.envPath,
        ),
      ]).then(([clientId, clientSecret, redirectUri]) => ({
        clientId,
        clientSecret,
        redirectUri,
      }));
    }

    return this.credentialsPromise;
  }

  /**
   * Private method to request initial authentication.
   *
   * @returns {Promise<string>} OAuth authorization code.
   */
  private async requestAuth(): Promise<string> {
    const { clientId, redirectUri } = await this.getCredentials();

    const url = new URL(AUTH_ENDPOINT_BASE);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    const authUrl = url.toString();

    await tryOpenBrowser(authUrl);
    const codeSession = await listenForAuthCode(redirectUri, 60, {
      envPath: this.paths.envPath,
      storageRoot: this.paths.storageRoot,
    });
    const { code, session } = codeSession;

    if (!session) throw new Error("session id must be part of the payload");

    return code;
  }

  /**
   * Convenience method to get current time in milliseconds since epoch.
   *
   * @returns {number} Current timestamp.
   */
  private nowMs(): number {
    return Date.now();
  }

  /**
   * Determines whether the stored access token needs refresh.
   *
   * @param {TokenSet} tokens Current token payload.
   * @returns {boolean} `true` when the token should be refreshed.
   */
  private isExpired(tokens: TokenSet): boolean {
    const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
    return this.nowMs() >= expiresAt - this.refreshSkew;
  }

  /**
   * Creates the Authorization header for Schwab token requests.
   *
   * @param {string} clientId Client id.
   * @param {string} clientSecret Client secret.
   * @returns {Record<string, string>} Header payload for token requests.
   */
  private basicAuthHeader(
    clientId: string,
    clientSecret: string,
  ): Record<string, string> {
    const raw = `${clientId}:${clientSecret}`;
    const authorization = `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
    return {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  /**
   * Exchanges an authorization code for a token payload.
   *
   * @param {string} code Authorization code from the callback server.
   * @returns {Promise<TokenSet>} Current token payload.
   */
  private async retrieveAuthToken(code: string): Promise<TokenSet> {
    const { clientId, clientSecret, redirectUri } = await this.getCredentials();
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", redirectUri);

    const resp = await fetch(DEFAULT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: this.basicAuthHeader(clientId, clientSecret),
      body,
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Token exchange failed (${resp.status}): ${text}`);
    }

    const json = JSON.parse(text);
    return {
      ...json,
      obtained_at: this.nowMs(),
      refresh_obtained_at: this.nowMs(),
    } as TokenSet;
  }

  /**
   * Refreshes an access token with the stored refresh token.
   *
   * @param {string} refresh_token Stored refresh token.
   * @param {number} refresh_obtained_at Original refresh token timestamp.
   * @returns {Promise<TokenSet>} Refreshed token payload.
   */
  private async refresh(
    refresh_token: string,
    refresh_obtained_at: number,
  ): Promise<TokenSet> {
    const { clientId, clientSecret } = await this.getCredentials();
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refresh_token);

    const resp = await fetch(DEFAULT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: this.basicAuthHeader(clientId, clientSecret),
      body,
    });

    const text = await resp.text();
    if (!resp.ok) {
      const code = await this.requestAuth();
      return this.retrieveAuthToken(code);
    }

    const json = JSON.parse(text);
    return {
      ...json,
      obtained_at: this.nowMs(),
      refresh_obtained_at,
    } as TokenSet;
  }
}

export type { PathOptions, SchwabPaths, TokenSet, TokenStore };
