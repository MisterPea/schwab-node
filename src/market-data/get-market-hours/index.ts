import { MARKET_DATA_ROOT } from "../../helpers.js";
import { getRequest } from "../../request/index.js";
import { type GetMarketHoursConfig, GetMarketHoursSchema, MarketHoursNestedResponseSchema, MarketHoursResponseSchema, type MarketHoursRtn } from "./schema.js";

/**
 * Returns market hours for requested market(s) for today or a specified date up to 1 year in the future.
 */
export async function getMarketHours(config: GetMarketHoursConfig): Promise<MarketHoursRtn[]> {
  const parsedConfig = GetMarketHoursSchema.parse(config);

  const params = new URLSearchParams();
  const { markets } = parsedConfig;
  
  for (const market of markets) {
    params.append('markets', market);
  }

  if (parsedConfig.date != null) params.set('date', `${parsedConfig.date}`);
  const url = `${MARKET_DATA_ROOT}/markets?${params.toString()}`;

  const res = await getRequest(url);
  const json = await res.json();
  const parsedResponse = MarketHoursNestedResponseSchema.parse(json);

  const flattened: MarketHoursRtn[] = [];

  for (const marketElement of Object.values(parsedResponse)) {
    const marketHoursElementInner = Object.values(marketElement)[0];
    if (marketHoursElementInner == null) continue;
    const { date, marketType, isOpen, sessionHours } = marketHoursElementInner;
    flattened.push({ date, marketType, isOpen, sessionHours });
  }

  return MarketHoursResponseSchema.parse(flattened);
}
