import express from 'express';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const CERTIFICATES_PATH = './.secrets/certs';

export type AuthCodeOutput = {
  code: string;
  session: string;
};

// Todo: Allow redirects that aren't localhost.
/**
 * Minimal server to listen to calls to 127.0.0.1
 * @param {string} redirectUri Redirect/callback url
 * @param {number} timeoutSec Optional timeout setting in seconds (default is 60sec)
 * @returns {Promise<string>} of code returned from authentication
 */
export async function listenForAuthCode(redirectUri: string, timeoutSec: number = 60): Promise<AuthCodeOutput> {
  const u = new URL(redirectUri);
  if (u.protocol !== 'https:') throw new Error(`Expected https redirect, got ${redirectUri}`);

  const certPath = `${CERTIFICATES_PATH}/127.0.0.1.pem`;
  const keyPath = `${CERTIFICATES_PATH}/127.0.0.1-key.pem`;

  const hostname = u.hostname;
  const port = Number(u.port) || '443';
  const pathname = u.pathname || '/';

  const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);

  const app = express();

  return await new Promise<AuthCodeOutput>((resolve, reject) => {
    const server = https.createServer({ cert, key }, app);

    const sockets = new Set<import("node:net").Socket>();
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });

    const shutdown = (err?: Error, result?: AuthCodeOutput) => {
      clearTimeout(timer);

      // Stop accepting new connections
      server.close(() => {
        // Resolve/reject after server has stopped listening
        if (err) reject(err);
        else if (result) resolve(result);
      });

      // Force-close any keep-alive sockets
      for (const s of sockets) s.destroy();
      sockets.clear();
    };

    const timer = setTimeout(() => {
      server.close();
      shutdown(new Error(`Timed out waiting for OAuth redirect after ${timeoutSec} seconds`));
    }, timeoutSec * 1000);


    app.get(/(.*)/, (req, res) => {
      const reqPath = req.path !== "/" ? req.path.replace(/\/+$/, "") : "/";
      if (reqPath !== pathname) {
        res.status(404).send("404 Not Found");
        return;
      }

      const { code, session, error, error_description } = req.query as Record<string, unknown>;

      if (typeof error === "string" && error.length) {
        res.status(400).send("Authorization failed. You can close this tab.");
        shutdown(new Error(`OAuth error: ${error}${typeof error_description === "string" ? ` (${error_description})` : ""}`));
        return;
      }

      if (typeof code !== "string" || !code.length) {
        res.status(400).send("Missing ?code=");
        return;
      }

      if (typeof session !== "string" || !session.length) {
        res.status(400).send("Missing ?session=");
        return;
      }

      res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send("<html><body><h3>Authorized.</h3>You can close this tab.</body></html>");

      shutdown(undefined, { code, session });
    });

    server.listen({ host: hostname, port: port }, () => {
      console.info(`Listening to ${port} on ${hostname} `);
    });

    server.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Function to handle the opening of a browser window and navigating of url
 * @param {string} url url to pass to the browser
 */
export async function tryOpenBrowser(url: string) {
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