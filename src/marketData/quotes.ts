import { ChartRequest, GetQuoteReq, PriceHistoryRtnElement, QuoteRtn } from "../types.js";
import { constructMarketDataUrl, convertIsoStringToMs, readableStreamToObject } from "../helpers.js";
import { getRequest } from "./request.js";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isPriceHistoryCandle(v: unknown): v is PriceHistoryRtnElement['candles'][number] {
  if (!isRecord(v)) return false;
  return typeof v.open === 'number'
    && typeof v.high === 'number'
    && typeof v.low === 'number'
    && typeof v.close === 'number'
    && typeof v.volume === 'number'
    && typeof v.datetime === 'number';
}

function isPriceHistoryRtnElement(v: unknown): v is PriceHistoryRtnElement {
  if (!isRecord(v)) return false;
  if (typeof v.symbol !== 'string' || typeof v.empty !== 'boolean') return false;
  if (!Array.isArray(v.candles)) return false;
  return v.candles.every(isPriceHistoryCandle);
}

function isQuoteRtn(v: unknown): v is QuoteRtn {
  if (!isRecord(v)) return false;
  const values = Object.values(v);
  if (!values.length) return false;
  return values.every((quoteData) => isRecord(quoteData) && typeof quoteData.symbol === 'string');
}

export async function getPriceHistory(config: ChartRequest): Promise<PriceHistoryRtnElement[]> {

  // convert startDate/endDate to ms-epoch
  if (config.startDate) {
    config = { ...config, startDate: convertIsoStringToMs(config.startDate) };
  }
  if (config.endDate) {
    config = { ...config, endDate: convertIsoStringToMs(config.endDate) };
  }

  const url = constructMarketDataUrl(config, '/pricehistory');
  const res = await getRequest(url);
  if (!res.body) throw new Error("No response body stream available");

  const priceHistoryOut = await readableStreamToObject<PriceHistoryRtnElement>(res.body, isPriceHistoryRtnElement);
  if (!priceHistoryOut.length) throw new Error(`No price history data returned for symbol: ${config.symbol}`);
  return priceHistoryOut;
}

export async function getQuote(config: GetQuoteReq): Promise<QuoteRtn[]> {
  const url = constructMarketDataUrl(config, '/quotes');
  const res = await getRequest(url);
  if (!res.body) throw new Error("No response body stream available");

  const result = await readableStreamToObject<QuoteRtn>(res.body, isQuoteRtn);
  if (!result.length) throw new Error(`No quote data returned for symbols: ${config.symbols}`);
  return result;
}


/* 
[
 {
  "symbol": "AAPL",
  "empty": false,
  "candles": [
   {
    "open": 241.79,
    "high": 244.0272,
    "low": 208.42,
    "close": 222.13,
    "volume": 1115306052,
    "datetime": 1740808800000
   },
*/
