import * as z from "zod";

export type GetAtmOptionReq = {
  symbol: string;
  window: [number, number];
};

export const GetAtmOptionRequestSchema = z.object({
  symbol: z.string(),
  window: z.tuple([z.number(), z.number()]),
});

export const OptionReturnSchema = z.object({
  put_call: z.enum(["PUT", "CALL"]),
  day_of_expiry: z.enum(["SUN", "MON", "TUE", "WED", "THR", "FRI", "SAT"]),
  underlying: z.string(),
  bid: z.number(),
  ask: z.number(),
  bidAskSpreadPct: z.number(),
  open_interest: z.number(),
  total_volume: z.number(),
  symbol: z.string(),
  dte: z.number(),
  theta: z.number(),
  strike_price: z.number(),
  gamma: z.number(),
  volatility: z.number(),
  vega: z.number(),
  delta: z.number(),
  rho: z.number(),
});

export const OptionReturnArraySchema = z.array(OptionReturnSchema);

export type OptionReturn = z.infer<typeof OptionReturnSchema>;
export type GetAtmOptionRequest = z.infer<typeof GetAtmOptionRequestSchema>;
export type GetAtmOptionReturn = z.infer<typeof OptionReturnArraySchema>;
