import { MARKET_DATA_ROOT, constructMarketDataUrl, readableStreamToObject } from "../helpers.js";
import { GetMarketHoursConfig, GetMoversConfig, MarketHoursRtn, MoversConfig, ScreenersResponse, ScreenersResponseItem } from "../types.js";
import { getRequest } from "./request.js";

type RawMarketHoursProduct = {
  date: string;
  marketType: string;
  isOpen: boolean;
  sessionHours?: Record<string, Array<{ start: string; end: string; }>>;
};

type RawMarketHoursByCode = Record<string, RawMarketHoursProduct>;
type RawMarketHoursResponse = Record<string, RawMarketHoursByCode>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isSessionHours(v: unknown): v is Record<string, Array<{ start: string; end: string; }>> {
  if (!isRecord(v)) return false;
  return Object.values(v).every((ranges) => {
    if (!Array.isArray(ranges)) return false;
    return ranges.every((range) =>
      isRecord(range) && typeof range.start === 'string' && typeof range.end === 'string'
    );
  });
}

function isRawMarketHoursProduct(v: unknown): v is RawMarketHoursProduct {
  if (!isRecord(v)) return false;
  if (typeof v.date !== 'string' || typeof v.marketType !== 'string' || typeof v.isOpen !== 'boolean') return false;
  if (v.sessionHours != null && !isSessionHours(v.sessionHours)) return false;
  return true;
}

function isRawMarketHoursResponse(v: unknown): v is RawMarketHoursResponse {
  if (!isRecord(v)) return false;
  return Object.values(v).every((byCode) =>
    isRecord(byCode) && Object.values(byCode).every(isRawMarketHoursProduct)
  );
}

function isScreenerItem(v: unknown): boolean {
  if (!isRecord(v)) return false;
  return typeof v.symbol === 'string'
    && typeof v.description === 'string'
    && typeof v.volume === 'number'
    && typeof v.lastPrice === 'number'
    && typeof v.netChange === 'number'
    && typeof v.marketShare === 'number'
    && typeof v.totalVolume === 'number'
    && typeof v.trades === 'number'
    && typeof v.netPercentChange === 'number';
}

function isScreenersResponseItem(v: unknown): v is ScreenersResponseItem {
  if (!isRecord(v) || !Array.isArray(v.screeners)) return false;
  return v.screeners.every(isScreenerItem);
}

/**
 * Returns a list of top 10 securities movement for a specific index.
 * @param {GetMoversConfig} config 
 * @returns {Promise<ScreenersResponse>}
 */
export async function getMovers(config: GetMoversConfig): Promise<ScreenersResponse> {
  const { index, sort } = config;
  const moversConfig: MoversConfig = {
    sort,
    frequency: config.frequency ?? 0,
  };

  const url = constructMarketDataUrl(moversConfig, `/movers/${encodeURIComponent(index)}`);
  const res = await getRequest(url);

  if (!res.body) throw new Error("No response body stream available");

  const moversOut = await readableStreamToObject<ScreenersResponseItem>(res.body, isScreenersResponseItem);
  if (!moversOut.length) throw new Error(`No movers data returned for index: ${index}`);
  return moversOut;
}

/**
 * Returns market hours for requested market(s) for today or a specified date up to 1 year in the future
 * @param {GetMarketHoursConfig} config Object of markets {markets[]} and optional date in YYYY-MM-DD format
 * @returns {Promise<MarketHoursRtn>}
 */
export async function getMarketHours(config: GetMarketHoursConfig): Promise<MarketHoursRtn[]> {
  const params = new URLSearchParams();
  config.markets.forEach((market) => params.append('markets', market));
  if (config.date != null) params.set('date', `${config.date}`);
  const url = `${MARKET_DATA_ROOT}/markets?${params.toString()}`;

  const res = await getRequest(url);
  if (!res.body) throw new Error("No response body stream available");

  const marketHoursOut = await readableStreamToObject<RawMarketHoursResponse>(res.body, isRawMarketHoursResponse);
  const flattened: MarketHoursRtn[] = [];

  for (const response of marketHoursOut) {
    for (const byCode of Object.values(response)) {
      for (const product of Object.values(byCode)) {
        flattened.push({
          date: product.date,
          marketType: product.marketType,
          isOpen: product.isOpen,
          sessionHours: product.sessionHours
        });
      }
    }
  }
  return flattened;
}
