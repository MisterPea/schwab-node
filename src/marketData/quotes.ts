import { ChartRequest, GetQuoteReq, QuoteRtn } from "../types.js";
import { constructMarketDataUrl, convertIsoStringToMs, readableStreamToObject } from "../helpers.js";
import { getRequest } from "./request.js";

export async function getPriceHistory(config: ChartRequest) {

  // convert startDate/endDate to ms-epoch
  if (config.startDate) {
    config = { ...config, startDate: convertIsoStringToMs(config.startDate) };
  }
  if (config.endDate) {
    config = { ...config, endDate: convertIsoStringToMs(config.endDate) };
  }

  const url = constructMarketDataUrl(config, '/pricehistory');
  const res = await getRequest(url);
  if (!res.body) throw new Error("No response body stream available");

  const priceHistoryOut = await readableStreamToObject(res.body);
  return priceHistoryOut;
}


export async function getQuote(config: GetQuoteReq): Promise<QuoteRtn[]> {
  const url = constructMarketDataUrl(config, '/quotes');
  const res = await getRequest(url);
  if (!res.body) throw new Error("No response body stream available");

  const result = await readableStreamToObject(res.body);
  return Array.isArray(result) ? result as QuoteRtn[] : [];
}
