import process from "node:process";
import { SchwabAuth } from "./oauth/schwabAuth.js";
import { getPriceHistory, getQuote } from "./marketData/quotes.js";
import { ChartRequest, OptionChainReq } from "./types.js";
import { getAtmOptionData, getOptionChain, getOptionExpirations, greekFilter } from "./marketData/derivatives.js";

process.loadEnvFile('.env');

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/**
 * Centrally located accessor to auth logic
 */
export const auth = new SchwabAuth({
  clientId: reqEnv("SCHWAB_CLIENT_ID"),
  clientSecret: reqEnv("SCHWAB_CLIENT_SECRET"),
  redirectUri: reqEnv("SCHWAB_REDIRECT_URI")
});

async function main() {

  // // const token = await auth.getAuth();
  // const config: ChartRequest = {
  //   symbol: 'AAPL',
  //   periodType: 'day',
  //   period: 5,
  //   frequencyType: 'minute',
  //   frequency: 5,
  //   startDate:'2020-10-01'
  // };
  // getPriceHistory(config);


  // const optionConfig: OptionChainReq = {
  //   symbol: 'AMZN',

  //   fromDate: '2026-02-09',
  //   toDate: '2026-02-20',

  //   strikeCount: 3,
  // };

  // const gf = await greekFilter('AAPL', [1, 19], { absDelta: [0.38, 0.52], }, 'BOTH');
  // console.log(gf);
  // const opChain = await getOptionChain(optionConfig);
  // console.log(opChain[0].callExpDateMap);
  // getQuote({ symbols: 'Q' });
  // const op = await getOptionExpirations({ symbol: 'AMZN' });
  // console.log(op)
  const config: ChartRequest = {
    symbol: 'AAPL',
    periodType: 'year'
  };
  const p = await getPriceHistory(config);
  console.log(JSON.stringify(p, undefined, 1));

  // const a = await getAtmOptionData({ symbol: 'AAPL', window: [7, 12] });
  // console.log(a)
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

