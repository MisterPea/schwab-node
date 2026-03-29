import type { PublishedMessage, StreamService } from "../websocket/schema.js";
import {
  ACCT_ACTIVITY_FIELDS,
  BOOK_FIELDS,
  BOOK_MARKET_MAKER_FIELDS,
  BOOK_PRICE_LEVEL_FIELDS,
  CHART_EQUITY_FIELDS,
  CHART_FUTURES_FIELDS,
  LEVELONE_EQUITIES_FIELDS,
  LEVELONE_FOREX_FIELDS,
  LEVELONE_FUTURES_FIELDS,
  LEVELONE_FUTURES_OPTIONS_FIELDS,
  LEVELONE_OPTIONS_FIELDS,
  SCREENER_FIELDS,
} from "../websocket/fields.js";
import {
  AdapterDataMessageSchema,
  JsonRecordSchema,
  type JsonRecord,
} from "./adapterSchema.js";

type FieldMap = Record<string, string>;

const SERVICE_FIELD_MAPS: Partial<Record<StreamService, FieldMap>> = {
  LEVELONE_EQUITIES: LEVELONE_EQUITIES_FIELDS,
  LEVELONE_OPTIONS: LEVELONE_OPTIONS_FIELDS,
  LEVELONE_FUTURES: LEVELONE_FUTURES_FIELDS,
  LEVELONE_FUTURES_OPTIONS: LEVELONE_FUTURES_OPTIONS_FIELDS,
  LEVELONE_FOREX: LEVELONE_FOREX_FIELDS,
  NYSE_BOOK: BOOK_FIELDS,
  NASDAQ_BOOK: BOOK_FIELDS,
  OPTIONS_BOOK: BOOK_FIELDS,
  CHART_EQUITY: CHART_EQUITY_FIELDS,
  CHART_FUTURES: CHART_FUTURES_FIELDS,
  SCREENER_EQUITY: SCREENER_FIELDS,
  SCREENER_OPTION: SCREENER_FIELDS,
  ACCT_ACTIVITY: ACCT_ACTIVITY_FIELDS,
};

/**
 * Remaps raw numeric field keys in a streamer payload object to semantic names.
 *
 * When both the numeric key and its semantic alias are present, the semantic
 * value wins and the numeric key is preserved as-is to avoid overwriting data.
 *
 * @param source Raw object containing streamer field keys.
 * @param fieldMap Mapping of raw field keys to semantic field names.
 * @param transformValue Optional transform applied after key remapping.
 * @returns A new record with semantic keys substituted where mappings exist.
 */
function remapKeys(
  source: JsonRecord,
  fieldMap: FieldMap,
  transformValue?: (semanticKey: string, value: unknown) => unknown,
): JsonRecord {
  const remapped: JsonRecord = {};

  for (const [key, value] of Object.entries(source)) {
    const semanticKey = fieldMap[key] ?? key;
    const nextValue = transformValue ? transformValue(semanticKey, value) : value;

    // Preserve existing semantic values if both numeric and semantic keys are present.
    if (semanticKey in remapped) {
      remapped[key] = nextValue;
      continue;
    }

    remapped[semanticKey] = nextValue;
  }

  return remapped;
}

/**
 * Remaps market maker entries nested inside book payloads.
 *
 * @param value Candidate market maker object.
 * @returns The remapped object when parsing succeeds, otherwise the original value.
 */
function remapBookMarketMaker(value: unknown): unknown {
  const parsed = JsonRecordSchema.safeParse(value);
  if (!parsed.success) return value;
  return remapKeys(parsed.data, BOOK_MARKET_MAKER_FIELDS);
}

/**
 * Remaps price level entries nested inside book payloads, including their
 * nested `marketMakers` arrays.
 *
 * @param value Candidate price level object.
 * @returns The remapped object when parsing succeeds, otherwise the original value.
 */
function remapBookPriceLevel(value: unknown): unknown {
  const parsed = JsonRecordSchema.safeParse(value);
  if (!parsed.success) return value;
  return remapKeys(
    parsed.data,
    BOOK_PRICE_LEVEL_FIELDS,
    (semanticKey, nestedValue) => {
      if (semanticKey === "marketMakers" && Array.isArray(nestedValue)) {
        return nestedValue.map(remapBookMarketMaker);
      }

      return nestedValue;
    },
  );
}

/**
 * Remaps a top-level book content item and recursively adapts its bid and ask
 * level collections.
 *
 * @param value Candidate book content item.
 * @param topLevelMap Field map for the book service being adapted.
 * @returns The remapped object when parsing succeeds, otherwise the original value.
 */
function remapBookContentItem(value: unknown, topLevelMap: FieldMap): unknown {
  const parsed = JsonRecordSchema.safeParse(value);
  if (!parsed.success) return value;

  return remapKeys(parsed.data, topLevelMap, (semanticKey, nestedValue) => {
    if (
      (semanticKey === "bidSideLevels" || semanticKey === "askSideLevels") &&
      Array.isArray(nestedValue)
    ) {
      return nestedValue.map(remapBookPriceLevel);
    }

    return nestedValue;
  });
}

/**
 * Remaps the `content` array for supported streamer services.
 *
 * Book services receive recursive remapping for their nested levels and market
 * makers. Services without a field map, or non-array content, are returned
 * unchanged.
 *
 * @param service Stream service name associated with the payload.
 * @param content Raw payload content.
 * @returns Adapted content for known services, or the original content.
 */
function remapContent(service: StreamService, content: unknown): unknown {
  const fieldMap = SERVICE_FIELD_MAPS[service];
  if (!fieldMap || !Array.isArray(content)) return content;

  if (
    service === "NYSE_BOOK" ||
    service === "NASDAQ_BOOK" ||
    service === "OPTIONS_BOOK"
  ) {
    return content.map((item) => remapBookContentItem(item, fieldMap));
  }

  return content.map((item) => {
    const parsed = JsonRecordSchema.safeParse(item);
    if (!parsed.success) return item;
    return remapKeys(parsed.data, fieldMap);
  });
}

/**
 * Adapts a published streamer `data` message by replacing numeric field keys in
 * the payload content with semantic names for supported services.
 *
 * Messages that do not match the expected adapter schema are returned
 * unchanged.
 *
 * @param rawData Candidate published message.
 * @returns The adapted published message, or the original input when parsing fails.
 */
export function adapter(rawData: unknown): unknown {
  const parsedDataMessage = AdapterDataMessageSchema.safeParse(rawData);
  if (!parsedDataMessage.success) return rawData;

  const mappedContent = remapContent(
    parsedDataMessage.data.payload.service,
    parsedDataMessage.data.payload.content,
  );

  const adapted: PublishedMessage = {
    ...(parsedDataMessage.data as PublishedMessage),
    payload: {
      ...parsedDataMessage.data.payload,
      content: mappedContent,
    },
  };

  return adapted;
}
