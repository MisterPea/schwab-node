import { constructTraderDataUrl } from '../../helpers.js';
import { getRequest } from '../../request/index.js';
import { UserAccountArraySchema, type UserAccountNumbers } from './schema.js';

/**
 * Get list of account numbers and their encrypted values
 * @returns {Promise<UserAccountNumbers>}
 */
export async function getAccountNumbers(): Promise<UserAccountNumbers> {
  const url = constructTraderDataUrl(null, '/accounts/accountNumbers');
  const res = await getRequest(url);
  const json = await res.json();
  if (json == null) {
    throw new Error('Unexpected empty user preference response');
  }
  return UserAccountArraySchema.parse(json);
}
