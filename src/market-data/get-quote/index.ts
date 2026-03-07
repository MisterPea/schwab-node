import { constructMarketDataUrl } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import {
  type GetQuoteRequest,
  type GetQuotesResponse,
  GetQuotesResponseSchema,
} from "./schema.js";

function normalizeSymbols(symbols: GetQuoteRequest["symbols"]): string {
  if (Array.isArray(symbols)) {
    return symbols.join(",");
  }
  return symbols;
}

export async function getQuote(
  config: GetQuoteRequest,
): Promise<GetQuotesResponse> {
  const url = constructMarketDataUrl(
    { ...config, symbols: normalizeSymbols(config.symbols) },
    "/quotes",
  );
  const res = await getRequest(url);
  const json = await res.json();
  return GetQuotesResponseSchema.parse(json);
}
