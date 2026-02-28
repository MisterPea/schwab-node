export type ISODate = `${number}-${number}-${number}` | number;
export type SymbolString = string;
export type PeriodType = "day" | "month" | "year" | "ytd";
export type DayPeriod = 1 | 2 | 3 | 4 | 5 | 10;
export type MonthPeriod = 1 | 2 | 3 | 6;
export type YearPeriod = 1 | 2 | 3 | 5 | 10 | 15 | 20;
export type YtdPeriod = 1;
export type MinuteFrequencyType = "minute";
export type DailyFrequencyType = "daily";
export type WeeklyFrequencyType = "weekly";
export type MonthlyFrequencyType = "monthly";
export type DayFrequencyType = MinuteFrequencyType;
export type MonthFrequencyType = DailyFrequencyType | WeeklyFrequencyType;
export type YearFrequencyType =
  | DailyFrequencyType
  | WeeklyFrequencyType
  | MonthlyFrequencyType;
export type YtdFrequencyType = DailyFrequencyType | WeeklyFrequencyType;
export type MinuteFrequency = 1 | 5 | 10 | 15 | 30;
export type DailyFrequency = 1;
export type WeeklyFrequency = 1;
export type MonthlyFrequency = 1;
export type FrequencyFor<T extends string> = T extends "minute"
  ? MinuteFrequency
  : T extends "daily"
    ? DailyFrequency
    : T extends "weekly"
      ? WeeklyFrequency
      : T extends "monthly"
        ? MonthlyFrequency
        : never;
export type ChartBase = {
  symbol: SymbolString;
  startDate?: ISODate;
  endDate?: ISODate;
  needExtendedHoursData?: boolean;
  needPreviousClose?: boolean;
};
export type ChartRequest =
  | (ChartBase & {
      periodType: "day";
      period?: DayPeriod;
      frequencyType?: DayFrequencyType;
      frequency?: FrequencyFor<DayFrequencyType>;
    })
  | (ChartBase & {
      periodType: "month";
      period?: MonthPeriod;
      frequencyType?: MonthFrequencyType;
      frequency?: FrequencyFor<MonthFrequencyType>;
    })
  | (ChartBase & {
      periodType: "year";
      period?: YearPeriod;
      frequencyType?: YearFrequencyType;
      frequency?: FrequencyFor<YearFrequencyType>;
    })
  | (ChartBase & {
      periodType: "ytd";
      period?: YtdPeriod;
      frequencyType?: YtdFrequencyType;
      frequency?: FrequencyFor<YtdFrequencyType>;
    });

interface PriceHistoryCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  datetime: number;
}

export interface PriceHistoryRtnElement {
  symbol: string;
  empty: boolean;
  candles: PriceHistoryCandle[];
}

type OptionStrategy =
  | "SINGLE"
  | "ANALYTICAL"
  | "COVERED"
  | "VERTICAL"
  | "CALENDAR"
  | "STRANGLE"
  | "STRADDLE"
  | "BUTTERFLY"
  | "CONDOR"
  | "DIAGONAL"
  | "COLLAR"
  | "ROLL";
type AssetType =
  | "BOND"
  | "EQUITY"
  | "FOREX"
  | "FUTURE"
  | "FUTURE_OPTION"
  | "INDEX"
  | "MUTUAL_FUND"
  | "OPTION";

export type OptionChainReq = {
  symbol: string;
  contractType?: "CALL" | "PUT" | "ALL";
  strikeCount?: number;
  includeUnderlyingQuote?: boolean;
  strategy?: OptionStrategy;
  interval?: number;
  strike?: number;
  range?: "ITM" | "OTM" | "NTM" | "ATM";
  fromDate?: ISODate;
  toDate?: ISODate;
  volatility?: number;
  underlyingPrice?: number;
  interestRate?: number;
  daysToExpiration?: number;
  expMonth?:
    | "JAN"
    | "FEB"
    | "MAR"
    | "APR"
    | "MAY"
    | "JUN"
    | "JUL"
    | "AUG"
    | "SEP"
    | "OCT"
    | "NOV"
    | "DEC"
    | "ALL";
  optionType?: string;
  entitlement?: "PN" | "NP" | "PP";
};
export type ExpirationKey = `${number}-${number}-${number}:${number}`;
export type StrikeKey = string;
export type StrikeMap<TQuote> = Record<StrikeKey, TQuote[]>;
export type ExpDateMap<TQuote> = Record<ExpirationKey, StrikeMap<TQuote>>;
export type OptionSide = "call" | "put";
export type OptionSideMaps<TQuote> = {
  callExpDateMap: ExpDateMap<TQuote>;
  putExpDateMap: ExpDateMap<TQuote>;
};
export type GetOptionChainRtn = Omit<GetOptionChainRtnHead, "callExpDateMap"> &
  OptionSideMaps<OptionQuote>;
