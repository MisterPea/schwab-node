import type { GetOptionChainRequest } from "./derivatives/get-option-chain/schema.js";
import type { OptionExpirationRequest } from "./derivatives/get-option-expirations/schema.js";
import type { GetMoversConfig, MoversConfig } from "./market-data/get-movers/schema.js";
import type { GetQuoteRequest } from "./market-data/get-quote/schema.js";
import type { GetPriceHistoryRequest } from "./market-data/price-history/schema.js";

export type GetMarketDataConfig =
  | GetPriceHistoryRequest
  | GetOptionChainRequest
  | OptionExpirationRequest
  | GetQuoteRequest
  | MoversConfig
  | GetMoversConfig;
