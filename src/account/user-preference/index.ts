import { constructTraderDataUrl } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import {
  UserPreferenceResponseSchema,
  type UserPreferenceResponse,
} from "./schema.js";

/**
 * Get user preference information for the logged in user
 * @returns {Promise<UserPreferenceResponse>}
 */
export async function getUserPreference(): Promise<UserPreferenceResponse> {
  const url = constructTraderDataUrl(null, "/userPreference");
  const res = await getRequest(url);
  const json = await res.json();
  if (json == null) {
    throw new Error("Unexpected empty user preference response");
  }

  return UserPreferenceResponseSchema.parse(json);
}
