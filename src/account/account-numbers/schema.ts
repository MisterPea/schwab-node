import * as z from 'zod';

export const UserAccountSchema = z.object({
  accountNumber: z.string(),
  hashValue: z.string()
}).loose();

export const UserAccountArraySchema = z.array(UserAccountSchema);

export type UserAccountNumbers = z.infer<typeof UserAccountArraySchema>;
