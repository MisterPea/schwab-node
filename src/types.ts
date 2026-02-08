// --- primitives ---
export type ISODate = (`${number}-${number}-${number}`) | number; // "YYYY-MM-DD" shape

export type SymbolString = string;

// --- periodType + allowed periods ---
export type PeriodType = "day" | "month" | "year" | "ytd";

export type DayPeriod = 1 | 2 | 3 | 4 | 5 | 10;
export type MonthPeriod = 1 | 2 | 3 | 6;
export type YearPeriod = 1 | 2 | 3 | 5 | 10 | 15 | 20;
export type YtdPeriod = 1;

// --- frequencyType + allowed frequencies ---
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

// --- frequency duration depends on frequencyType ---
export type MinuteFrequency = 1 | 5 | 10 | 15 | 30;
export type DailyFrequency = 1;
export type WeeklyFrequency = 1;
export type MonthlyFrequency = 1;

export type FrequencyFor<T extends string> =
  T extends "minute" ? MinuteFrequency :
  T extends "daily" ? DailyFrequency :
  T extends "weekly" ? WeeklyFrequency :
  T extends "monthly" ? MonthlyFrequency :
  never;

// --- common fields shared by all requests ---
export type ChartBase = {
  symbol: SymbolString;

  startDate?: ISODate;
  endDate?: ISODate;

  needExtendedHoursData?: boolean;
  needPreviousClose?: boolean;
};

// --- discriminated union tying it all together ---
export type ChartRequest =
  (ChartBase & {
    periodType: "day";
    period?: DayPeriod; // default 10
    frequencyType?: DayFrequencyType; // default "minute"
    frequency?: FrequencyFor<DayFrequencyType>; // default 1
  })
  | (ChartBase & {
    periodType: "month";
    period?: MonthPeriod; // default 1
    frequencyType?: MonthFrequencyType; // default "weekly"
    frequency?: FrequencyFor<MonthFrequencyType>; // default 1
  })
  | (ChartBase & {
    periodType: "year";
    period?: YearPeriod; // default 1
    frequencyType?: YearFrequencyType; // default "monthly"
    frequency?: FrequencyFor<YearFrequencyType>; // default 1
  })
  | (ChartBase & {
    periodType: "ytd";
    period?: YtdPeriod; // default 1
    frequencyType?: YtdFrequencyType; // default "weekly"
    frequency?: FrequencyFor<YtdFrequencyType>; // default 1
  });


// OPTIONS **************************************************************************************
type OptionStrategy = 'SINGLE' | 'ANALYTICAL' | 'COVERED' | 'VERTICAL' | 'CALENDAR' | 'STRANGLE' | 'STRADDLE' | 'BUTTERFLY' | 'CONDOR' | 'DIAGONAL' | 'COLLAR' | 'ROLL';
type AssetType = 'BOND' | 'EQUITY' | 'FOREX' | 'FUTURE' | 'FUTURE_OPTION' | 'INDEX' | 'MUTUAL_FUND' | 'OPTION';
export type OptionChainReq = {
  /** Ticker symbol */
  symbol: string;

  /** Contract type  */
  contractType?: 'CALL' | 'PUT' | 'ALL';

  /** Number of strikes from underlying to return  */
  strikeCount?: number;

  /** Provide the underlying in the return */
  includeUnderlyingQuote?: boolean;

  strategy?: OptionStrategy;

  /** Strike interval for spread strategy chains (see strategy param) */
  interval?: number;

  /** Strike Price */
  strike?: number;

  /** Return In-the-money, out-of-the-money, or not-the-money */
  range?: 'ITM' | 'OTM' | 'NTM' | 'ATM';

  /** From date YYYY-MM-DD */
  fromDate?: ISODate;

  /** To date YYYY-MM-DD */
  toDate?: ISODate;

  /** Volatility to use in calculations. Applies only to ANALYTICAL strategy chains */
  volatility?: number;

  /** Underlying price to use in calculations. Applies only to ANALYTICAL strategy chains */
  underlyingPrice?: number;

  /** Interest rate to use in calculations. Applies only to ANALYTICAL strategy chains */
  interestRate?: number;

  /** Number of days to expiration to use in calculations. Applies only to ANALYTICAL strategy chains */
  daysToExpiration?: number;

  /** Expiration month */
  expMonth?: 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY' | 'JUN' | 'JUL' | 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC' | 'ALL';

  /** Option type */
  optionType?: string;

  /** Applicable only if its retail token, entitlement of client PP-PayingPro, NP-NonPro  */
  entitlement?: 'PN' | 'NP' | 'PP';
};

