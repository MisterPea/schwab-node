import { warnLegacyImportRoute } from "../legacy/warn.js";
import { getQuote as getQuoteCurrent } from "../market-data/get-quote/index.js";
import type { GetQuoteRequest } from "../market-data/get-quote/schema.js";
import { getPriceHistory as getPriceHistoryCurrent } from "../market-data/price-history/index.js";
import type { GetPriceHistoryRequest } from "../market-data/price-history/schema.js";
import type {
  ChartRequest,
  GetQuoteReq,
  PriceHistoryRtnElement,
  QuoteRtn,
} from "../types.js";

warnLegacyImportRoute(
  "@misterpea/schwab-node/marketData/quotes",
  "@misterpea/schwab-node/market-data",
);

export async function getPriceHistory(
  config: ChartRequest,
): Promise<PriceHistoryRtnElement[]> {
  const result = await getPriceHistoryCurrent(config as GetPriceHistoryRequest);
  return result
    ? [
        {
          ...result,
          candles: result.candles.filter(
            (candle): candle is NonNullable<typeof candle> => candle != null,
          ),
        },
      ]
    : [];
}

export async function getQuote(config: GetQuoteReq): Promise<QuoteRtn[]> {
  const result = await getQuoteCurrent(config as GetQuoteRequest);
  return [result as QuoteRtn];
}
