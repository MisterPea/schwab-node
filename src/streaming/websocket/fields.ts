import type { StreamService } from "./schema.js";

type ServiceFieldMap = Record<string, string>;

function createInverseFieldMap<TFieldMap extends ServiceFieldMap>(
  fieldMap: TFieldMap,
): {
  readonly [FieldName in TFieldMap[keyof TFieldMap]]: Extract<
    keyof TFieldMap,
    string
  >;
} {
  return Object.fromEntries(
    Object.entries(fieldMap).map(([fieldId, fieldName]) => [fieldName, fieldId]),
  ) as {
    readonly [FieldName in TFieldMap[keyof TFieldMap]]: Extract<
      keyof TFieldMap,
      string
    >;
  };
}

function normalizeList(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const nextValue = value.trim();
    if (!nextValue || seen.has(nextValue)) continue;
    seen.add(nextValue);
    normalized.push(nextValue);
  }

  return normalized;
}

function resolveFieldNamesFromMap<TFieldMap extends ServiceFieldMap>(
  service: StreamService,
  fields: string[],
  fieldIdsByName: {
    readonly [FieldName in TFieldMap[keyof TFieldMap]]: Extract<
      keyof TFieldMap,
      string
    >;
  },
): Array<Extract<keyof TFieldMap, string>> {
  const normalizedFields = normalizeList(fields);

  return normalizedFields.map((fieldName) => {
    const fieldId = fieldIdsByName[fieldName as TFieldMap[keyof TFieldMap]];

    if (!fieldId) {
      throw new Error(`Unknown ${service} field: ${fieldName}`);
    }

    return fieldId;
  }) as Array<Extract<keyof TFieldMap, string>>;
}

function resolveFieldIdsFromMap<TFieldMap extends ServiceFieldMap>(
  service: StreamService,
  fieldIds: string[],
  fieldMap: TFieldMap,
): Array<TFieldMap[keyof TFieldMap]> {
  const normalizedFieldIds = normalizeList(fieldIds);

  return normalizedFieldIds.map((fieldId) => {
    const fieldName = fieldMap[fieldId as keyof TFieldMap];

    if (!fieldName) {
      throw new Error(`Unknown ${service} field id: ${fieldId}`);
    }

    return fieldName;
  }) as Array<TFieldMap[keyof TFieldMap]>;
}

export const LEVELONE_EQUITIES_FIELDS = {
  "0": "symbol",
  "1": "bidPrice",
  "2": "askPrice",
  "3": "lastPrice",
  "4": "bidSize",
  "5": "askSize",
  "6": "askId",
  "7": "bidId",
  "8": "totalVolume",
  "9": "lastSize",
  "10": "highPrice",
  "11": "lowPrice",
  "12": "closePrice",
  "13": "exchangeId",
  "14": "marginable",
  "15": "description",
  "16": "lastId",
  "17": "openPrice",
  "18": "netChange",
  "19": "fiftyTwoWeekHigh",
  "20": "fiftyTwoWeekLow",
  "21": "peRatio",
  "22": "annualDividendAmount",
  "23": "dividendYield",
  "24": "nav",
  "25": "exchangeName",
  "26": "dividendDate",
  "27": "regularMarketQuote",
  "28": "regularMarketTrade",
  "29": "regularMarketLastPrice",
  "30": "regularMarketLastSize",
  "31": "regularMarketNetChange",
  "32": "securityStatus",
  "33": "markPrice",
  "34": "quoteTime",
  "35": "tradeTime",
  "36": "regularMarketTradeTime",
  "37": "bidTime",
  "38": "askTime",
  "39": "askMicId",
  "40": "bidMicId",
  "41": "lastMicId",
  "42": "netPercentChange",
  "43": "regularMarketPercentChange",
  "44": "markPriceNetChange",
  "45": "markPricePercentChange",
  "46": "hardToBorrowQuantity",
  "47": "hardToBorrowRate",
  "48": "hardToBorrow",
  "49": "shortable",
  "50": "postMarketNetChange",
  "51": "postMarketPercentChange",
} as const;

