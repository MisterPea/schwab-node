import { listenForAuthCode, tryOpenBrowser } from "./server.js";
import { FileTokenStore, TokenSet } from "./tokenStore.js";

type SchwabAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const AUTH_ENDPOINT_BASE = 'https://api.schwabapi.com/v1/oauth/authorize';
const DEFAULT_TOKEN_ENDPOINT = "https://api.schwabapi.com/v1/oauth/token";

export class SchwabAuth {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private fts: FileTokenStore = new FileTokenStore('.secrets/token');;
  private refreshSkew: number = 2 * 60_000;
  private authInProgress: Promise<TokenSet> | null = null;

  constructor(config: SchwabAuthConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  /**
   * Root auth call - locks while auth is in progress
   * @returns {Promise<TokenSet>}
   */
  getAuth(): Promise<TokenSet> {
    if (this.authInProgress) return this.authInProgress;

    this.authInProgress = this.getAuthInternal()
      .finally(() => { this.authInProgress = null; });

    return this.authInProgress;
  }

  /**
   * Private method that coordinates the token service
   * @returns {TokenSet}
   */
  private async getAuthInternal(): Promise<TokenSet> {
    let token: TokenSet | null = await this.fts.load();

    if (!token) {
      const code = await this.requestAuth();
      token = await this.retrieveAuthToken(code);

    } else if (!this.isExpired(token)) {
      return token;

    } else {
      const { refresh_token, refresh_obtained_at } = token;
      token = await this.refresh(refresh_token, refresh_obtained_at);
    }
    await this.fts.save(token);
    return token;
  }

  /**
   * Private method to request initial authentication
   */
  private async requestAuth(): Promise<string> {
    // perform initial oauth
    const url = new URL(AUTH_ENDPOINT_BASE);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    const authUrl = url.toString();

    await tryOpenBrowser(authUrl);
    const codeSession = await listenForAuthCode(this.redirectUri);
    const { code, session } = codeSession; // keep session for debug

    if (!session) throw new Error('session id must be part of the payload');

    return code;
  };

  /**
   * Convenience method to get time now ms-epoch
   * @returns {number}
   */
  private nowMs(): number {
    return Date.now();
  }

  /**
   * Private method to determine if token is expired
   * @param {TokenSet} tokens 
   * @returns {boolean}
   */
  private isExpired(tokens: TokenSet): boolean {
    // token expiration is in seconds
    const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
    return this.nowMs() >= (expiresAt - this.refreshSkew);
  }

  /**
   * Helper function to create the header for authorization
   * @param {string} clientId client id
   * @param {string} clientSecret client secret
   * @returns {Object} Return is a header object
   */
  private basicAuthHeader(clientId: string, clientSecret: string): Record<string, string> {
    const raw = `${clientId}:${clientSecret}`;
    const authorization = `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
    const header = {
      "Authorization": authorization,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    return header;
  };

  /**
   * Private method to retrieve a token based off oauth code
   * @param {string} code String retrieve from initial auth
   * @returns {Promise<TokenSet>}
   */
  private async retrieveAuthToken(code: string): Promise<TokenSet> {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code); // decoded
    body.set("redirect_uri", this.redirectUri);

    const resp = await fetch(DEFAULT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: this.basicAuthHeader(this.clientId, this.clientSecret),
      body,
    });

    const text = await resp.text();
    if (!resp.ok) throw new Error(`Token exchange failed (${resp.status}): ${text}`);

    const json = JSON.parse(text);
    return {
      ...json,
      obtained_at: this.nowMs(),
      refresh_obtained_at: this.nowMs()
    } as TokenSet;
  };

  /**
   * Private method to refresh an auth
   * @param {string} refresh_token
   * @returns {Promise<TokenSet>}
   */
  private async refresh(refresh_token: string, refresh_obtained_at: number): Promise<TokenSet> {
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refresh_token);

    const resp = await fetch(DEFAULT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: this.basicAuthHeader(this.clientId, this.clientSecret),
      body,
    });

    const text = await resp.text();

    // On fail start auth from scratch
    if (!resp.ok) {
      const code = await this.requestAuth();
      const token = await this.retrieveAuthToken(code);
      return token;
    }

    const json = JSON.parse(text);
    return {
      ...json,
      obtained_at: this.nowMs(),
      refresh_obtained_at
    } as TokenSet;
  }
}
