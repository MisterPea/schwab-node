import { SchwabOAuth, tryOpenBrowser } from "./oauth/schwabOAuth.js";
import process from "node:process";
import { listenForAuthCode } from "./oauth/server.js";
import { SchwabAuth } from "./oauth/schwabAuth.js";

process.loadEnvFile('.env');

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {

  // const x = await listenForAuthCode('https://127.0.0.1:8443');
  // console.log("***",x);
  const auth = new SchwabAuth({
    clientId: reqEnv("SCHWAB_CLIENT_ID"),
    clientSecret: reqEnv("SCHWAB_CLIENT_SECRET"),
    redirectUri: reqEnv("SCHWAB_REDIRECT_URI")
  });

  const token = await auth.getAuth();
  console.log(token);
  // const oauth = new SchwabOAuth({
  //   clientId: reqEnv("SCHWAB_CLIENT_ID"),
  //   clientSecret: reqEnv("SCHWAB_CLIENT_SECRET"),
  //   redirectUri: reqEnv("SCHWAB_REDIRECT_URI"),
  //   tokenFile: "./.secrets/schwab-tokens.json",
  //   httpsCertPath: "./.secrets/certs/localhost.pem",
  //   httpsKeyPath: "./.secrets/certs/localhost-key.pem",
  //   openBrowser: true,
  // });

  // const accessToken = await oauth.getValidAccessToken();
  // console.log("Got access token:", accessToken.slice(0, 10) + "…");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



// Authorization URL: https://api.schwabapi.com/v1/oauth/authorize?response_type=code&client_id=fnB6k1X6JSFlQHravRt6T9m86AZlkD04&scope=readonly&redirect_uri=https://developer.schwab.com/oauth2-redirect.html
// Token URL: https://api.schwabapi.com/v1/oauth/token
// Flow: authorizationCode


// {
//   code: 'C0.b2F1dGgyLmNkYy5zY2h3YWIuY29t.3px6Mr2Poj7SB3bjC9FMPNZ4NNjVG-mwzJQgCZ2NTEo@',
//   session: '71366297-1af7-4f10-9832-7972dcb07fbb'
// }