import type {
  ChartRequest,
  GetQuoteReq,
  MoversConfig,
  OptionChainReq,
  OptionExpirationReq,
} from "./types.js";

export type GetMarketDataConfig =
  | ChartRequest
  | OptionChainReq
  | OptionExpirationReq
  | GetQuoteReq
  | MoversConfig;
