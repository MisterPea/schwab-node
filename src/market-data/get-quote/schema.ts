import * as z from 'zod';

export const GetQuoteSchema = z.object({
  symbols: z.string(),
  fields: z.union([
    z.literal('quote'),
    z.literal('fundamental'),
    z.literal('fundamental, quote'),
    z.literal('quote, fundamental'),
  ]).optional(),
  indicative: z.boolean().optional()
});

// Helpers
const zEpochMs = z.number().int().nonnegative(); // Schwab-style epoch millis
const zNumber = z.number(); // keep loose; prices can be 0, etc.
const zInt = z.number().int();

/**
 * Sub-objects (optional keys on the symbol object)
 */
export const ExtendedSchema = z.object({
  askPrice: zNumber.optional(),
  askSize: zInt.optional(),
  bidPrice: zNumber.optional(),
  bidSize: zInt.optional(),
  lastPrice: zNumber.optional(),
  lastSize: zInt.optional(),
  mark: zNumber.optional(),
  quoteTime: zEpochMs.optional(),
  totalVolume: zInt.optional(),
  tradeTime: zEpochMs,
});

export const FundamentalSchema = z.object({
  avg10DaysVolume: zInt,
  avg1YearVolume: zInt,
  divAmount: zNumber,
  divFreq: zInt,
  divPayAmount: zNumber,
  divYield: zNumber,
  eps: zNumber,
  fundLeverageFactor: zNumber,
  lastEarningsDate: z.iso.datetime({ offset: true }).optional(), // e.g. 2026-02-05T00:00:00Z
  peRatio: zNumber,
  sharesOutstanding: z.number().optional(),
});

export const QuoteSchema = z.object({
  "52WeekHigh": zNumber.optional(),
  "52WeekLow": zNumber.optional(),

  askMICId: z.string().optional(),
  askPrice: zNumber.optional(),
  askSize: zInt.optional(),
  askTime: zEpochMs.optional(),

  bidMICId: z.string().optional(),
  bidPrice: zNumber.optional(),
  bidSize: zInt.optional(),
  bidTime: zEpochMs.optional(),

  closePrice: zNumber,
  highPrice: zNumber.optional(),
  lowPrice: zNumber.optional(),
  openPrice: zNumber.optional(),

  lastMICId: z.string().optional(),
  lastPrice: zNumber,
  lastSize: zInt.optional(),

  mark: zNumber.optional(),
  markChange: zNumber.optional(),
  markPercentChange: zNumber.optional(),

  netChange: zNumber,
  netPercentChange: zNumber.optional(),

  postMarketChange: zNumber.optional(),
  postMarketPercentChange: zNumber.optional(),

  quoteTime: zEpochMs.optional(),
  securityStatus: z.string(),
  totalVolume: zInt.optional(),
  tradeTime: zEpochMs,
});

export const ReferenceSchema = z.object({
  cusip: z.string().optional(),
  description: z.string(),
  exchange: z.string(),
  exchangeName: z.string(),
  isHardToBorrow: z.boolean().optional(),
  isShortable: z.boolean().optional(),
  htbQuantity: zInt.optional(),
  htbRate: zNumber.optional(),
});

export const RegularSchema = z.object({
  regularMarketLastPrice: zNumber,
  regularMarketLastSize: zInt,
  regularMarketNetChange: zNumber,
  regularMarketPercentChange: zNumber,
  regularMarketTradeTime: zEpochMs,
});

/**
 * The per-symbol payload (always has the base fields; may include the optional sections)
 */
export const GetQuoteEnvelopeSchema = z
  .object({
    assetMainType: z.string().optional(),
    assetSubType: z.string().optional(), // e.g. "COE"
    quoteType: z.string().optional(), // e.g. "NBBO"
    realtime: z.boolean().optional(),
    ssid: zInt.optional(),
    symbol: z.string().optional(), // e.g. "AAPL"

    // Optional sections
    extended: ExtendedSchema.optional(),
    fundamental: FundamentalSchema.optional(),
    quote: QuoteSchema.optional(),
    reference: ReferenceSchema.optional(),
    regular: RegularSchema.optional(),
  })
  // If the API adds new keys later, this prevents schema breakage:
  .loose();

export const GetQuotesResponseSchema = z.record(z.string(), GetQuoteEnvelopeSchema);

export type GetQuoteRequest = z.infer<typeof GetQuoteSchema>;
export type QuoteEnvelope = z.infer<typeof GetQuoteEnvelopeSchema>;
export type GetQuotesResponse = z.infer<typeof GetQuotesResponseSchema>;


