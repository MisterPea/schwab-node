import { constructTraderDataUrl } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import { type AccountsResponse, AccountsResponseSchema } from "./schema.js";

/**
 * Get linked account(s) balances and positions for the logged in user
 * @returns {Promise<AccountsResponse>}
 */
export async function getAccounts(): Promise<AccountsResponse> {
  const url = constructTraderDataUrl(null, "/accounts");
  const res = await getRequest(url);
  const json = await res.json();
  if (json == null) {
    throw new Error("Unexpected empty user preference response");
  }
  return AccountsResponseSchema.parse(json);
}
