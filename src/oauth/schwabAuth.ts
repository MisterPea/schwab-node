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
  private fts: FileTokenStore;
  private refreshSkew: number;

  constructor(config: SchwabAuthConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.fts = new FileTokenStore('.secrets/token');
    this.refreshSkew = 2 * 60_000;
  }

  // Check for valid auth if no valid auth, start 3 leg auth
  async getAuth(): Promise<TokenSet> {
    let token: TokenSet | null = await this.fts.load();

    // start auth process
    if (!token || this.refreshWillExpire(token)) {
      const code = await this.requestAuth();
      token = await this.retrieveAuthToken(code);
      await this.fts.save(token);
      // if refresh is good but token expired
    } else if (this.isExpired(token)) {
      token = await this.refresh(token);
      await this.fts.save(token);
    };
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
    url.searchParams.set('scope', 'readonly');
    url.searchParams.set('redirect_uri', this.redirectUri);
    const authUrl = url.toString();

    await tryOpenBrowser(authUrl);
    const codeSession = await listenForAuthCode(this.redirectUri);
    const { code, session } = codeSession; // keep session for debug
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
    const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
    return this.nowMs() >= (expiresAt - this.refreshSkew);
  }

  /**
   * Private method to determine if refresh will expire within 12 hours
   * @param {TokenSet} tokens 
   * @returns {boolean}
   */
  private refreshWillExpire(tokens: TokenSet): boolean {
    return Date.now() > tokens.refresh_expiration - 43_200_00; // 12 hours
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
  }

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
      refresh_expiration: this.nowMs() + 604_800_000 // 7 days
    } as TokenSet;
  }

  private async refresh(oldToken: TokenSet) {
    const { refresh_token } = oldToken;

    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refresh_token);

    const resp = await fetch(DEFAULT_TOKEN_ENDPOINT, {
      method: "POST",
      headers: this.basicAuthHeader(this.clientId, this.clientSecret),
      body,
    });

    const text = await resp.text();
    if (!resp.ok) throw new Error(`Refresh failed (${resp.status}): ${text}`);

    const json = JSON.parse(text);
    return { ...json, obtained_at: this.nowMs() } as TokenSet;
  }
}

