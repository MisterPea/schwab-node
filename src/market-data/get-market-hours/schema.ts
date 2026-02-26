import * as z from 'zod';

export const AvailableMarketSchema = z.union([
  z.literal('equity'),
  z.literal('option'),
  z.literal('bond'),
  z.literal('future'),
  z.literal('forex'),
]);

export const GetMarketHoursSchema = z.object({
  markets: z.array(AvailableMarketSchema),
  date: z.union([z.string(), z.number()]).optional(),
});

export const MarketSessionSchema = z.object({
  date: z.string(),
  marketType: z.string(),
  product: z.string(),
  isOpen: z.boolean(),
}).loose();

export const MarketSessionHoursRangeSchema = z.object({
  start: z.string(),
  end: z.string(),
}).loose();

export const MarketSessionHoursSchema = z.record(z.string(), z.array(MarketSessionHoursRangeSchema));

export const MarketHoursRtnSchema = z.object({
  date: z.string(),
  marketType: z.string(),
  isOpen: z.boolean(),
  sessionHours: MarketSessionHoursSchema.optional(),
}).loose();

export const MarketHoursNestedResponseSchema = z.record(
  z.string(),
  z.record(z.string(), MarketHoursRtnSchema),
);

export const MarketHoursResponseSchema = z.array(MarketHoursRtnSchema);

export type AvailableMarket = z.infer<typeof AvailableMarketSchema>;
export type GetMarketHoursConfig = z.infer<typeof GetMarketHoursSchema>;
export type MarketSession = z.infer<typeof MarketSessionSchema>;
export type MarketSessionHoursRange = z.infer<typeof MarketSessionHoursRangeSchema>;
export type MarketSessionHours = z.infer<typeof MarketSessionHoursSchema>;
export type MarketHoursRtn = z.infer<typeof MarketHoursRtnSchema>;
