import { constructTraderDataUrl } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import {
  type AccountsResponse,
  AccountsResponseSchema,
  type GetAccountsRequest,
  GetAccountsRequestSchema,
} from "./schema.js";

/**
 * Get linked account(s) balances and positions for the logged in user
 * @param {GetAccountsRequest} [config] Pass { fields: "positions" } to include positions
 * @returns {Promise<AccountsResponse>}
 */
export async function getAccounts(
  config?: GetAccountsRequest,
): Promise<AccountsResponse> {
  const parsed = GetAccountsRequestSchema.parse(config);
  const url = constructTraderDataUrl(
    parsed?.fields ? { fields: parsed.fields } : null,
    "/accounts",
  );
  const res = await getRequest(url);
  const json = await res.json();
  if (json == null) {
    throw new Error("Unexpected empty accounts response");
  }
  return AccountsResponseSchema.parse(json);
}
