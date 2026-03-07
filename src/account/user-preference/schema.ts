import * as z from "zod";

export const UserPreferenceAccountSchema = z.object({
  accountNumber: z.string(),
  primaryAccount: z.boolean(),
  type: z.string(),
  nickName: z.string(),
  accountColor: z.string(),
  displayAcctId: z.string(),
  autoPositionEffect: z.boolean(),
});

export const UserPreferenceStreamerInfoSchema = z.object({
  streamerSocketUrl: z.string(),
  schwabClientCustomerId: z.string(),
  schwabClientCorrelId: z.string(),
  schwabClientChannel: z.string(),
  schwabClientFunctionId: z.string(),
});

export const UserPreferenceOfferSchema = z.object({
  level2Permissions: z.boolean(),
  mktDataPermission: z.string(),
});

export const UserPreferenceResponseSchema = z.object({
  accounts: z.array(UserPreferenceAccountSchema),
  streamerInfo: z.array(UserPreferenceStreamerInfoSchema),
  offers: z.array(UserPreferenceOfferSchema),
});

export type UserPreferenceAccount = z.infer<typeof UserPreferenceAccountSchema>;
export type UserPreferenceStreamerInfo = z.infer<
  typeof UserPreferenceStreamerInfoSchema
>;
export type UserPreferenceOffer = z.infer<typeof UserPreferenceOfferSchema>;
export type UserPreferenceResponse = z.infer<
  typeof UserPreferenceResponseSchema
>;