type GetOptionChainRtnHead = {
  symbol: string;
  status: string;
  underlying: string;
  strategy: OptionStrategy;
  interval: number;
  isDelayed: boolean;
  isIndex: boolean;
  interestRate: number;
  underlyingPrice: number;
  volatility: number;
  daysToExpiration: number;
  dividendYield: number;
  numberOfContracts: number;
  assetMainType: AssetType;
  assetSubType: string;
  isChainTruncated: boolean;
  callExpDateMap: ExpDateMap<OptionQuote>;
};
export type OptionQuote = {
  putCall: "CALL" | "PUT";
  symbol: string;
  description: string;
  exchangeName: string;
  bid: number;
  ask: number;
  last: number;
  mark: number;
  bidSize: number;
  askSize: number;
  bidAskSize: string;
  lastSize: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  closePrice: number;
  totalVolume: number;
  tradeTimeInLong: number;
  quoteTimeInLong: number;
  netChange: number;
  percentChange: number;
  volatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  openInterest: number;
  timeValue: number;
  intrinsicValue: number;
  extrinsicValue: number;
  theoreticalOptionValue: number;
  theoreticalVolatility: number;
  optionDeliverablesList: OptionDeliverable[];
  strikePrice: number;
  expirationDate: string;
  daysToExpiration: number;
  expirationType: "W" | "M" | "Q" | "R";
  lastTradingDay: number;
  multiplier: number;
  settlementType: "P" | "C";
  deliverableNote: string;
  markChange: number;
  markPercentChange: number;
  optionRoot: string;
  exerciseType: "A" | "E";
  high52Week: number;
  low52Week: number;
  inTheMoney: boolean;
  mini: boolean;
  pennyPilot: boolean;
  nonStandard: boolean;
};

export interface OptionDeliverable {
  symbol?: string;
  deliverableUnits?: number;
  assetType?: string;
  [key: string]: unknown;
}

