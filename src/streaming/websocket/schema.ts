import * as z from "zod";

export const StreamServiceSchema = z.union([
  z.literal("LEVELONE_EQUITIES"),
  z.literal("LEVELONE_OPTIONS"),
  z.literal("LEVELONE_FUTURES"),
  z.literal("LEVELONE_FUTURES_OPTIONS"),
  z.literal("LEVELONE_FOREX"),
  z.literal("NYSE_BOOK"),
  z.literal("NASDAQ_BOOK"),
  z.literal("OPTIONS_BOOK"),
  z.literal("CHART_EQUITY"),
  z.literal("CHART_FUTURES"),
  z.literal("SCREENER_EQUITY"),
  z.literal("SCREENER_OPTION"),
  z.literal("ACCT_ACTIVITY"),
]);

export const StreamCommandSchema = z.union([
  z.literal("LOGIN"),
  z.literal("LOGOUT"),
  z.literal("SUBS"),
  z.literal("ADD"),
  z.literal("UNSUBS"),
  z.literal("VIEW"),
]);

export const ServiceCommandSchema = z.union([
  z.literal("SUBS"),
  z.literal("ADD"),
  z.literal("UNSUBS"),
  z.literal("VIEW"),
]);

export const SubscriptionInputSchema = z.object({
  service: StreamServiceSchema,
  keys: z.array(z.string()),
  fields: z.array(z.string()),
});

export const UnsubscribeInputSchema = z.object({
  service: StreamServiceSchema,
  keys: z.array(z.string()),
});

export const ViewInputSchema = z.object({
  service: StreamServiceSchema,
  fields: z.array(z.string()),
});

export const SubscriptionStateSchema = z.object({
  keys: z.array(z.string()),
  fields: z.array(z.string()),
});

export const StreamerContextSchema = z.object({
  streamerSocketUrl: z.string(),
  schwabClientCustomerId: z.string(),
  schwabClientCorrelId: z.string(),
  schwabClientChannel: z.string(),
  schwabClientFunctionId: z.string(),
  accessToken: z.string(),
});

export const StreamerRequestSchema = z.object({
  service: z.string(),
  command: StreamCommandSchema,
  requestid: z.string(),
  SchwabClientCustomerId: z.string(),
  SchwabClientCorrelId: z.string(),
  parameters: z.record(z.string(), z.string()).optional(),
});

export const StreamerRequestEnvelopeSchema = z.object({
  requests: z.array(StreamerRequestSchema),
});

export const StreamerResponseContentSchema = z.object({
  code: z.number(),
  msg: z.string(),
});

export const StreamerResponseSchema = z
  .object({
    service: z.string(),
    command: StreamCommandSchema,
    requestid: z.string(),
    SchwabClientCorrelId: z.string().optional(),
    timestamp: z.number().optional(),
    content: StreamerResponseContentSchema,
  })
  .loose();

export const StreamerDataSchema = z
  .object({
    service: z.string(),
    command: z.string().optional(),
    timestamp: z.number().optional(),
    content: z.unknown(),
  })
  .loose();

export const StreamerNotifySchema = z.record(z.string(), z.unknown());

export const StreamerFrameSchema = z
  .object({
    notify: z.array(StreamerNotifySchema).optional(),
    response: z.array(StreamerResponseSchema).optional(),
    data: z.array(StreamerDataSchema).optional(),
  })
  .loose();

export const ServiceRequestParamsSchema = z.object({
  service: StreamServiceSchema,
  keys: z.array(z.string()).optional(),
  fields: z.array(z.string()).optional(),
});

export const ParsedIncomingEntrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("notify"),
    payload: StreamerNotifySchema,
  }),
  z.object({
    type: z.literal("response"),
    service: z.string(),
    payload: StreamerResponseSchema,
  }),
  z.object({
    type: z.literal("data"),
    service: z.string(),
    payload: StreamerDataSchema,
  }),
]);

export const PublishedMessageSchema = z.object({
  type: z.union([
    z.literal("notify"),
    z.literal("response"),
    z.literal("data"),
  ]),
  receivedAt: z.number(),
  payload: z.unknown(),
});

export type StreamService = z.infer<typeof StreamServiceSchema>;
export type StreamCommand = z.infer<typeof StreamCommandSchema>;
export type ServiceCommand = z.infer<typeof ServiceCommandSchema>;
export type SubscriptionInput = z.infer<typeof SubscriptionInputSchema>;
export type UnsubscribeInput = z.infer<typeof UnsubscribeInputSchema>;
export type ViewInput = z.infer<typeof ViewInputSchema>;
export type SubscriptionState = z.infer<typeof SubscriptionStateSchema>;
export type StreamerContext = z.infer<typeof StreamerContextSchema>;
export type StreamerRequest = z.infer<typeof StreamerRequestSchema>;
export type StreamerRequestEnvelope = z.infer<
  typeof StreamerRequestEnvelopeSchema
>;
export type StreamerResponse = z.infer<typeof StreamerResponseSchema>;
export type StreamerData = z.infer<typeof StreamerDataSchema>;
export type StreamerNotify = z.infer<typeof StreamerNotifySchema>;
export type ParsedIncomingEntry = z.infer<typeof ParsedIncomingEntrySchema>;
export type ServiceRequestParams = z.infer<typeof ServiceRequestParamsSchema>;
export type PublishedMessage = z.infer<typeof PublishedMessageSchema>;
