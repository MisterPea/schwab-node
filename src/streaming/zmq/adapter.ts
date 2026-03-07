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

function remapBookMarketMaker(value: unknown): unknown {
  const parsed = JsonRecordSchema.safeParse(value);
  if (!parsed.success) return value;
  return remapKeys(parsed.data, BOOK_MARKET_MAKER_FIELDS);
}

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
 * Trunk function for Adapter. 
 * Adapts streamer `data` messages by remapping numeric field keys to semantic names.
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
