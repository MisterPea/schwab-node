import * as z from "zod";

// --- shared helpers ---
const Num = z.number(); // swap to z.coerce.number() if these arrive as strings
const Bool = z.boolean();

export const AccountTypeSchema = z.enum(["CASH", "MARGIN"]); // add others if you see them

export const InitialBalancesSchema = z.object({
  accruedInterest: Num,
  availableFundsNonMarginableTrade: Num,
  bondValue: Num,
  buyingPower: Num,
  cashBalance: Num,
  cashAvailableForTrading: Num,
  cashReceipts: Num,
  dayTradingBuyingPower: Num,
  dayTradingBuyingPowerCall: Num,
  dayTradingEquityCall: Num,
  equity: Num,
  equityPercentage: Num,
  liquidationValue: Num,
  longMarginValue: Num,
  longOptionMarketValue: Num,
  longStockValue: Num,
  maintenanceCall: Num,
  maintenanceRequirement: Num,
  margin: Num,
  marginEquity: Num,
  moneyMarketFund: Num,
  mutualFundValue: Num,
  regTCall: Num,
  shortMarginValue: Num,
  shortOptionMarketValue: Num,
  shortStockValue: Num,
  totalCash: Num,
  isInCall: Bool,
  pendingDeposits: Num,
  marginBalance: Num,
  shortBalance: Num,
  accountValue: Num,
});

export const CurrentBalancesSchema = z.object({
  accruedInterest: Num,
  cashBalance: Num,
  cashReceipts: Num,
  longOptionMarketValue: Num,
  liquidationValue: Num,
  longMarketValue: Num,
  moneyMarketFund: Num,
  savings: Num,
  shortMarketValue: Num,
  pendingDeposits: Num,
  mutualFundValue: Num,
  bondValue: Num,
  shortOptionMarketValue: Num,
  availableFunds: Num,
  availableFundsNonMarginableTrade: Num,
  buyingPower: Num,
  buyingPowerNonMarginableTrade: Num,
  dayTradingBuyingPower: Num,
  equity: Num,
  equityPercentage: Num,
  longMarginValue: Num,
  maintenanceCall: Num,
  maintenanceRequirement: Num,
  marginBalance: Num,
  regTCall: Num,
  shortBalance: Num,
  shortMarginValue: Num,
  sma: Num,
});

export const ProjectedBalancesSchema = z.object({
  availableFunds: Num,
  availableFundsNonMarginableTrade: Num,
  buyingPower: Num,
  dayTradingBuyingPower: Num,
  dayTradingBuyingPowerCall: Num,
  maintenanceCall: Num,
  regTCall: Num,
  isInCall: Bool,
  stockBuyingPower: Num,
});

export const PositionInstrumentSchema = z.object({
  assetType: z.string(), // EQUITY | OPTION | COLLECTIVE_INVESTMENT | ... — free-form to survive unseen types
  cusip: z.string().optional(),
  symbol: z.string(),
  description: z.string().optional(),
  netChange: Num.optional(),
  type: z.string().optional(),
  putCall: z.string().optional(), // OPTION only
  underlyingSymbol: z.string().optional(), // OPTION only
});

export const PositionSchema = z.object({
  shortQuantity: Num,
  longQuantity: Num,
  settledLongQuantity: Num.optional(),
  settledShortQuantity: Num.optional(),
  agedQuantity: Num.optional(),
  averagePrice: Num.optional(),
  averageLongPrice: Num.optional(),
  averageShortPrice: Num.optional(),
  taxLotAverageLongPrice: Num.optional(),
  taxLotAverageShortPrice: Num.optional(),
  marketValue: Num,
  maintenanceRequirement: Num.optional(),
  currentDayProfitLoss: Num.optional(),
  currentDayProfitLossPercentage: Num.optional(),
  currentDayCost: Num.optional(),
  longOpenProfitLoss: Num.optional(),
  shortOpenProfitLoss: Num.optional(),
  previousSessionLongQuantity: Num.optional(),
  previousSessionShortQuantity: Num.optional(),
  instrument: PositionInstrumentSchema,
});

export const SecuritiesAccountSchema = z.object({
  type: AccountTypeSchema,
  accountNumber: z.string(),
  roundTrips: z.number().int(),
  isDayTrader: Bool,
  isClosingOnlyRestricted: Bool,
  pfcbFlag: Bool,
  positions: z.array(PositionSchema).optional(), // present only with ?fields=positions
  initialBalances: InitialBalancesSchema,
  currentBalances: CurrentBalancesSchema,
  projectedBalances: ProjectedBalancesSchema,
});

export const AggregatedBalanceSchema = z.object({
  currentLiquidationValue: Num,
  liquidationValue: Num,
});

export const AccountResponseItemSchema = z.object({
  securitiesAccount: SecuritiesAccountSchema,
  aggregatedBalance: AggregatedBalanceSchema,
});

export const AccountsResponseSchema = z.array(AccountResponseItemSchema);
export type AccountsResponse = z.infer<typeof AccountsResponseSchema>;
export type Position = z.infer<typeof PositionSchema>;

export const GetAccountsRequestSchema = z
  .object({
    fields: z.enum(["positions"]).optional(),
  })
  .optional();
export type GetAccountsRequest = z.infer<typeof GetAccountsRequestSchema>;
