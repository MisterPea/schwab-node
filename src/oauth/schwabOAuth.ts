import http from "node:http";
import https from "node:https";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { URL } from "node:url";
import { FileTokenStore, TokenSet } from "./tokenStore.js";

type SchwabOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;             // e.g. http://127.0.0.1:3000/callback
  tokenFile: string;               // e.g. ./.secrets/schwab-tokens.json
  authEndpoint?: string;           // default
  tokenEndpoint?: string;          // default
  refreshSkewMs?: number;          // refresh early
  openBrowser?: boolean;           // attempt to open authorize URL
  authTimeoutMs?: number;          // how long to wait for callback
  httpsCertPath?: string;
  httpsKeyPath?: string;
};

const DEFAULT_AUTH_ENDPOINT = "https://api.schwabapi.com/v1/oauth/authorize";
const DEFAULT_TOKEN_ENDPOINT = "https://api.schwabapi.com/v1/oauth/token";

function nowMs() {
  return Date.now();
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  const raw = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

function isExpired(tokens: TokenSet, skewMs: number) {
  const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
  return nowMs() >= (expiresAt - skewMs);
}

async function tryOpenBrowser(url: string) {
  // best-effort; don’t fail if not available
  try {
    const { platform } = process;
    const cmd =
      platform === "darwin" ? ["open", url] :
        platform === "win32" ? ["cmd", "/c", "start", "", url] :
          ["xdg-open", url];

    const { spawn } = await import("node:child_process");
    spawn(cmd[0], cmd.slice(1), { stdio: "ignore", detached: true }).unref();
  } catch {
    // ignore
  }
}

export class SchwabOAuth {
  private store: FileTokenStore;
  private cfg: Required<
    Pick<
      SchwabOAuthConfig,
      "authEndpoint" | "tokenEndpoint" | "refreshSkewMs" | "openBrowser" | "authTimeoutMs"
    >
  >;

  constructor(private config: SchwabOAuthConfig) {
    this.store = new FileTokenStore(config.tokenFile);
    this.cfg = {
      authEndpoint: config.authEndpoint ?? DEFAULT_AUTH_ENDPOINT,
      tokenEndpoint: config.tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT,
      refreshSkewMs: config.refreshSkewMs ?? 2 * 60_000,     // refresh 2 minutes early
      openBrowser: config.openBrowser ?? true,
      authTimeoutMs: config.authTimeoutMs ?? 5 * 60_000,     // 5 minutes
    };
  }

  authUrl(): string {
    const u = new URL(this.cfg.authEndpoint);
    u.searchParams.set("client_id", this.config.clientId);
    u.searchParams.set("redirect_uri", this.config.redirectUri);
    return u.toString();
  }

  async getValidAccessToken(): Promise<string> {
    let tokens = await this.store.load();

    // First-time login
    if (!tokens) {
      tokens = await this.runInteractiveOAuth();
      await this.store.save(tokens);
      return tokens.access_token;
    }

    // Still good
    if (!isExpired(tokens, this.cfg.refreshSkewMs)) {
      return tokens.access_token;
    }

    // Refresh path
    try {
      const refreshed = await this.refresh(tokens.refresh_token);
      await this.store.save(refreshed);
      return refreshed.access_token;
    } catch (err) {
      // Refresh token likely invalid/expired → restart OAuth
      const restarted = await this.runInteractiveOAuth();
      await this.store.save(restarted);
      return restarted.access_token;
    }
  }

  async runInteractiveOAuth(): Promise<TokenSet> {
    const url = this.authUrl();
    console.log("\nAuthorize this app by visiting:\n", url, "\n");

    if (this.cfg.openBrowser) {
      await tryOpenBrowser(url);
    }

    const code = await this.listenForAuthCode(this.config.redirectUri, this.cfg.authTimeoutMs);
    return this.exchangeCode(code);
  }

  private async listenForAuthCode(redirectUri: string, timeoutMs: number): Promise<string> {
    const u = new URL(redirectUri);

    const hostname = u.hostname;
    const port =
      u.port ? Number(u.port) :
        u.protocol === "https:" ? 443 :
          80;

    const pathname = u.pathname || "/";

    const handler: http.RequestListener = (req, res) => {
      try {
        const base = `${u.protocol}//${req.headers.host}`;
        const reqUrl = new URL(req.url ?? "/", base);

        if (reqUrl.pathname !== pathname) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        const codeParam = reqUrl.searchParams.get("code");
        if (!codeParam) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing ?code=");
          return;
        }

        // Schwab note: code must be URL-decoded before token exchange.
        const code = decodeURIComponent(codeParam);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body><h3>Authorized.</h3>You can close this tab.</body></html>`);

        // Stash code for promise resolution and close server
        (server as any).__code = code;
        server.close();
      } catch {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error");
        server.close();
      }
    };

    // Create either HTTP or HTTPS server depending on redirectUri protocol
    let server: http.Server | https.Server;

    if (u.protocol === "https:") {
      const certPath = this.config.httpsCertPath;
      const keyPath = this.config.httpsKeyPath;

      if (!certPath || !keyPath) {
        throw new Error(
          `redirectUri is https but httpsCertPath/httpsKeyPath not provided. ` +
          `Set config.httpsCertPath and config.httpsKeyPath.`
        );
      }

      const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
      server = https.createServer({ cert, key }, handler);
    } else if (u.protocol === "http:") {
      server = http.createServer(handler);
    } else {
      throw new Error(`Unsupported redirectUri protocol: ${u.protocol}`);
    }

    // Start listening
    server.listen(port, hostname);
    await once(server, "listening");

    // Wait for either code or timeout
    const code = await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => {
        try { server.close(); } catch { }
        reject(new Error(`Timed out waiting for OAuth redirect after ${timeoutMs}ms`));
      }, timeoutMs);

      const poll = setInterval(() => {
        const c = (server as any).__code as string | undefined;
        if (c) {
          clearTimeout(t);
          clearInterval(poll);
          resolve(c);
        }
      }, 50);
    });

    return code;
  }

  private async exchangeCode(code: string): Promise<TokenSet> {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code); // decoded
    body.set("redirect_uri", this.config.redirectUri);

    const resp = await fetch(this.cfg.tokenEndpoint, {
      method: "POST",
      headers: {
        "Authorization": basicAuthHeader(this.config.clientId, this.config.clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const text = await resp.text();
    if (!resp.ok) throw new Error(`Token exchange failed (${resp.status}): ${text}`);

    const json = JSON.parse(text);
    return { ...json, obtained_at: nowMs() } as TokenSet;
  }

  private async refresh(refreshToken: string): Promise<TokenSet> {
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refreshToken);

    const resp = await fetch(this.cfg.tokenEndpoint, {
      method: "POST",
      headers: {
        "Authorization": basicAuthHeader(this.config.clientId, this.config.clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const text = await resp.text();
    if (!resp.ok) throw new Error(`Refresh failed (${resp.status}): ${text}`);

    const json = JSON.parse(text);
    return { ...json, obtained_at: nowMs() } as TokenSet;
  }
}