export type OptionExpirationReq = {
  symbol: string;
};
export type OptionExpirationRtn = {
  expirationDate: ISODate;
  daysToExpiration: number;
  expirationType: "M" | "Q" | "S" | "W";
  settlementType: "A" | "P";
  optionRoots: string;
  standard: boolean;
};
export type GetAtmOptionReq = {
  symbol: string;
  window: [number, number];
};
type Fields = "quote" | "fundamental";
export type GetQuoteReq = {
  symbols: string;
  fields?: Fields | `${Fields}, ${Fields}`;
  indicative?: boolean;
};
type QuoteFundamental = {
  avg10DaysVolume: number;
  avg1YearVolume: number;
  declarationDate: string;
  divAmount: number;
  divExDate: string;
  divFreq: number;
  divPayAmount: number;
  divPayDate: string;
  divYield: number;
  eps: number;
  fundLeverageFactor: 0;
  lastEarningsDate: string;
  nextDivExDate: string;
  nextDivPayDate: string;
  peRatio: number;
  sharesOutstanding: number;
};
type QuoteQuote = {
  "52WeekHigh": number;
  "52WeekLow": number;
  askMICId: string;
  askPrice: number;
  askSize: number;
  askTime: number;
  bidMICId: string;
  bidPrice: number;
  bidSize: number;
  bidTime: number;
  closePrice: number;
  highPrice: number;
  lastMICId: string;
  lastPrice: number;
  lastSize: number;
  lowPrice: number;
  mark: number;
  markChange: number;
  markPercentChange: number;
  netChange: number;
  netPercentChange: number;
  openPrice: number;
  postMarketChange: number;
  postMarketPercentChange: number;
  quoteTime: number;
  securityStatus: string;
  totalVolume: number;
  tradeTime: number;
};
type QuoteExtended = {
  askPrice: number;
  askSize: number;
  bidPrice: number;
  bidSize: number;
  lastPrice: number;
  lastSize: number;
  mark: number;
  quoteTime: number;
  totalVolume: number;
  tradeTime: number;
};
type QuoteReference = {
  cusip: string;
  description: string;
  exchange: string;
  exchangeName: string;
  isHardToBorrow: boolean;
  isShortable: boolean;
  htbRate: number;
};
type QuoteRegular = {
  regularMarketLastPrice: number;
  regularMarketLastSize: number;
  regularMarketNetChange: number;
  regularMarketPercentChange: number;
  regularMarketTradeTime: number;
};
export type QuoteRtn = Record<string, QuoteData>;
export type QuoteData = {
  assetMainType: string;
  assetSubType: string;
  ssid: number;
  symbol: string;
  fundamental?: QuoteFundamental;
  quote?: QuoteQuote;
  extended?: QuoteExtended;
  reference?: QuoteReference;
  regular?: QuoteRegular;
};
type Greeks = "delta" | "gamma" | "theta" | "vega" | "rho" | "iv" | "absDelta";
export type AtmOptionRtn = {
  put_call: "PUT" | "CALL";
  day_of_week: "SUN" | "MON" | "TUE" | "WED" | "THR" | "FRI" | "SAT";
  underlying: string;
  open_interest: number;
  total_volume: number;
  symbol: string;
  dte: number;
  theta: number;
  strike_price: number;
  gamma: number;
  volatility: number;
  vega: number;
  delta: number;
};
export type GreekFilterRtn = {
  put_call: "PUT" | "CALL";
  underlying: string;
  symbol: string;
  dte: number;
  total_volume: number;
  open_interest: number;
  day_of_expiry: "SUN" | "MON" | "TUE" | "WED" | "THR" | "FRI" | "SAT";
  theta: number;
  strike_price: number;
  gamma: number;
  volatility: number;
  vega: number;
  delta: number;
  rho: number;
};
export type GreekFilterReq = {
  symbol: string;
  window: [number, number];
  greek: Partial<Record<Greeks, [number, number]>>;
  side?: "CALL" | "PUT" | "BOTH";
  strikeCount?: number;
};

export interface MoversConfig {
  sort: "VOLUME" | "TRADES" | "PERCENT_CHANGE_UP" | "PERCENT_CHANGE_DOWN";
  frequency?: 0 | 1 | 5 | 10 | 30 | 60;
}

export interface GetMoversConfig extends MoversConfig {
  index:
    | "$DJI"
    | "$COMPX"
    | "$SPX"
    | "NYSE"
    | "NASDAQ"
    | "OTCBB"
    | "INDEX_ALL"
    | "EQUITY_ALL"
    | "OPTION_ALL"
    | "OPTION_PUT"
    | "OPTION_CALL";
}

export interface ScreenerItem {
  readonly description: string;
  readonly volume: number;
  readonly lastPrice: number;
  readonly netChange: number;
  readonly marketShare: number;
  readonly totalVolume: number;
  readonly trades: number;
  readonly netPercentChange: number;
  readonly symbol: string;
}

export interface ScreenersResponseItem {
  readonly screeners: readonly ScreenerItem[];
}

export type ScreenersResponse = readonly ScreenersResponseItem[];
type AvailableMarkets = "equity" | "option" | "bond" | "future" | "forex";

export interface GetMarketHoursConfig {
  markets: AvailableMarkets[];
  date?: ISODate;
}

export interface MarketSession {
  date: string;
  marketType: string;
  product: string;
  isOpen: boolean;
}

export interface MarketSessionHoursRange {
  start: string;
  end: string;
}

export type MarketSessionHours = Record<string, MarketSessionHoursRange[]>;

export interface MarketHoursRtn {
  date: string;
  marketType: string;
  isOpen: boolean;
  sessionHours?: MarketSessionHours;
}
