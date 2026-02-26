import * as z from 'zod';

export const OptionStrategySchema = z.enum([
  'SINGLE',
  'ANALYTICAL',
  'COVERED',
  'VERTICAL',
  'CALENDAR',
  'STRANGLE',
  'STRADDLE',
  'BUTTERFLY',
  'CONDOR',
  'DIAGONAL',
  'COLLAR',
  'ROLL',
]);

export const AssetTypeSchema = z.enum([
  'BOND',
  'EQUITY',
  'FOREX',
  'FUTURE',
  'FUTURE_OPTION',
  'INDEX',
  'MUTUAL_FUND',
  'OPTION',
]);

export const ContractTypeSchema = z.enum(['CALL', 'PUT', 'ALL']);
export const RangeSchema = z.enum(['ITM', 'OTM', 'NTM', 'ATM']);

export const ExpMonthSchema = z.enum([
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
  'ALL',
]);

export const EntitlementSchema = z.enum(['PN', 'NP', 'PP']);

export const ISODateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date format YYYY-MM-DD');

export const OptionChainRequestSchema = z.object({
  symbol: z.string().min(1),
  contractType: ContractTypeSchema.optional(),
  strikeCount: z.number().int().nonnegative().optional(),
  includeUnderlyingQuote: z.boolean().optional(),
  strategy: OptionStrategySchema.optional(),
  interval: z.number().optional(),
  strike: z.number().optional(),
  range: RangeSchema.optional(),
  fromDate: ISODateSchema.optional(),
  toDate: ISODateSchema.optional(),
  volatility: z.number().optional(),
  underlyingPrice: z.number().optional(),
  interestRate: z.number().optional(),
  daysToExpiration: z.number().int().nonnegative().optional(),
  expMonth: ExpMonthSchema.optional(),
  optionType: z.string().optional(),
  entitlement: EntitlementSchema.optional(),
});

export type OptionChainRequest = z.infer<typeof OptionChainRequestSchema>;

export const OptionDeliverableSchema = z
  .object({
    symbol: z.string().optional(),
    deliverableUnits: z.number().optional(),
    assetType: z.string().optional(),
  })
  .catchall(z.unknown());

export type OptionDeliverable = z.infer<typeof OptionDeliverableSchema>;

export const OptionQuoteSchema = z.object({
  putCall: z.enum(['CALL', 'PUT']),
  symbol: z.string(),
  description: z.string(),
  exchangeName: z.string(),
  bid: z.number(),
  ask: z.number(),
  last: z.number(),
  mark: z.number(),
  bidSize: z.number(),
  askSize: z.number(),
  bidAskSize: z.string(),
  lastSize: z.number(),
  highPrice: z.number(),
  lowPrice: z.number(),
  openPrice: z.number(),
  closePrice: z.number(),
  totalVolume: z.number(),
  tradeTimeInLong: z.number(),
  quoteTimeInLong: z.number(),
  netChange: z.number(),
  percentChange: z.number(),
  volatility: z.number(),
  delta: z.number(),
  gamma: z.number(),
  theta: z.number(),
  vega: z.number(),
  rho: z.number(),
  openInterest: z.number(),
  timeValue: z.number(),
  intrinsicValue: z.number(),
  extrinsicValue: z.number(),
  theoreticalOptionValue: z.number(),
  theoreticalVolatility: z.number(),
  optionDeliverablesList: z.array(OptionDeliverableSchema),
  strikePrice: z.number(),
  expirationDate: z.string(),
  daysToExpiration: z.number(),
  expirationType: z.enum(['W', 'M', 'Q', 'R']),
  lastTradingDay: z.number(),
  multiplier: z.number(),
  settlementType: z.enum(['P', 'C']),
  deliverableNote: z.string(),
  markChange: z.number(),
  markPercentChange: z.number(),
  optionRoot: z.string(),
  exerciseType: z.enum(['A', 'E']),
  high52Week: z.number(),
  low52Week: z.number(),
  inTheMoney: z.boolean(),
  mini: z.boolean(),
  pennyPilot: z.boolean(),
  nonStandard: z.boolean(),
});

export type OptionQuote = z.infer<typeof OptionQuoteSchema>;

export const ExpDateMapOptionQuoteSchema = z.record(
  z.string(),
  z.record(z.string(), z.array(OptionQuoteSchema)),
);

export const GetOptionChainReturnSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  underlying: z.string().or(z.null()),
  strategy: OptionStrategySchema,
  interval: z.number(),
  isDelayed: z.boolean(),
  isIndex: z.boolean(),
  interestRate: z.number(),
  underlyingPrice: z.number(),
  volatility: z.number(),
  daysToExpiration: z.number(),
  dividendYield: z.number(),
  numberOfContracts: z.number(),
  assetMainType: AssetTypeSchema,
  assetSubType: z.string(),
  isChainTruncated: z.boolean(),
  callExpDateMap: ExpDateMapOptionQuoteSchema,
  putExpDateMap: ExpDateMapOptionQuoteSchema,
});

export type GetOptionChainReturn = z.infer<typeof GetOptionChainReturnSchema>;
