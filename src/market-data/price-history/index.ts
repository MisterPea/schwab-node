import { constructMarketDataUrl, convertIsoStringToMs } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import { type GetPriceHistoryRequest, type GetPriceHistoryResponse, PriceHistoryQuerySchema, PriceHistoryResponseSchema } from "./schema.js";
import * as z from 'zod';

export async function getPriceHistory(config: GetPriceHistoryRequest): Promise<GetPriceHistoryResponse | undefined> {
  const result = PriceHistoryQuerySchema.safeParse(config);

  // Don't let invalid value pairings through
  if (!result.success) {
    console.error(JSON.stringify(z.treeifyError(result.error), undefined, 1));
    return;
  }

  // convert startDate/endDate to ms-epoch
  if (config.startDate) {
    config = { ...config, startDate: convertIsoStringToMs(config.startDate) };
  }
  if (config.endDate) {
    config = { ...config, endDate: convertIsoStringToMs(config.endDate) };
  }

  const url = constructMarketDataUrl(config, '/pricehistory');
  const res = await getRequest(url);
  const json = await res.json();
  return PriceHistoryResponseSchema.parse(json);
}
