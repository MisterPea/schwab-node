import * as z from 'zod';
import { ISODateSchema } from '../get-option-chain/schema.js';

export const OptionExpirationRequestSchema = z.object({
  symbol: z.string(),
});

const OptionExpirationSliceSchema = z.object({
  expirationDate: ISODateSchema,
  daysToExpiration: z.number(),
  expirationType: z.enum(['M', 'Q', 'S', 'W']),
  settlementType: z.enum(['A', 'P']),
  optionRoots: z.string(),
  standard: z.boolean(),
});

export const OptionExpirationReturnSchema = z.array(OptionExpirationSliceSchema);

export type OptionExpirationRequest = z.infer<typeof OptionExpirationRequestSchema>;
export type OptionsExpirationSlice = z.infer<typeof OptionExpirationSliceSchema>;
export type OptionExpirationReturn = z.infer<typeof OptionExpirationReturnSchema>;
