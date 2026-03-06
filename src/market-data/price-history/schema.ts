import * as z from "zod";

const periodTypeEnum = z.enum(["day", "month", "year", "ytd"]);
const frequencyTypeEnum = z.enum(["minute", "daily", "weekly", "monthly"]);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date YYYY-MM-DD");

export const PriceHistoryQuerySchema = z
  .object({
    symbol: z.string().min(1, "symbol is required"),

    periodType: periodTypeEnum.optional(),
    period: z.number().int().optional(),

    frequencyType: frequencyTypeEnum.optional(),
    frequency: z.number().int().optional(),

    startDate: isoDate.optional(),
    endDate: isoDate.optional(),

    needExtendedHoursData: z.boolean().optional(),
    needPreviousClose: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // ---- period validation ----
    if (data.periodType && data.period !== undefined) {
      const validPeriods: Record<z.infer<typeof periodTypeEnum>, number[]> = {
        day: [1, 2, 3, 4, 5, 10],
        month: [1, 2, 3, 6],
        year: [1, 2, 3, 5, 10, 15, 20],
        ytd: [1],
      };

      if (!validPeriods[data.periodType].includes(data.period)) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid period for periodType "${data.periodType}"`,
          path: ["period"],
        });
      }
    }

    // ---- frequencyType validation based on periodType ----
    if (data.periodType && data.frequencyType) {
      const validFrequencyTypes: Record<
        z.infer<typeof periodTypeEnum>,
        z.infer<typeof frequencyTypeEnum>[]
      > = {
        day: ["minute"],
        month: ["daily", "weekly"],
        year: ["daily", "weekly", "monthly"],
        ytd: ["daily", "weekly"],
      };

      if (!validFrequencyTypes[data.periodType].includes(data.frequencyType)) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid frequencyType "${data.frequencyType}" for periodType "${data.periodType}"`,
          path: ["frequencyType"],
        });
      }
    }

    // ---- frequency validation based on frequencyType ----
    if (data.frequencyType && data.frequency !== undefined) {
      const validFrequencies: Record<
        z.infer<typeof frequencyTypeEnum>,
        number[]
      > = {
        minute: [1, 5, 10, 15, 30],
        daily: [1],
        weekly: [1],
        monthly: [1],
      };

      if (!validFrequencies[data.frequencyType].includes(data.frequency)) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid frequency "${data.frequency}" for frequencyType "${data.frequencyType}"`,
          path: ["frequency"],
        });
      }
    }

    // ---- optional: date range sanity check ----
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      if (start > end) {
        ctx.addIssue({
          code: "custom",
          message: "startDate must be before or equal to endDate",
          path: ["startDate"],
        });
      }
    }
  });

export type ChartQuery = z.infer<typeof PriceHistoryQuerySchema>;
export const PriceHistorySlice = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  datetime: z.number(),
});

export const PriceHistoryResponseSchema = z.object({
  symbol: z.string(),
  empty: z.boolean(),
  candles: z.array(PriceHistorySlice.optional()),
});

export type GetPriceHistoryResponse = z.infer<
  typeof PriceHistoryResponseSchema
>;
export type GetPriceHistoryRequest = z.infer<typeof PriceHistoryQuerySchema>;
