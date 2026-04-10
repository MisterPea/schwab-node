import * as z from "zod";

export const HistoricalBaseStreamServiceSchema = z.union([
  z.literal("HISTORICAL_CHART_EQUITY"),
  z.literal("HISTORICAL_CHART_FUTURES"),
]);

export const HistoricalStreamServiceSchema = z
  .string()
  .min(1)
  .regex(/^HISTORICAL_[A-Z0-9_]+$/);

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

export const HistoricalReplaySectionKindSchema = z.union([
  z.literal("pre_sample"),
  z.literal("in_sample"),
  z.literal("out_of_sample"),
]);

export const HistoricalReplayConfigSchema = z
  .object({
    filePath: z.string().min(1).optional(),
    service: HistoricalBaseStreamServiceSchema.default(
      "HISTORICAL_CHART_EQUITY",
    ),
    symbol: z.string().min(1).optional(),
    format: HistoricalReplayFormatSchema.optional(),
    pace: HistoricalReplayPaceSchema.default("burst"),
    speed: z.number().positive().optional(),
    preSampleFiles: z.array(z.string().min(1)).optional(),
    inSampleFiles: z.array(z.string().min(1)).optional(),
    outOfSampleFiles: z.array(z.string().min(1)).optional(),
    outOfSampleWindowSize: z.number().int().positive().optional(),
    outOfSampleOverlap: z.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    const splitMode =
      value.preSampleFiles !== undefined ||
      value.inSampleFiles !== undefined ||
      value.outOfSampleFiles !== undefined ||
      value.outOfSampleWindowSize !== undefined ||
      value.outOfSampleOverlap !== undefined;

    if (value.filePath && splitMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "`filePath` cannot be combined with split replay fields",
        path: ["filePath"],
      });
    }

    if (!value.filePath) {
      if (!value.inSampleFiles || value.inSampleFiles.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "`inSampleFiles` is required for split replay mode",
          path: ["inSampleFiles"],
        });
      }
    }

    if (value.outOfSampleFiles?.length) {
      if (value.outOfSampleWindowSize === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "`outOfSampleWindowSize` is required when `outOfSampleFiles` is provided",
          path: ["outOfSampleWindowSize"],
        });
      }

      if (value.outOfSampleOverlap === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "`outOfSampleOverlap` is required when `outOfSampleFiles` is provided",
          path: ["outOfSampleOverlap"],
        });
      }
    } else if (
      value.outOfSampleWindowSize !== undefined ||
      value.outOfSampleOverlap !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`outOfSampleWindowSize` and `outOfSampleOverlap` require `outOfSampleFiles`",
        path: ["outOfSampleFiles"],
      });
    }

    if (
      value.outOfSampleWindowSize !== undefined &&
      value.outOfSampleOverlap !== undefined &&
      value.outOfSampleOverlap >= value.outOfSampleWindowSize
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`outOfSampleOverlap` must be less than `outOfSampleWindowSize`",
        path: ["outOfSampleOverlap"],
      });
    }
  });

export const HistoricalReplayPayloadSchema = z
  .object({
    service: HistoricalStreamServiceSchema,
    command: z.literal("REPLAY"),
    content: z.array(HistoricalChartRecordSchema),
    source: z.string(),
    replayMode: HistoricalReplayPaceSchema,
    baseService: HistoricalBaseStreamServiceSchema.optional(),
    sectionLabel: z.string().min(1).optional(),
    sectionIndex: z.number().int().positive().optional(),
    sectionKind: HistoricalReplaySectionKindSchema.optional(),
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
export type HistoricalBaseStreamService = z.infer<
  typeof HistoricalBaseStreamServiceSchema
>;
export type HistoricalReplayFormat = z.infer<
  typeof HistoricalReplayFormatSchema
>;
export type HistoricalReplayPace = z.infer<typeof HistoricalReplayPaceSchema>;
export type HistoricalChartRecord = z.infer<typeof HistoricalChartRecordSchema>;
export type HistoricalReplaySectionKind = z.infer<
  typeof HistoricalReplaySectionKindSchema
>;
export type HistoricalReplayConfig = z.infer<
  typeof HistoricalReplayConfigSchema
>;
export type HistoricalReplayPayload = z.infer<
  typeof HistoricalReplayPayloadSchema
>;
export type HistoricalPublishedMessage = z.infer<
  typeof HistoricalPublishedMessageSchema
>;
