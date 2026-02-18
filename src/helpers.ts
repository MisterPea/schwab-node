import { ISODate } from "./types.js";
import { GetMarketDataConfig } from "./types_internal.js";
import { URL } from 'node:url';

export const MARKET_DATA_ROOT = "https://api.schwabapi.com/marketdata/v1";

export function convertIsoStringToMs(isoString: ISODate): number {
  const date = new Date(isoString);
  return date.getTime();
}

/**
 * Function to return YYYY-MM-DD string d days into the future
 * @param {number} d Number of days to advance todays date
 * @returns {string} YYYY-MM-DD
 */
export function addDays(d: number): string {
  const date = new Date();
  date.setDate(date.getDate() + d);
  const newDate = date.toISOString().split('T')[0];
  return newDate;
}

/**
 * Convenience function to construct marketData url with queries
 * @param {Object} config Key/values pairs to include in the query 
 * @param {string} endpoint Slash delineated link to the endpoint
 * @returns {string} Endpoint with queries
 */
export function constructMarketDataUrl(config: GetMarketDataConfig | null, endpoint: string): string {
  const url = new URL(`${MARKET_DATA_ROOT}${endpoint}`);

  if (config) {
    for (const [k, v] of Object.entries(config)) {
      url.searchParams.set(k, `${v}`);
    }
  }
  const reqUrl = url.toString();
  return reqUrl;
}

/**
 * Convert's a ReadableStream to JSON objects and optionally validate each parsed object.
 * @param {ReadableStream} stream Stream to convert—usually from request.body
 * @param {(obj: unknown) => obj is T} validate Optional runtime validator for each parsed object
 * @returns {Promise<T[]>}
 */
export async function readableStreamToObject<T = Record<string, unknown>>(
  stream: ReadableStream,
  validate?: (obj: unknown) => obj is T
): Promise<T[]> {
  const decoder = new TextDecoder();
  let buffer = '';
  const result: T[] = [];

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });

    // Try to extract complete JSON objects
    let braceCount = 0;
    let startIdx = 0;

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === '{') braceCount++;
      if (buffer[i] === '}') braceCount--;

      // Found a complete object
      if (braceCount === 0 && buffer[i] === '}') {
        const jsonStr = buffer.substring(startIdx, i + 1);
        try {
          const obj = JSON.parse(jsonStr) as unknown;
          if (!validate || validate(obj)) {
            result.push(obj as T); // Collect each complete object
          }
        } catch {
          // Not valid JSON, skip
        }
        startIdx = i + 1;
      }
    }

    // Keep unparsed remainder in buffer
    buffer = buffer.substring(startIdx);
  }
  return result;
}
