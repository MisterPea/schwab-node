import * as z from "zod";

export const HistoricalStreamServiceSchema = z.union([
  z.literal("HISTORICAL_CHART_EQUITY"),
  z.literal("HISTORICAL_CHART_FUTURES"),
]);

export const HistoricalReplayFormatSchema = z.union([
  z.literal("jsonl"),
  z.literal("csv"),
]);

export const HistoricalReplayPaceSchema = z.union([
  z.literal("burst"),
  z.literal("timed"),
]);

export const HistoricalChartRecordSchema = z.object({
  symbol: z.string().min(1),
  openPrice: z.number(),
  highPrice: z.number(),
  lowPrice: z.number(),
  closePrice: z.number(),
  volume: z.number(),
  chartTime: z.number().int(),
});

export const HistoricalReplayConfigSchema = z.object({
  filePath: z.string().min(1),
  service: HistoricalStreamServiceSchema.default("HISTORICAL_CHART_EQUITY"),
  symbol: z.string().min(1).optional(),
  format: HistoricalReplayFormatSchema.optional(),
  pace: HistoricalReplayPaceSchema.default("burst"),
  speed: z.number().positive().optional(),
});

export const HistoricalReplayPayloadSchema = z
  .object({
    service: HistoricalStreamServiceSchema,
    command: z.literal("REPLAY"),
    content: z.array(HistoricalChartRecordSchema),
    source: z.string(),
    replayMode: HistoricalReplayPaceSchema,
  })
  .catchall(z.unknown());

export const HistoricalPublishedMessageSchema = z.object({
  type: z.literal("data"),
  receivedAt: z.number(),
  payload: HistoricalReplayPayloadSchema,
});

export type HistoricalStreamService = z.infer<
  typeof HistoricalStreamServiceSchema
>;
export type HistoricalReplayFormat = z.infer<
  typeof HistoricalReplayFormatSchema
>;
export type HistoricalReplayPace = z.infer<typeof HistoricalReplayPaceSchema>;
export type HistoricalChartRecord = z.infer<typeof HistoricalChartRecordSchema>;
export type HistoricalReplayConfig = z.infer<
  typeof HistoricalReplayConfigSchema
>;
export type HistoricalReplayPayload = z.infer<
  typeof HistoricalReplayPayloadSchema
>;
export type HistoricalPublishedMessage = z.infer<
  typeof HistoricalPublishedMessageSchema
>;
