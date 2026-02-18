import { SchwabAuth, type SchwabAuthConfig } from "./schwabAuth.js";
import process from "node:process";

let defaultAuthInstance: SchwabAuth | null = null;

export function configureDefaultAuth(config: SchwabAuthConfig): SchwabAuth {
  const auth = new SchwabAuth(config);
  defaultAuthInstance = auth;
  return auth;
}

export function setDefaultAuth(auth: SchwabAuth): void {
  defaultAuthInstance = auth;
}

function reqEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export function createAuthFromEnv(): SchwabAuth {
  process.loadEnvFile(".env");
  return new SchwabAuth({
    clientId: reqEnv("SCHWAB_CLIENT_ID"),
    clientSecret: reqEnv("SCHWAB_CLIENT_SECRET"),
    redirectUri: reqEnv("SCHWAB_REDIRECT_URI"),
  });
}

export function getDefaultAuth(): SchwabAuth {
  if (!defaultAuthInstance) {
    defaultAuthInstance = createAuthFromEnv();
  }
  return defaultAuthInstance;
}
