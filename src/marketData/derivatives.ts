import { getRequest } from './request.js';
import { addDays, constructMarketDataUrl, readableStreamToObject } from '../helpers.js';
import { AtmOptionRtn, GetAtmOptionReq, GetOptionChainRtn, GreekFilterReq, GreekFilterRtn, ISODate, OptionChainReq, OptionExpirationReq, OptionExpirationRtn, OptionQuote } from '../types.js';
import { getQuote } from './quotes.js';

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THR', 'FRI', 'SAT'];

type OptionExpirationResponse = {
  expirationList: OptionExpirationRtn[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isOptionChainRtn(v: unknown): v is GetOptionChainRtn {
  if (!isRecord(v)) return false;
  return isRecord(v.callExpDateMap) && isRecord(v.putExpDateMap);
}

function isOptionExpirationRtn(v: unknown): v is OptionExpirationRtn {
  if (!isRecord(v)) return false;
  return (typeof v.expirationDate === 'string' || typeof v.expirationDate === 'number')
    && typeof v.daysToExpiration === 'number';
}

function isOptionExpirationResponse(v: unknown): v is OptionExpirationResponse {
  if (!isRecord(v)) return false;
  if (!Array.isArray(v.expirationList)) return false;
  return v.expirationList.every(isOptionExpirationRtn);
}

/**
 * Option chain request 
 * @param {OptionChainReq} config 
 * @returns {Promise<GetOptionChainRtn>}
 */
export async function getOptionChain(config: OptionChainReq): Promise<GetOptionChainRtn[]> {
  const url = constructMarketDataUrl(config, '/chains');

  const res = await getRequest(url);

  if (!res.body) throw new Error("No response body stream available");

  const optionOut = await readableStreamToObject<GetOptionChainRtn>(res.body, isOptionChainRtn);
  if (!optionOut.length) throw new Error(`No options chain data returned for symbol: ${config.symbol}`);
  return optionOut;
}

/**
 * Returns an array of options' expirations for a particular ticker
 * @param {{symbol:string}} config Ticker string
 * @returns {Promise<OptionExpirationRtn>}
 */
export async function getOptionExpirations(config: OptionExpirationReq): Promise<OptionExpirationRtn[]> {
  const url = constructMarketDataUrl(config, '/expirationchain');

  const res = await getRequest(url);

  if (!res.body) throw new Error("No response body stream available");

  const optionOut = await readableStreamToObject<OptionExpirationResponse>(res.body, isOptionExpirationResponse);
  if (!optionOut.length) throw new Error(`No option expiration data returned for symbol: ${config.symbol}`);
  return optionOut[0].expirationList;
}

/**
 * Function to find ATM options that expire in x to y days
 * @param {GetAtmOptionReq} config Object: symbol string and window tuple [now + x, now + y] 
 * @example const config = {symbol:'AAPL', window:[7, 18]} 
 * // this will get atm AAPL options that expire between 7 and 18 (inclusive)
 * @returns {Promise<Array<GetAtmOptionRtn>>}
 */
export async function getAtmOptionData(config: GetAtmOptionReq): Promise<AtmOptionRtn[]> {

  const { symbol, window } = config;

  // Get expirations
  const expirations = await getOptionExpirations(config);
  const dateStrings = expirations.map(({ daysToExpiration, expirationDate }) => {
    if (daysToExpiration >= window[0] && daysToExpiration <= window[1]) {
      return expirationDate;
    }
  }).filter(Boolean);

  if (!dateStrings.length) return [];

  // Get underlying quote
  const rtn = await getQuote({ symbols: symbol, fields: 'quote' });

  // Calculating the mid between bid/ask
  const bid = rtn[0][symbol].quote?.bidPrice;
  const ask = rtn[0][symbol].quote?.askPrice;
  if (bid == null || ask == null) return [];
  const price = (bid + ask) / 2;

  // Get range of option expirations
  const fromDate = dateStrings[0];
  const toDate = dateStrings[dateStrings.length - 1];

  const strikes = await getOptionChain({ symbol, fromDate, toDate });

  const { callExpDateMap, putExpDateMap } = strikes[0];

  const callDateKeys = Object.keys(callExpDateMap) as Array<keyof typeof callExpDateMap>;
  const putDateKeys = Object.keys(putExpDateMap) as Array<keyof typeof putExpDateMap>;

  // Combine call/put data and expiration dates
  const optionData = [
    { dateKeys: callDateKeys, expirations: callExpDateMap },
    { dateKeys: putDateKeys, expirations: putExpDateMap },
  ];

  const atmOptionInfo: AtmOptionRtn[] = [];

  optionData.forEach(({ dateKeys, expirations }) => {
    for (const k of dateKeys) {
      const currOptionsArray = Object.keys(expirations[k]);

      // Binary search the closest strike to current price
      // closest strike is a key from currOptionsArray (and is a strike price)
      const closestStrike = _binarySearch(price, currOptionsArray);
      if (!closestStrike) continue;

      const {
        putCall: put_call,
        symbol,
        strikePrice: strike_price,
        volatility,
        vega,
        delta,
        gamma,
        theta,
        daysToExpiration: dte,
        openInterest,
        totalVolume,
        optionDeliverablesList
      } = expirations[k][closestStrike][0] as OptionQuote;

      atmOptionInfo.push({
        put_call,
        day_of_week: weekDays[(new Date().getDay() + dte) % 7] as AtmOptionRtn['day_of_week'],
        underlying: optionDeliverablesList[0].symbol || '',
        open_interest: openInterest,
        total_volume: totalVolume,
        symbol,
        dte,
        theta,
        strike_price,
        gamma,
        volatility,
        vega,
        delta
      });
    }
  });
  return atmOptionInfo as AtmOptionRtn[];
}

/**
 * Find options of a specific range of absDelta, delta, vega, theta, gamma, rho, or iv
 * absDelta is useful for finding all (e.g) delta 0.30 even though puts will have negative delta
 * @param {GreekFilterReq} config
 * @param {string} config.symbol Symbol of the underlying
 * @param {[number, number]} config.window DTE search window
 * @param {Object<Greeks,[number, number]>} config.greek Object with keys of greeks, iv, or absDelta with an inclusive value tuple of [min,max]
 * @param {'CALL'|'PUT'|'BOTH'} [config.side] Which option side to search
 * @param {number} [config.strikeCount] Optional number of strikes to include. Default is 20
 * @returns {Promise<GreekFilterRtn>}
 */
export async function greekFilter(config: GreekFilterReq) {
  const { symbol, window, greek, side = 'BOTH', strikeCount = 20 } = config;
  const maxWindow = addDays(Math.max(...window)) as ISODate;
  const minWindow = addDays(Math.min(...window)) as ISODate;

  // This will give us something like: ['delta','vega']
  const greekArray = Object.keys(greek);

  const optionConfig: OptionChainReq = {
    symbol,
    fromDate: minWindow,
    toDate: maxWindow,
    strikeCount,
  };

  const optionChain = await getOptionChain(optionConfig);
  if (!optionChain || !optionChain[0]) throw new Error(`No Options for ${symbol} found`);

  const { callExpDateMap, putExpDateMap } = optionChain[0];

  // Construct sides (call/put) based on 'side' argument
  const dateMaps = [
    ...[(side === 'CALL' || side === 'BOTH') ? callExpDateMap : null],
    ...[(side === 'PUT' || side === 'BOTH') ? putExpDateMap : null]
  ].filter(Boolean);

  const matchingStrikes: GreekFilterRtn[] = [];

  // This will iterate 2x at most (if side === 'BOTH')
  const minDte = Math.min(...window);
  const maxDte = Math.max(...window);

  for (const dateMap of dateMaps) {
    const optionKeys = Object.keys(dateMap!);
    const flatExpirations: OptionQuote[] = [];

    for (const key of optionKeys) {
      const expiration = dateMap![key as keyof typeof dateMap];
      const strikeKey = Object.keys(expiration);
      for (const k of strikeKey) {
        flatExpirations.push(expiration[k][0]);
      }
    }

    for (const strike of flatExpirations) {
      // Enforce the DTE window explicitly
      if (strike.daysToExpiration < minDte || strike.daysToExpiration > maxDte) continue;

      const passesAllGreeks = greekArray.every((g) => {
        // We want to pull in the associated values before we reassign the variable
        const greekRange = greek[g as keyof typeof greek] as [number, number];
        if (!greekRange) return true;

        // Deterministically finding range min/max
        const maxGreekRange = Math.max(...greekRange);
        const minGreekRange = Math.min(...greekRange);

        let quoteKey: keyof OptionQuote;
        // Keep transform as a neutral passthrough unless needed
        let transform: (v: number) => number = (v) => v;

        if (g === 'absDelta') {
          quoteKey = 'delta';
          transform = Math.abs;
        } else if (g === 'iv') {
          quoteKey = 'volatility';
        } else {
          quoteKey = g as keyof OptionQuote;
        }

        // We have greekValue here b/c our initial naming might be, say, 'iv', which is not
        // a key in the strike. So we change it to 'volatility'. If this is above the conditional,
        // we'd never find 'volatility' because the argument is 'iv'. (this is done this way so we 
        // can extend it in the future— with, say, realized volatility)
        const rawGreekValue = strike[quoteKey as keyof OptionQuote] as number;
        const greekValue = transform(rawGreekValue);
        return greekValue >= minGreekRange && greekValue <= maxGreekRange;
      });

      if (!passesAllGreeks) continue;

      const date_of_expiry = addDays(strike.daysToExpiration);
      const day_of_week = weekDays[new Date(date_of_expiry).getDay()] as AtmOptionRtn['day_of_week'];

      matchingStrikes.push({
        put_call: strike.putCall,
        underlying: symbol,
        symbol: strike.symbol,
        dte: strike.daysToExpiration,
        total_volume: strike.totalVolume,
        open_interest: strike.openInterest,
        day_of_expiry: day_of_week,
        theta: strike.theta,
        strike_price: strike.strikePrice,
        gamma: strike.gamma,
        volatility: strike.volatility,
        vega: strike.vega,
        delta: strike.delta,
        rho: strike.rho
      });
    }
  }
  return matchingStrikes;
}

/** Find the closest strike to our Mark price */
function _binarySearch(target: number, searchArray: string[]) {
  if (searchArray.length === 0) return undefined;
  if (target <= +searchArray[0]) return searchArray[0];
  let l = 0;
  let r = searchArray.length - 1;

  while (l < r) {
    const mid = Math.floor((l + r) / 2);

    if (+searchArray[mid] === target) {
      return searchArray[mid];
    }

    if (target < +searchArray[mid]) {
      r = mid;
    } else {
      l = mid + 1;
    }
  }

  if (Math.abs(+searchArray[l] - target) < Math.abs(+searchArray[l - 1] - target)) {
    return searchArray[l];
  } else {
    return searchArray[l - 1];
  }
}
