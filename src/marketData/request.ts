import { auth } from '../index.js';

export async function getRequest(url: string) {
  const { access_token, token_type } = await auth.getAuth();

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
