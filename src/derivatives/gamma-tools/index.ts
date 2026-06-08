import { getOptionChain } from "../get-option-chain/index.js";
import { getOptionExpirations } from "../get-option-expirations/index.js";
import type { GammaOptionElement } from "./schema.js";

async function getOptionWindow(symbol: string, startDte: number, endDte: number): Promise<string[]> {
  const expirations = await getOptionExpirations({ symbol });
  if (!expirations) return [];

  const dateStrings = expirations.flatMap((e) => {
    if (!e) return [];
    if (e.daysToExpiration >= startDte && e.daysToExpiration <= endDte) {
      return [e.expirationDate];
    }
    return [];
  });
  if (!dateStrings.length) return [];

  return [dateStrings[0], dateStrings[dateStrings.length - 1]];
}

function getDateBucket(dte: number): GammaOptionElement["dteBucket"] {
  if (dte === 0) return "0DTE";
  if (dte < 8) return "1-7DTE";
  if (dte < 31) return "8-30DTE";
  if (dte < 91) return "31-90DTE";
  return "90DTE+";
}

function unpackOptionObjectArray(
  dateKeys: string[],
  options: any,
  underlyingPrice: number,
  symbol: string,
): GammaOptionElement[] {
  const output: GammaOptionElement[] = [];
  dateKeys.forEach((k) => {
    const optionDataByDate = options[k];
    const strikes = Object.keys(optionDataByDate);

    for (const s of strikes) {
      const perStrikeData = optionDataByDate[s][0];
      const onePercentMove = underlyingPrice * 0.01;

      const perContractGammaExposure =
        perStrikeData.gamma * perStrikeData.multiplier * underlyingPrice * onePercentMove;

      const unsignedStrikeGammaExposure = perContractGammaExposure * perStrikeData.openInterest;

      const sign = perStrikeData.putCall === "CALL" ? 1 : -1;
      const signedStrikeGammaExposure = unsignedStrikeGammaExposure * sign;

      const perContractGEX =
        perStrikeData.gamma * perStrikeData.multiplier * underlyingPrice * underlyingPrice * 0.01;

      const direction = perStrikeData.putCall === "PUT" ? 1 : -1;
      const distanceFromSpot = (+s - underlyingPrice) * direction;
      const moneynessType: GammaOptionElement["moneynessType"] =
        distanceFromSpot > 0 && distanceFromSpot < 1
          ? "NTM"
          : distanceFromSpot >= 1
            ? "ITM"
            : "OTM";

      const optionStrikeData: GammaOptionElement = {
        underlyingSymbol: symbol,
        underlyingPrice,
        strike: +s,
        distanceFromSpotPct:
          Math.trunc(((+s - underlyingPrice) / underlyingPrice) * 10000) / 10000,
        distanceFromSpot: +s - underlyingPrice,
        moneynessType,
        optionType: perStrikeData.putCall,
        bid: perStrikeData.bid,
        ask: perStrikeData.ask,
        mark: perStrikeData.mark,
        last: perStrikeData.last,
        dte: perStrikeData.daysToExpiration,
        dteBucket: getDateBucket(perStrikeData.daysToExpiration),
        delta: perStrikeData.delta,
        gamma: perStrikeData.gamma,
        signedStrikeGEX: signedStrikeGammaExposure,
        perContractGEX,
        impliedVolatility: perStrikeData.volatility / 100,
        openInterest: perStrikeData.openInterest,
        multiplier: perStrikeData.multiplier,
        expiration: perStrikeData.expirationDate.split("T")[0],
      };
      output.push(optionStrikeData);
    }
  });
  return output;
}

export async function getGammaExposure(
  symbol: string,
  startDte: number,
  endDte: number,
): Promise<GammaOptionElement[]> {
  const dates = await getOptionWindow(symbol, startDte, endDte);
  if (!dates.length) return [];

  const strikes = await getOptionChain({
    symbol,
    fromDate: dates[0],
    toDate: dates[1],
    contractType: "ALL",
  });
  if (!strikes) return [];

  const { callExpDateMap, putExpDateMap, underlyingPrice } = strikes;
  const callDateKeys = Object.keys(callExpDateMap) as Array<keyof typeof callExpDateMap>;
  const putDateKeys = Object.keys(putExpDateMap) as Array<keyof typeof putExpDateMap>;

  const calls = unpackOptionObjectArray(callDateKeys, callExpDateMap, underlyingPrice, symbol);
  const puts = unpackOptionObjectArray(putDateKeys, putExpDateMap, underlyingPrice, symbol);

  return [...calls, ...puts];
}
