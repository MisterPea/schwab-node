import * as z from 'zod';
import { addDays } from '../../helpers.js';
import { getOptionChain } from '../get-option-chain/index.js';
import type { OptionChainRequest, OptionQuote } from '../get-option-chain/schema.js';
import { type OptionReturn, OptionReturnArraySchema } from '../get-atm-option-data/schema.js';
import {
  type GreekFilterRequest,
  GreekFilterRequestSchema,
  type GreekFilterReturn,
} from './schema.js';

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THR', 'FRI', 'SAT'] as const;

export async function greekFilter(config: GreekFilterRequest): Promise<GreekFilterReturn> {
  const result = GreekFilterRequestSchema.safeParse(config);

  if (!result.success) {
    console.error(JSON.stringify(z.treeifyError(result.error), undefined, 1));
    return [];
  }

  const { symbol, window, greek, side = 'BOTH', strikeCount = 20 } = config;
  const maxWindow = addDays(Math.max(...window));
  const minWindow = addDays(Math.min(...window));
  const greekArray = Object.keys(greek);

  const optionConfig: OptionChainRequest = {
    symbol,
    fromDate: minWindow,
    toDate: maxWindow,
    strikeCount,
  };

  const optionChain = await getOptionChain(optionConfig);
  if (!optionChain) throw new Error(`No Options for ${symbol} found`);

  const { callExpDateMap, putExpDateMap } = optionChain;
  const dateMaps = [
    ...[(side === 'CALL' || side === 'BOTH') ? callExpDateMap : null],
    ...[(side === 'PUT' || side === 'BOTH') ? putExpDateMap : null],
  ].filter(Boolean);

  const matchingStrikes: GreekFilterReturn = [];
  const minDte = Math.min(...window);
  const maxDte = Math.max(...window);

  for (const dateMap of dateMaps) {
    if (!dateMap) continue;
    const optionKeys = Object.keys(dateMap);
    const flatExpirations: OptionQuote[] = [];

    for (const key of optionKeys) {
      const expiration = dateMap[key as keyof typeof dateMap];
      const strikeKey = Object.keys(expiration);
      for (const k of strikeKey) {
        flatExpirations.push(expiration[k][0]);
      }
    }

    for (const strike of flatExpirations) {
      if (strike.daysToExpiration < minDte || strike.daysToExpiration > maxDte) continue;

      const passesAllGreeks = greekArray.every((g) => {
        const greekRange = greek[g as keyof typeof greek] as [number, number];
        if (!greekRange) return true;

        const maxGreekRange = Math.max(...greekRange);
        const minGreekRange = Math.min(...greekRange);

        let quoteKey: keyof OptionQuote;
        let transform: (v: number) => number = (v) => v;

        if (g === 'absDelta') {
          quoteKey = 'delta';
          transform = Math.abs;
        } else if (g === 'iv') {
          quoteKey = 'volatility';
        } else {
          quoteKey = g as keyof OptionQuote;
        }

        const rawGreekValue = strike[quoteKey as keyof OptionQuote] as number;
        const greekValue = transform(rawGreekValue);
        return greekValue >= minGreekRange && greekValue <= maxGreekRange;
      });

      if (!passesAllGreeks) continue;

      const date_of_expiry = addDays(strike.daysToExpiration);
      const day_of_expiry = weekDays[new Date(date_of_expiry).getDay()];

      matchingStrikes.push({
        put_call: strike.putCall,
        underlying: symbol,
        symbol: strike.symbol,
        dte: strike.daysToExpiration,
        total_volume: strike.totalVolume,
        open_interest: strike.openInterest,
        day_of_expiry: day_of_expiry as OptionReturn['day_of_expiry'],
        theta: strike.theta,
        strike_price: strike.strikePrice,
        gamma: strike.gamma,
        volatility: strike.volatility,
        vega: strike.vega,
        delta: strike.delta,
        rho: strike.rho,
      });
    }
  }

  return OptionReturnArraySchema.parse(matchingStrikes) ?? [];
}
