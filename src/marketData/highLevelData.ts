import { warnLegacyImportRoute } from "../legacy/warn.js";
import { getMarketHours as getMarketHoursCurrent } from "../market-data/get-market-hours/index.js";
import { getMovers as getMoversCurrent } from "../market-data/get-movers/index.js";
import type {
  GetMarketHoursConfig,
  GetMoversConfig,
  MarketHoursRtn,
  ScreenersResponse,
} from "../types.js";

warnLegacyImportRoute(
  "@misterpea/schwab-node/marketData/highLevelData",
  "@misterpea/schwab-node/market-data",
);

export async function getMovers(
  config: GetMoversConfig,
): Promise<ScreenersResponse> {
  const screeners = await getMoversCurrent(config);
  return [{ screeners }] as ScreenersResponse;
}

export async function getMarketHours(
  config: GetMarketHoursConfig,
): Promise<MarketHoursRtn[]> {
  return getMarketHoursCurrent(config);
}