export const LEVELONE_OPTIONS_FIELDS = {
  "0": "symbol",
  "1": "description",
  "2": "bidPrice",
  "3": "askPrice",
  "4": "lastPrice",
  "5": "highPrice",
  "6": "lowPrice",
  "7": "closePrice",
  "8": "totalVolume",
  "9": "openInterest",
  "10": "volatility",
  "11": "moneyIntrinsicValue",
  "12": "expirationYear",
  "13": "multiplier",
  "14": "digits",
  "15": "openPrice",
  "16": "bidSize",
  "17": "askSize",
  "18": "lastSize",
  "19": "netChange",
  "20": "strikePrice",
  "21": "contractType",
  "22": "underlying",
  "23": "expirationMonth",
  "24": "deliverables",
  "25": "timeValue",
  "26": "expirationDay",
  "27": "daysToExpiration",
  "28": "delta",
  "29": "gamma",
  "30": "theta",
  "31": "vega",
  "32": "rho",
  "33": "securityStatus",
  "34": "theoreticalOptionValue",
  "35": "underlyingPrice",
  "36": "uvExpirationType",
  "37": "markPrice",
  "38": "quoteTime",
  "39": "tradeTime",
  "40": "exchange",
  "41": "exchangeName",
  "42": "lastTradingDay",
  "43": "settlementType",
  "44": "netPercentChange",
  "45": "markPriceNetChange",
  "46": "markPricePercentChange",
  "47": "impliedYield",
  "48": "isPennyPilot",
  "49": "optionRoot",
  "50": "fiftyTwoWeekHigh",
  "51": "fiftyTwoWeekLow",
  "52": "indicativeAskPrice",
  "53": "indicativeBidPrice",
  "54": "indicativeQuoteTime",
  "55": "exerciseType",
} as const;

export const LEVELONE_FUTURES_FIELDS = {
  "0": "symbol",
  "1": "bidPrice",
  "2": "askPrice",
  "3": "lastPrice",
  "4": "bidSize",
  "5": "askSize",
  "6": "bidId",
  "7": "askId",
  "8": "totalVolume",
  "9": "lastSize",
  "10": "quoteTime",
  "11": "tradeTime",
  "12": "highPrice",
  "13": "lowPrice",
  "14": "closePrice",
  "15": "exchangeId",
  "16": "description",
  "17": "lastId",
  "18": "openPrice",
  "19": "netChange",
  "20": "futurePercentChange",
  "21": "exchangeName",
  "22": "securityStatus",
  "23": "openInterest",
  "24": "mark",
  "25": "tick",
  "26": "tickAmount",
  "27": "product",
  "28": "futurePriceFormat",
  "29": "futureTradingHours",
  "30": "futureIsTradable",
  "31": "futureMultiplier",
  "32": "futureIsActive",
  "33": "futureSettlementPrice",
  "34": "futureActiveSymbol",
  "35": "futureExpirationDate",
  "36": "expirationStyle",
  "37": "askTime",
  "38": "bidTime",
  "39": "quotedInSession",
  "40": "settlementDate",
} as const;

export const LEVELONE_FUTURES_OPTIONS_FIELDS = {
  "0": "symbol",
  "1": "bidPrice",
  "2": "askPrice",
  "3": "lastPrice",
  "4": "bidSize",
  "5": "askSize",
  "6": "bidId",
  "7": "askId",
  "8": "totalVolume",
  "9": "lastSize",
  "10": "quoteTime",
  "11": "tradeTime",
  "12": "highPrice",
  "13": "lowPrice",
  "14": "closePrice",
  "15": "lastId",
  "16": "description",
  "17": "openPrice",
  "18": "openInterest",
  "19": "mark",
  "20": "tick",
  "21": "tickAmount",
  "22": "futureMultiplier",
  "23": "futureSettlementPrice",
  "24": "underlyingSymbol",
  "25": "strikePrice",
  "26": "futureExpirationDate",
  "27": "expirationStyle",
  "28": "contractType",
  "29": "securityStatus",
  "30": "exchange",
  "31": "exchangeName",
} as const;

export const LEVELONE_FOREX_FIELDS = {
  "0": "symbol",
  "1": "bidPrice",
  "2": "askPrice",
  "3": "lastPrice",
  "4": "bidSize",
  "5": "askSize",
  "6": "totalVolume",
  "7": "lastSize",
  "8": "quoteTime",
  "9": "tradeTime",
  "10": "highPrice",
  "11": "lowPrice",
  "12": "closePrice",
  "13": "exchange",
  "14": "description",
  "15": "openPrice",
  "16": "netChange",
  "17": "percentChange",
  "18": "exchangeName",
  "19": "digits",
  "20": "securityStatus",
  "21": "tick",
  "22": "tickAmount",
  "23": "product",
  "24": "tradingHours",
  "25": "isTradable",
  "26": "marketMaker",
  "27": "fiftyTwoWeekHigh",
  "28": "fiftyTwoWeekLow",
  "29": "mark",
} as const;

