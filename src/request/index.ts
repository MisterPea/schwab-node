import { getDefaultAuth } from "../oauth/defaultAuth.js";

type AuthToken = {
  access_token: string;
  token_type: string;
};

type AuthProvider = {
  getAuth(): Promise<AuthToken>;
};

const MAX_CALLS_PER_MINUTE = 100;
const REQUEST_INTERVAL_MS = Math.ceil(60_000 / MAX_CALLS_PER_MINUTE);

let rateLimitQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimitSlot(): Promise<void> {
  const slot = rateLimitQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, nextRequestAt - now);

    if (waitMs > 0) {
      await delay(waitMs);
    }

    nextRequestAt = Math.max(nextRequestAt, Date.now()) + REQUEST_INTERVAL_MS;
  });

  // Keep the queue moving even if a waiter throws unexpectedly.
  rateLimitQueue = slot.catch(() => undefined);
  await slot;
}

async function performRequest(
  url: string,
  authProvider: AuthProvider,
): Promise<Response> {
  await waitForRateLimitSlot();
  const { access_token, token_type } = await authProvider.getAuth();

  const reqHeaders = new Headers();
  reqHeaders.append("accept", "application/json");
  reqHeaders.append("Authorization", `${token_type} ${access_token}`);

  const res = await fetch(url, {
    method: "GET",
    headers: reqHeaders,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${res.url}-${msg}`);
  }
  return res;
}

export function createGetRequest(authProvider: AuthProvider) {
  return async function getRequest(url: string): Promise<Response> {
    return performRequest(url, authProvider);
  };
}

export async function getRequest(url: string): Promise<Response> {
  return performRequest(url, getDefaultAuth());
}
