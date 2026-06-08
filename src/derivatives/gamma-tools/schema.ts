import * as z from "zod";

export const GammaExposureRequestSchema = z.object({
  symbol: z.string().min(1),
  startDte: z.number().int().nonnegative(),
  endDte: z.number().int().nonnegative(),
});

export const GammaOptionElementSchema = z.object({
  optionType: z.enum(["CALL", "PUT"]),
  dte: z.number(),
  dteBucket: z.enum(["0DTE", "1-7DTE", "8-30DTE", "31-90DTE", "90DTE+"]),
  moneynessType: z.enum(["NTM", "ITM", "OTM"]),
  expiration: z.string(),
  underlyingSymbol: z.string(),
  underlyingPrice: z.number(),
  distanceFromSpotPct: z.number(),
  distanceFromSpot: z.number(),
  bid: z.number(),
  ask: z.number(),
  mark: z.number(),
  last: z.number(),
  strike: z.number(),
  delta: z.number(),
  gamma: z.number(),
  signedStrikeGEX: z.number(),
  perContractGEX: z.number(),
  impliedVolatility: z.number(),
  openInterest: z.number(),
  multiplier: z.number(),
});

export const GammaExposureReturnSchema = z.array(GammaOptionElementSchema);

export type GammaOptionElement = z.infer<typeof GammaOptionElementSchema>;
export type GammaExposureRequest = z.infer<typeof GammaExposureRequestSchema>;
export type GammaExposureReturn = z.infer<typeof GammaExposureReturnSchema>;