export const BOOK_FIELDS = {
  "0": "symbol",
  "1": "marketSnapshotTime",
  "2": "bidSideLevels",
  "3": "askSideLevels",
} as const;

export const BOOK_PRICE_LEVEL_FIELDS = {
  "0": "price",
  "1": "aggregateSize",
  "2": "marketMakerCount",
  "3": "marketMakers",
} as const;

export const BOOK_MARKET_MAKER_FIELDS = {
  "0": "marketMakerId",
  "1": "size",
  "2": "quoteTime",
} as const;

export const CHART_EQUITY_FIELDS = {
  "0": "symbol",
  "1": "openPrice",
  "2": "highPrice",
  "3": "lowPrice",
  "4": "closePrice",
  "5": "volume",
  "6": "sequence",
  "7": "chartTime",
  "8": "chartDay",
} as const;

export const CHART_FUTURES_FIELDS = {
  "0": "symbol",
  "1": "chartTime",
  "2": "openPrice",
  "3": "highPrice",
  "4": "lowPrice",
  "5": "closePrice",
  "6": "volume",
} as const;

export const SCREENER_FIELDS = {
  "0": "symbol",
  "1": "timestamp",
  "2": "sortField",
  "3": "frequency",
  "4": "items",
} as const;

export const ACCT_ACTIVITY_FIELDS = {
  "0": "subscriptionKey",
} as const;

export type LevelOneEquitiesFieldId = keyof typeof LEVELONE_EQUITIES_FIELDS;
export type LevelOneEquitiesFieldName =
  (typeof LEVELONE_EQUITIES_FIELDS)[LevelOneEquitiesFieldId];
export type LevelOneOptionsFieldId = keyof typeof LEVELONE_OPTIONS_FIELDS;
export type LevelOneOptionsFieldName =
  (typeof LEVELONE_OPTIONS_FIELDS)[LevelOneOptionsFieldId];
export type LevelOneFuturesFieldId = keyof typeof LEVELONE_FUTURES_FIELDS;
export type LevelOneFuturesFieldName =
  (typeof LEVELONE_FUTURES_FIELDS)[LevelOneFuturesFieldId];
export type LevelOneFuturesOptionsFieldId =
  keyof typeof LEVELONE_FUTURES_OPTIONS_FIELDS;
export type LevelOneFuturesOptionsFieldName =
  (typeof LEVELONE_FUTURES_OPTIONS_FIELDS)[LevelOneFuturesOptionsFieldId];
export type LevelOneForexFieldId = keyof typeof LEVELONE_FOREX_FIELDS;
export type LevelOneForexFieldName =
  (typeof LEVELONE_FOREX_FIELDS)[LevelOneForexFieldId];
export type BookFieldId = keyof typeof BOOK_FIELDS;
export type BookFieldName = (typeof BOOK_FIELDS)[BookFieldId];
export type BookPriceLevelFieldId = keyof typeof BOOK_PRICE_LEVEL_FIELDS;
export type BookPriceLevelFieldName =
  (typeof BOOK_PRICE_LEVEL_FIELDS)[BookPriceLevelFieldId];
export type BookMarketMakerFieldId = keyof typeof BOOK_MARKET_MAKER_FIELDS;
export type BookMarketMakerFieldName =
  (typeof BOOK_MARKET_MAKER_FIELDS)[BookMarketMakerFieldId];
export type ChartEquityFieldId = keyof typeof CHART_EQUITY_FIELDS;
export type ChartEquityFieldName =
  (typeof CHART_EQUITY_FIELDS)[ChartEquityFieldId];
export type ChartFuturesFieldId = keyof typeof CHART_FUTURES_FIELDS;
export type ChartFuturesFieldName =
  (typeof CHART_FUTURES_FIELDS)[ChartFuturesFieldId];
export type ScreenerFieldId = keyof typeof SCREENER_FIELDS;
export type ScreenerFieldName = (typeof SCREENER_FIELDS)[ScreenerFieldId];
export type AcctActivityFieldId = keyof typeof ACCT_ACTIVITY_FIELDS;
export type AcctActivityFieldName =
  (typeof ACCT_ACTIVITY_FIELDS)[AcctActivityFieldId];

export type LevelOneEquitiesSubscriptionInput = {
  keys: string[];
  fields: LevelOneEquitiesFieldName[];
};

export type LevelOneEquitiesViewInput = {
  fields: LevelOneEquitiesFieldName[];
};

