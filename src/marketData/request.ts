import { getDefaultAuth } from '../oauth/defaultAuth.js';

type AuthToken = {
  access_token: string;
  token_type: string;
};

type AuthProvider = {
  getAuth(): Promise<AuthToken>;
};

async function performRequest(url: string, authProvider: AuthProvider): Promise<Response> {
  const { access_token, token_type } = await authProvider.getAuth();

  const reqHeaders = new Headers();
  reqHeaders.append('accept', 'application/json');
  reqHeaders.append('Authorization', `${token_type} ${access_token}`);

  const res = await fetch(url, {
    method: 'GET',
    headers: reqHeaders,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${msg}`);
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
