import * as z from 'zod';
import { getQuote } from '../../market-data/get-quote/index.js';
import { getOptionChain } from '../get-option-chain/index.js';
import type { OptionQuote } from '../get-option-chain/schema.js';
import { getOptionExpirations } from '../get-option-expirations/index.js';
import {
  type GetAtmOptionRequest,
  GetAtmOptionRequestSchema,
  type GetAtmOptionReturn,
  type OptionReturn,
  OptionReturnArraySchema,
} from './schema.js';

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THR', 'FRI', 'SAT'] as const;

export async function getAtmOptionData(config: GetAtmOptionRequest): Promise<GetAtmOptionReturn | undefined> {
  const result = GetAtmOptionRequestSchema.safeParse(config);

  if (!result.success) {
    console.error(JSON.stringify(z.treeifyError(result.error), undefined, 1));
    return;
  }

  const { symbol, window } = config;

  const expirations = await getOptionExpirations(config);
  if (!expirations) return [];

  const dateStrings = expirations.flatMap((e) => {
    if (!e) return [];
    if (e.daysToExpiration >= Math.min(...window) && e.daysToExpiration <= Math.max(...window)) {
      return [e.expirationDate];
    }
    return [];
  });

  if (!dateStrings.length) return [];

  const rtn = await getQuote({ symbols: symbol, fields: 'quote' });
  const bid = rtn[symbol].quote?.bidPrice;
  const ask = rtn[symbol].quote?.askPrice;
  if (bid == null || ask == null) return [];
  const price = (bid + ask) / 2;

  const fromDate = dateStrings[0];
  const toDate = dateStrings[dateStrings.length - 1];
  const strikes = await getOptionChain({ symbol, fromDate, toDate });

  if (!strikes?.callExpDateMap && !strikes?.putExpDateMap) return [];

  const { callExpDateMap, putExpDateMap } = strikes;
  const callDateKeys = Object.keys(callExpDateMap) as Array<keyof typeof callExpDateMap>;
  const putDateKeys = Object.keys(putExpDateMap) as Array<keyof typeof putExpDateMap>;

  const optionData = [
    { dateKeys: callDateKeys, expirations: callExpDateMap },
    { dateKeys: putDateKeys, expirations: putExpDateMap },
  ];

  const atmOptionInfo: GetAtmOptionReturn = [];

  optionData.forEach(({ dateKeys, expirations }) => {
    for (const k of dateKeys) {
      const currOptionsArray = Object.keys(expirations[k]);
      const closestStrike = binarySearch(price, currOptionsArray);
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
        rho,
        daysToExpiration: dte,
        openInterest,
        totalVolume,
        optionDeliverablesList,
      } = expirations[k][closestStrike][0] as OptionQuote;

      atmOptionInfo.push({
        put_call,
        day_of_expiry: weekDays[(new Date().getDay() + dte) % 7] as OptionReturn['day_of_expiry'],
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
        delta,
        rho,
      });
    }
  });

  return OptionReturnArraySchema.parse(atmOptionInfo) ?? [];
}

function binarySearch(target: number, searchArray: string[]) {
  if (searchArray.length === 0) return undefined;
  if (target <= +searchArray[0]) return searchArray[0];
  let l = 0;
  let r = searchArray.length - 1;

  while (l < r) {
    const mid = Math.floor((l + r) / 2);
    if (+searchArray[mid] === target) return searchArray[mid];

    if (target < +searchArray[mid]) {
      r = mid;
    } else {
      l = mid + 1;
    }
  }

  if (Math.abs(+searchArray[l] - target) < Math.abs(+searchArray[l - 1] - target)) {
    return searchArray[l];
  }
  return searchArray[l - 1];
}