export type LevelOneOptionsSubscriptionInput = {
  keys: string[];
  fields: LevelOneOptionsFieldName[];
};

export type LevelOneOptionsViewInput = {
  fields: LevelOneOptionsFieldName[];
};

export type LevelOneFuturesSubscriptionInput = {
  keys: string[];
  fields: LevelOneFuturesFieldName[];
};

export type LevelOneFuturesViewInput = {
  fields: LevelOneFuturesFieldName[];
};

export type LevelOneFuturesOptionsSubscriptionInput = {
  keys: string[];
  fields: LevelOneFuturesOptionsFieldName[];
};

export type LevelOneFuturesOptionsViewInput = {
  fields: LevelOneFuturesOptionsFieldName[];
};

export type LevelOneForexSubscriptionInput = {
  keys: string[];
  fields: LevelOneForexFieldName[];
};

export type LevelOneForexViewInput = {
  fields: LevelOneForexFieldName[];
};

export type L2NyseBookSubscriptionInput = {
  keys: string[];
  fields: BookFieldName[];
};

export type L2NyseBookViewInput = {
  fields: BookFieldName[];
};

export type L2NasdaqBookSubscriptionInput = {
  keys: string[];
  fields: BookFieldName[];
};

export type L2NasdaqBookViewInput = {
  fields: BookFieldName[];
};

export type L2OptionsBookSubscriptionInput = {
  keys: string[];
  fields: BookFieldName[];
};

export type L2OptionsBookViewInput = {
  fields: BookFieldName[];
};

export type ChartEquitySubscriptionInput = {
  keys: string[];
  fields: ChartEquityFieldName[];
};

export type ChartEquityViewInput = {
  fields: ChartEquityFieldName[];
};

export type ChartFuturesSubscriptionInput = {
  keys: string[];
  fields: ChartFuturesFieldName[];
};

export type ChartFuturesViewInput = {
  fields: ChartFuturesFieldName[];
};

export type ScreenerEquitySubscriptionInput = {
  keys: string[];
  fields: ScreenerFieldName[];
};

export type ScreenerEquityViewInput = {
  fields: ScreenerFieldName[];
};

export type ScreenerOptionSubscriptionInput = {
  keys: string[];
  fields: ScreenerFieldName[];
};

export type ScreenerOptionViewInput = {
  fields: ScreenerFieldName[];
};

export type AcctActivitySubscriptionInput = {
  keys: string[];
  fields: AcctActivityFieldName[];
};

export const LEVELONE_EQUITIES_FIELD_IDS_BY_NAME =
  createInverseFieldMap(LEVELONE_EQUITIES_FIELDS);
export const LEVELONE_OPTIONS_FIELD_IDS_BY_NAME =
  createInverseFieldMap(LEVELONE_OPTIONS_FIELDS);
export const LEVELONE_FUTURES_FIELD_IDS_BY_NAME =
  createInverseFieldMap(LEVELONE_FUTURES_FIELDS);
export const LEVELONE_FUTURES_OPTIONS_FIELD_IDS_BY_NAME =
  createInverseFieldMap(LEVELONE_FUTURES_OPTIONS_FIELDS);
export const LEVELONE_FOREX_FIELD_IDS_BY_NAME =
  createInverseFieldMap(LEVELONE_FOREX_FIELDS);
export const BOOK_FIELD_IDS_BY_NAME = createInverseFieldMap(BOOK_FIELDS);
export const BOOK_PRICE_LEVEL_FIELD_IDS_BY_NAME =
  createInverseFieldMap(BOOK_PRICE_LEVEL_FIELDS);
export const BOOK_MARKET_MAKER_FIELD_IDS_BY_NAME =
  createInverseFieldMap(BOOK_MARKET_MAKER_FIELDS);
export const CHART_EQUITY_FIELD_IDS_BY_NAME =
  createInverseFieldMap(CHART_EQUITY_FIELDS);
export const CHART_FUTURES_FIELD_IDS_BY_NAME =
  createInverseFieldMap(CHART_FUTURES_FIELDS);
export const SCREENER_FIELD_IDS_BY_NAME =
  createInverseFieldMap(SCREENER_FIELDS);
export const ACCT_ACTIVITY_FIELD_IDS_BY_NAME =
  createInverseFieldMap(ACCT_ACTIVITY_FIELDS);

export function resolveLevelOneEquitiesFieldNames(
  fields: string[],
): LevelOneEquitiesFieldId[] {
  return resolveFieldNamesFromMap(
    "LEVELONE_EQUITIES",
    fields,
    LEVELONE_EQUITIES_FIELD_IDS_BY_NAME,
  ) as LevelOneEquitiesFieldId[];
}

