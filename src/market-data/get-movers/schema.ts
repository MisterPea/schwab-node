import * as z from "zod";

export const MoversConfigSchema = z.object({
  sort: z.union([
    z.literal("VOLUME"),
    z.literal("TRADES"),
    z.literal("PERCENT_CHANGE_UP"),
    z.literal("PERCENT_CHANGE_DOWN"),
  ]),
  frequency: z
    .union([
      z.literal(0),
      z.literal(1),
      z.literal(5),
      z.literal(10),
      z.literal(30),
      z.literal(60),
    ])
    .optional(),
});

export const GetMoversSchema = MoversConfigSchema.extend({
  index: z.union([
    z.literal("$DJI"),
    z.literal("$COMPX"),
    z.literal("$SPX"),
    z.literal("NYSE"),
    z.literal("NASDAQ"),
    z.literal("OTCBB"),
    z.literal("INDEX_ALL"),
    z.literal("EQUITY_ALL"),
    z.literal("OPTION_ALL"),
    z.literal("OPTION_PUT"),
    z.literal("OPTION_CALL"),
  ]),
});

export const ScreenerItemSchema = z
  .object({
    description: z.string(),
    volume: z.number(),
    lastPrice: z.number(),
    netChange: z.number(),
    marketShare: z.number(),
    totalVolume: z.number(),
    trades: z.number(),
    netPercentChange: z.number(),
    symbol: z.string(),
  })
  .loose();

export const ScreenersResponseSchema = z.array(ScreenerItemSchema);

export type MoversConfig = z.infer<typeof MoversConfigSchema>;
export type GetMoversConfig = z.infer<typeof GetMoversSchema>;
export type ScreenerItem = z.infer<typeof ScreenerItemSchema>;
export type ScreenersResponse = z.infer<typeof ScreenersResponseSchema>;