// Option return *************************************************************************

// Example: "2026-02-09:7"
export type ExpirationKey = `${number}-${number}-${number}:${number}`;

// Example keys from API are often "630", "630.0", "630.000" etc.
// Keep it a string, but document intent.
export type StrikeKey = string;

// The value at a strike is usually an array, even if it contains 1 item.
// (TD/Schwab option chains follow this.)
export type StrikeMap<TQuote> = Record<StrikeKey, TQuote[]>;

// callExpDateMap / putExpDateMap
export type ExpDateMap<TQuote> = Record<ExpirationKey, StrikeMap<TQuote>>;

export type OptionSide = 'call' | 'put';
export type OptionSideMaps<TQuote> = {
  callExpDateMap: ExpDateMap<TQuote>;
  putExpDateMap: ExpDateMap<TQuote>;
};

export type GetOptionChainRtn = Omit<GetOptionChainRtnHead, 'callExpDateMap'> &
  OptionSideMaps<OptionQuote>;

type GetOptionChainRtnHead = {
  symbol: string;
  status: string;
  underlying: any;
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
  putCall: 'CALL' | 'PUT';
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
  tradeTimeInLong: number; // epoch ms
  quoteTimeInLong: number; // epoch ms
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
  expirationDate: string; // ISO string
  daysToExpiration: number;
  expirationType: 'W' | 'M' | 'Q' | 'R'; // weekly, monthly, quarterly, regular (extend if needed)
  lastTradingDay: number; // epoch ms
  multiplier: number;
  settlementType: 'P' | 'C'; // physical / cash
  deliverableNote: string;
  markChange: number;
  markPercentChange: number;
  optionRoot: string;
  exerciseType: 'A' | 'E'; // American / European
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


// Option expiration *********************************************************************
export type OptionExpirationReq = {
  symbol: string;
};


export type OptionExpirationRtn = {
  /** Date of expiration - YYYY-MM-DD */
  expirationDate: ISODate;

  /** Days till expiration */
  daysToExpiration: number;

  /** M=End Of Month, W=Weekly (Fridays), S=3rd Friday of the month,
   *  Q=Quarterly (last business day of the quarter month MAR/JUN/SEP/DEC)  */
  expirationType: 'M' | 'Q' | 'S' | 'W';

  /** AM / PM */
  settlementType: 'A' | 'P';

  /** Ticker of the underlying */
  optionRoots: string,
  standard: boolean;
};

export type GetAtmOptionReq = {
  /** Underlying symbol */
  symbol: string;

  /** Look-back window, where [nearDate, farDate] */
  window: [number, number];
};

// QUOTE **************************************************************************************
type Fields = 'quote' | 'fundamental';

export type GetQuoteReq = {
  /** Comma delineated list of string(s) to look up*/
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
  '52WeekHigh': number;
  '52WeekLow': number;
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
  lastSize: number,
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
  securityStatus: string,
  totalVolume: number,
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

type Greeks = 'delta' | 'gamma' | 'theta' | 'vega' | 'rho' | 'iv' | 'absDelta';

export type AtmOptionRtn = {
  put_call: 'PUT' | 'CALL';
  day_of_week: 'SUN' | 'MON' | 'TUE' | 'WED' | 'THR' | 'FRI' | 'SAT';
  underlying: string;
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
  put_call: 'PUT' | 'CALL';
  underlying: string;
  symbol: string;
  dte: number;
  day_of_expiry: 'SUN' | 'MON' | 'TUE' | 'WED' | 'THR' | 'FRI' | 'SAT';
  theta: number;
  strike_price: number;
  gamma: number;
  volatility: number;
  vega: number;
  delta: number;
  rho: number;
};

export type GreekFilterReq = [
  symbol: string,
  window: [number, number],
  greek: Partial<Record<Greeks, [number, number]>>,
  side?: 'CALL' | 'PUT' | 'BOTH',
  strikeCount?: number,
];

export type GetMarketDataConfig = ChartRequest | OptionChainReq | OptionExpirationReq | GetQuoteReq;