export function resolveLevelOneEquitiesFieldIds(
  fieldIds: string[],
): LevelOneEquitiesFieldName[] {
  return resolveFieldIdsFromMap(
    "LEVELONE_EQUITIES",
    fieldIds,
    LEVELONE_EQUITIES_FIELDS,
  );
}

export function resolveLevelOneOptionsFieldNames(
  fields: string[],
): LevelOneOptionsFieldId[] {
  return resolveFieldNamesFromMap(
    "LEVELONE_OPTIONS",
    fields,
    LEVELONE_OPTIONS_FIELD_IDS_BY_NAME,
  ) as LevelOneOptionsFieldId[];
}

export function resolveLevelOneOptionsFieldIds(
  fieldIds: string[],
): LevelOneOptionsFieldName[] {
  return resolveFieldIdsFromMap(
    "LEVELONE_OPTIONS",
    fieldIds,
    LEVELONE_OPTIONS_FIELDS,
  );
}

export function resolveLevelOneFuturesFieldNames(
  fields: string[],
): LevelOneFuturesFieldId[] {
  return resolveFieldNamesFromMap(
    "LEVELONE_FUTURES",
    fields,
    LEVELONE_FUTURES_FIELD_IDS_BY_NAME,
  ) as LevelOneFuturesFieldId[];
}

export function resolveLevelOneFuturesFieldIds(
  fieldIds: string[],
): LevelOneFuturesFieldName[] {
  return resolveFieldIdsFromMap(
    "LEVELONE_FUTURES",
    fieldIds,
    LEVELONE_FUTURES_FIELDS,
  );
}

export function resolveLevelOneFuturesOptionsFieldNames(
  fields: string[],
): LevelOneFuturesOptionsFieldId[] {
  return resolveFieldNamesFromMap(
    "LEVELONE_FUTURES_OPTIONS",
    fields,
    LEVELONE_FUTURES_OPTIONS_FIELD_IDS_BY_NAME,
  ) as LevelOneFuturesOptionsFieldId[];
}

export function resolveLevelOneFuturesOptionsFieldIds(
  fieldIds: string[],
): LevelOneFuturesOptionsFieldName[] {
  return resolveFieldIdsFromMap(
    "LEVELONE_FUTURES_OPTIONS",
    fieldIds,
    LEVELONE_FUTURES_OPTIONS_FIELDS,
  );
}

export function resolveLevelOneForexFieldNames(
  fields: string[],
): LevelOneForexFieldId[] {
  return resolveFieldNamesFromMap(
    "LEVELONE_FOREX",
    fields,
    LEVELONE_FOREX_FIELD_IDS_BY_NAME,
  ) as LevelOneForexFieldId[];
}

export function resolveLevelOneForexFieldIds(
  fieldIds: string[],
): LevelOneForexFieldName[] {
  return resolveFieldIdsFromMap(
    "LEVELONE_FOREX",
    fieldIds,
    LEVELONE_FOREX_FIELDS,
  );
}

export function resolveBookFieldNames(fields: string[]): BookFieldId[] {
  return resolveFieldNamesFromMap(
    "NYSE_BOOK",
    fields,
    BOOK_FIELD_IDS_BY_NAME,
  ) as BookFieldId[];
}

export function resolveBookFieldIds(fieldIds: string[]): BookFieldName[] {
  return resolveFieldIdsFromMap("NYSE_BOOK", fieldIds, BOOK_FIELDS);
}

export function resolveBookPriceLevelFieldIds(
  fieldIds: string[],
): BookPriceLevelFieldName[] {
  return resolveFieldIdsFromMap("NYSE_BOOK", fieldIds, BOOK_PRICE_LEVEL_FIELDS);
}

export function resolveBookMarketMakerFieldIds(
  fieldIds: string[],
): BookMarketMakerFieldName[] {
  return resolveFieldIdsFromMap(
    "NYSE_BOOK",
    fieldIds,
    BOOK_MARKET_MAKER_FIELDS,
  );
}

export function resolveChartEquityFieldNames(
  fields: string[],
): ChartEquityFieldId[] {
  return resolveFieldNamesFromMap(
    "CHART_EQUITY",
    fields,
    CHART_EQUITY_FIELD_IDS_BY_NAME,
  ) as ChartEquityFieldId[];
}

