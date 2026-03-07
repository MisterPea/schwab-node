import * as z from "zod";
import type { OptionReturnArraySchema } from "../get-atm-option-data/schema.js";

const GreekRangeSchema = z.tuple([z.number(), z.number()]);

export const GreekSchema = z.object({
  delta: GreekRangeSchema.optional(),
  gamma: GreekRangeSchema.optional(),
  theta: GreekRangeSchema.optional(),
  vega: GreekRangeSchema.optional(),
  rho: GreekRangeSchema.optional(),
  iv: GreekRangeSchema.optional(),
  absDelta: GreekRangeSchema.optional(),
});

export type Greeks = keyof z.infer<typeof GreekSchema>;
export type GreekRecord = z.infer<typeof GreekSchema>;

export const GreekFilterRequestSchema = z.object({
  symbol: z.string(),
  window: z.tuple([z.number(), z.number()]),
  greek: GreekSchema,
  side: z.enum(["CALL", "PUT", "BOTH"]).optional(),
  strikeCount: z.number().optional(),
});

export type GreekFilterRequest = z.infer<typeof GreekFilterRequestSchema>;
export type GreekFilterReturn = z.infer<typeof OptionReturnArraySchema>;
