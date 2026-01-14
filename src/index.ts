import { SchwabOAuth } from "./oauth/schwabOAuth.js";
import process from "node:process";

process.loadEnvFile('.env');

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  const oauth = new SchwabOAuth({
    clientId: reqEnv("SCHWAB_CLIENT_ID"),
    clientSecret: reqEnv("SCHWAB_CLIENT_SECRET"),
    redirectUri: reqEnv("SCHWAB_REDIRECT_URI"),
    tokenFile: "./.secrets/schwab-tokens.json",
    httpsCertPath: "./.secrets/certs/localhost.pem",
    httpsKeyPath: "./.secrets/certs/localhost-key.pem",
    openBrowser: true,
  });

  const accessToken = await oauth.getValidAccessToken();
  console.log("Got access token:", accessToken.slice(0, 10) + "…");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});