export function resolveChartEquityFieldIds(
  fieldIds: string[],
): ChartEquityFieldName[] {
  return resolveFieldIdsFromMap("CHART_EQUITY", fieldIds, CHART_EQUITY_FIELDS);
}

export function resolveChartFuturesFieldNames(
  fields: string[],
): ChartFuturesFieldId[] {
  return resolveFieldNamesFromMap(
    "CHART_FUTURES",
    fields,
    CHART_FUTURES_FIELD_IDS_BY_NAME,
  ) as ChartFuturesFieldId[];
}

export function resolveChartFuturesFieldIds(
  fieldIds: string[],
): ChartFuturesFieldName[] {
  return resolveFieldIdsFromMap(
    "CHART_FUTURES",
    fieldIds,
    CHART_FUTURES_FIELDS,
  );
}

export function resolveScreenerFieldNames(fields: string[]): ScreenerFieldId[] {
  return resolveFieldNamesFromMap(
    "SCREENER_EQUITY",
    fields,
    SCREENER_FIELD_IDS_BY_NAME,
  ) as ScreenerFieldId[];
}

export function resolveScreenerFieldIds(
  fieldIds: string[],
): ScreenerFieldName[] {
  return resolveFieldIdsFromMap("SCREENER_EQUITY", fieldIds, SCREENER_FIELDS);
}

export function resolveAcctActivityFieldNames(
  fields: string[],
): AcctActivityFieldId[] {
  return resolveFieldNamesFromMap(
    "ACCT_ACTIVITY",
    fields,
    ACCT_ACTIVITY_FIELD_IDS_BY_NAME,
  ) as AcctActivityFieldId[];
}

export function resolveAcctActivityFieldIds(
  fieldIds: string[],
): AcctActivityFieldName[] {
  return resolveFieldIdsFromMap(
    "ACCT_ACTIVITY",
    fieldIds,
    ACCT_ACTIVITY_FIELDS,
  );
}

export function resolveFieldNames(
  service: StreamService,
  fields: string[],
): string[] {
  switch (service) {
    case "LEVELONE_EQUITIES":
      return resolveLevelOneEquitiesFieldNames(fields);
    case "LEVELONE_OPTIONS":
      return resolveLevelOneOptionsFieldNames(fields);
    case "LEVELONE_FUTURES":
      return resolveLevelOneFuturesFieldNames(fields);
    case "LEVELONE_FUTURES_OPTIONS":
      return resolveLevelOneFuturesOptionsFieldNames(fields);
    case "LEVELONE_FOREX":
      return resolveLevelOneForexFieldNames(fields);
    case "NYSE_BOOK":
    case "NASDAQ_BOOK":
    case "OPTIONS_BOOK":
      return resolveBookFieldNames(fields);
    case "CHART_EQUITY":
      return resolveChartEquityFieldNames(fields);
    case "CHART_FUTURES":
      return resolveChartFuturesFieldNames(fields);
    case "SCREENER_EQUITY":
    case "SCREENER_OPTION":
      return resolveScreenerFieldNames(fields);
    case "ACCT_ACTIVITY":
      return resolveAcctActivityFieldNames(fields);
    default:
      throw new Error(`No semantic field resolver available for ${service}`);
  }
}

export function resolveFieldIds(
  service: StreamService,
  fieldIds: string[],
): string[] {
  switch (service) {
    case "LEVELONE_EQUITIES":
      return resolveLevelOneEquitiesFieldIds(fieldIds);
    case "LEVELONE_OPTIONS":
      return resolveLevelOneOptionsFieldIds(fieldIds);
    case "LEVELONE_FUTURES":
      return resolveLevelOneFuturesFieldIds(fieldIds);
    case "LEVELONE_FUTURES_OPTIONS":
      return resolveLevelOneFuturesOptionsFieldIds(fieldIds);
    case "LEVELONE_FOREX":
      return resolveLevelOneForexFieldIds(fieldIds);
    case "NYSE_BOOK":
    case "NASDAQ_BOOK":
    case "OPTIONS_BOOK":
      return resolveBookFieldIds(fieldIds);
    case "CHART_EQUITY":
      return resolveChartEquityFieldIds(fieldIds);
    case "CHART_FUTURES":
      return resolveChartFuturesFieldIds(fieldIds);
    case "SCREENER_EQUITY":
    case "SCREENER_OPTION":
      return resolveScreenerFieldIds(fieldIds);
    case "ACCT_ACTIVITY":
      return resolveAcctActivityFieldIds(fieldIds);
    default:
      throw new Error(`No semantic field-id resolver available for ${service}`);
  }
}
