import { greekFilter } from "./marketData/derivatives.js";
import { GreekFilterReq } from "./types.js";

/* To run smoke test: RUN_LIVE_TESTS=1 npm run test:live:smoke */
export * from "./types.js";
// export * from "./helpers.js";

export * from "./oauth/schwabAuth.js";
// export * from "./oauth/tokenStore.js";
// export * from "./oauth/server.js";
// export * from "./oauth/defaultAuth.js";

// export * from "./marketData/request.js";
export * from "./marketData/quotes.js";
export * from "./marketData/derivatives.js";
export * from "./marketData/highLevelData.js";


(async function () {
  const config: GreekFilterReq = {
    symbol: 'AAPL',
    window: [0, 4],
    greek: { 'absDelta': [0.40, 0.65] }
  };
  const a = await greekFilter(config);
  console.log(JSON.stringify(a,undefined,1))
})();