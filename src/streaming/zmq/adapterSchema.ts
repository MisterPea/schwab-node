import * as z from "zod";
import { StreamServiceSchema } from "../websocket/schema.js";

export const JsonRecordSchema = z.record(z.string(), z.unknown());

export const AdapterDataPayloadSchema = z
  .object({
    service: StreamServiceSchema,
    content: z.unknown(),
  })
  .catchall(z.unknown());

export const AdapterDataMessageSchema = z
  .object({
    type: z.literal("data"),
    receivedAt: z.number(),
    payload: AdapterDataPayloadSchema,
  })
  .catchall(z.unknown());

export type JsonRecord = z.infer<typeof JsonRecordSchema>;
export type AdapterDataMessage = z.infer<typeof AdapterDataMessageSchema>;
