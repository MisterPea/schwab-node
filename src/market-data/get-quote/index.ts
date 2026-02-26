import { constructMarketDataUrl } from "../../helpers.js";
import { getRequest } from "../../scripts/request.js";
import { type GetQuoteRequest, type GetQuotesResponse, GetQuotesResponseSchema } from "./schema.js";

export async function getQuote(config: GetQuoteRequest): Promise<GetQuotesResponse> {

  const url = constructMarketDataUrl(config, '/quotes');
  const res = await getRequest(url);
  const json = await res.json();
  return GetQuotesResponseSchema.parse(json);
}

