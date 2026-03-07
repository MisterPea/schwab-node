# Schwab Interface for Node.js 💵

A Node.js wrapper for Schwab's APIs with OAuth, market data, account endpoints, options helpers, and streaming support.

![Node](https://img.shields.io/badge/node-%3E%3D20.6.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Quickstart

### 1. Install

```bash
npm install @misterpea/schwab-node
```

### 2. Create `.env`

Visit `https://developer.schwab.com`, create an app, then add these variables to your project root:

```bash
SCHWAB_CLIENT_SECRET=A1B2C3D4E5F6G7H8
SCHWAB_CLIENT_ID=ABCDEFGHIJKLMNOPQRSTUVWXZY123456
SCHWAB_REDIRECT_URI=https://127.0.0.1:8443
```

The redirect URI must be local HTTPS with an explicit port.

### 3. Generate local callback certs

```bash
npx schwab-node-certs --callback https://127.0.0.1:8443
```

The cert script prefers `mkcert` when available and falls back to `openssl` otherwise.

### 4. Make a request

```typescript
import { getQuote } from "@misterpea/schwab-node";

const quote = await getQuote({
  symbols: ["AAPL"],
  fields: "quote",
});

console.log(quote.AAPL?.quote?.lastPrice);
```

### 5. Start streaming

Streaming subscriptions are delivered locally through ZeroMQ. `SchwabStreamer` maintains the Schwab WebSocket connection, then publishes normalized messages that local subscribers can consume.

```typescript
import { SchwabStreamer, createSubscriber, listen } from "@misterpea/schwab-node";

const streamer = new SchwabStreamer();
await streamer.connect();
await streamer.login();

const subscriber = await createSubscriber("tcp://localhost:5555", ["schwab"]);
await listen(subscriber, (topic, message) => {
  console.log(topic, message);
});

await streamer.subsL1Equities({
  keys: ["AAPL"],
  fields: ["symbol", "bidPrice", "askPrice", "lastPrice", "quoteTime"],
});
```

Setup notes:
- Default authenticated requests load credentials from `.env`.
- Tokens and callback metadata are stored under `.secrets/`.
- The cert setup command also saves the callback URL and adds `.secrets/` to `.gitignore`.

## Main Surfaces

### Request helpers

Import from the package root for the main request/response API:

```typescript
import {
  getQuote,
  getPriceHistory,
  getMovers,
  getMarketHours,
  getOptionChain,
  getOptionExpirations,
  getAtmOptionData,
  greekFilter,
  getAccounts,
  getAccountNumbers,
  getUserPreference,
} from "@misterpea/schwab-node";
```

| Export | Description | Returns |
| --- | --- | --- |
| `getQuote(config)` | Quote and/or fundamentals for one or more symbols | `Promise<GetQuotesResponse>` |
| `getPriceHistory(config)` | Price history candles for a symbol | `Promise<GetPriceHistoryResponse \| undefined>` |
| `getMovers(config)` | Top movers for an index | `Promise<ScreenersResponse>` |
| `getMarketHours(config)` | Market hours for one or more markets | `Promise<MarketHoursRtn[]>` |
| `getOptionChain(config)` | Option chain keyed by expiration and strike | `Promise<GetOptionChainReturn \| undefined>` |
| `getOptionExpirations(config)` | Available expirations for a symbol | `Promise<OptionExpirationReturn \| undefined>` |
| `getAtmOptionData(config)` | Near-the-money options in an inclusive DTE window | `Promise<GetAtmOptionReturn \| undefined>` |
| `greekFilter(config)` | Options filtered by DTE and Greek ranges | `Promise<GreekFilterReturn>` |
| `getAccounts()` | Account info including balances and buying power | `Promise<AccountsResponse>` |
| `getAccountNumbers()` | Account numbers and their encrypted values | `Promise<UserAccountNumbers>` |
| `getUserPreference()` | Account and streamer metadata | `Promise<UserPreferenceResponse>` |

Validation notes:
- `getPriceHistory()`, `getOptionChain()`, `getOptionExpirations()`, and `getAtmOptionData()` validate request input before calling Schwab.
- When validation fails, those functions log a validation tree and return `undefined`.
- `greekFilter()` returns an empty array on invalid filter input.
- Successful responses are parsed before being returned.

### Streaming client

Use `SchwabStreamer` when you want live subscriptions. The package uses ZeroMQ as the local delivery layer: `SchwabStreamer` handles the Schwab WebSocket session and publishes messages that your local subscriber consumes.

```typescript
import { SchwabStreamer, createSubscriber, listen } from "@misterpea/schwab-node";
```

Simple flow:
1. `new SchwabStreamer()`
2. `await streamer.connect()`
3. `await streamer.login()`
4. connect a local ZeroMQ subscriber
5. subscribe with one of the `subs...` methods

The main README focuses on the subscription surface. Transport details and field maps are lower in the document.

### Explicit auth

Use `SchwabAuth` when you want direct control over token lifecycle instead of relying on default `.env` loading.

```typescript
import { SchwabAuth } from "@misterpea/schwab-node";
```

## Request API

### `getQuote()`

```typescript
import { getQuote, GetQuoteRequest } from "@misterpea/schwab-node";

const config: GetQuoteRequest = {
  symbols: ["AAPL", "NVDA"],
  fields: "fundamental",
};

const quote = await getQuote(config);
```

Example response shape:

```typescript
{
  AAPL: {
    symbol: "AAPL",
    assetMainType: "EQUITY",
    fundamental: {
      peRatio: 33.01258,
      eps: 7.46,
      sharesOutstanding: 14681140000,
    },
  },
  NVDA: {
    symbol: "NVDA",
    assetMainType: "EQUITY",
    fundamental: {
      peRatio: 37.41633,
      eps: 4.9,
      sharesOutstanding: 24296000000,
    },
  },
}
```

### `getPriceHistory()`

```typescript
import { getPriceHistory, GetPriceHistoryRequest } from "@misterpea/schwab-node";

const config: GetPriceHistoryRequest = {
  symbol: "GILD",
  periodType: "month",
  period: 1,
  frequencyType: "daily",
  frequency: 1,
};

const priceHistory = await getPriceHistory(config);
```

Example response shape:

```typescript
{
  symbol: "GILD",
  empty: false,
  candles: [
    {
      open: 146.5,
      high: 150.5,
      low: 145.87,
      close: 149.37,
      volume: 9143045,
      datetime: 1770271200000,
    },
    {
      open: 149.69,
      high: 153.13,
      low: 148.7082,
      close: 152.5,
      volume: 8510037,
      datetime: 1770357600000,
    },
  ],
}
```

### `getMovers()`

```typescript
import { getMovers, GetMoversConfig } from "@misterpea/schwab-node";

const config: GetMoversConfig = {
  index: "$SPX",
  sort: "PERCENT_CHANGE_DOWN",
};

const spxMovers = await getMovers(config);
```

Example response shape:

```typescript
[
  {
    symbol: "NVDA",
    description: "NVIDIA CORP",
    lastPrice: 177.82,
    netChange: -5.52,
    netPercentChange: -0.0301,
  },
]
```

### `getMarketHours()`

```typescript
import { getMarketHours, GetMarketHoursConfig } from "@misterpea/schwab-node";

const config: GetMarketHoursConfig = {
  markets: ["equity", "option"],
  date: "2026-03-11",
};

const hours = await getMarketHours(config);
```

Example response shape:

```typescript
[
  {
    date: "2026-03-11",
    marketType: "EQUITY",
    isOpen: true,
    sessionHours: {
      regularMarket: [
        {
          start: "2026-03-11T09:30:00-04:00",
          end: "2026-03-11T16:00:00-04:00",
        },
      ],
    },
  },
]
```

### `getOptionChain()`

```typescript
import { getOptionChain, GetOptionChainRequest } from "@misterpea/schwab-node";

const config: GetOptionChainRequest = {
  symbol: "AAPL",
  contractType: "CALL",
  strikeCount: 2,
  fromDate: "2026-03-09",
  toDate: "2026-03-10",
};

const optionChain = await getOptionChain(config);
```

Example response shape:

```typescript
{
  symbol: "AAPL",
  status: "SUCCESS",
  underlyingPrice: 257.35,
  callExpDateMap: {
    "2026-03-09:3": {
      "255.0": [
        {
          putCall: "CALL",
          symbol: "AAPL  260309C00255000",
          bid: 3.6,
          ask: 3.75,
          strikePrice: 255,
          delta: 0.664,
        },
      ],
    },
  },
  putExpDateMap: {},
}
```

### `getOptionExpirations()`

```typescript
import { getOptionExpirations, OptionExpirationRequest } from "@misterpea/schwab-node";

const expirations = await getOptionExpirations({
  symbol: "AAPL",
});
```

Example response shape:

```typescript
[
  {
    expirationDate: "2026-03-13",
    daysToExpiration: 7,
    expirationType: "W",
    settlementType: "P",
  },
]
```

### `getAtmOptionData()`

```typescript
import { getAtmOptionData, GetAtmOptionRequest } from "@misterpea/schwab-node";

const config: GetAtmOptionRequest = {
  symbol: "AAPL",
  window: [7, 21],
};

const atmData = await getAtmOptionData(config);
```

Example response shape:

```typescript
[
  {
    put_call: "CALL",
    day_of_expiry: "FRI",
    underlying: "AAPL",
    symbol: "AAPL  260313C00257500",
    dte: 7,
    strike_price: 257.5,
    delta: 0.501,
    bid: 4.3,
    ask: 4.85,
  },
]
```

### `greekFilter()`

```typescript
import { greekFilter, GreekFilterRequest } from "@misterpea/schwab-node";

const config: GreekFilterRequest = {
  symbol: "GILD",
  window: [14, 21],
  greek: {
    iv: [29, 30],
    vega: [0.05, 0.15],
    absDelta: [0.35, 0.49],
  },
};

const filtered = await greekFilter(config);
```

Example response shape:

```typescript
[
  {
    put_call: "CALL",
    day_of_expiry: "THR",
    underlying: "GILD",
    symbol: "GILD  260320C00144000",
    dte: 14,
    strike_price: 144,
    volatility: 29.438,
    vega: 0.11,
    delta: 0.471,
  },
]
```

## Account API

### `getAccounts()`

```typescript
import { getAccounts } from "@misterpea/schwab-node";

const accounts = await getAccounts();
```

Example response shape:

```typescript
[
  {
    securitiesAccount: {
      type: "MARGIN",
      accountNumber: "12345678",
      currentBalances: {
        liquidationValue: 100000.75,
        buyingPower: 100000,
        cashBalance: 100000.5,
      },
    },
    aggregatedBalance: {
      liquidationValue: 100000.75,
    },
  },
]
```

### `getAccountNumbers()`

```typescript
import { getAccountNumbers } from "@misterpea/schwab-node";

const accountNumbers = await getAccountNumbers();
```

Example response shape:

```typescript
[
  {
    accountNumber: "12345678",
    hashValue: "0123456789ABCDEFGH01234567890123456789ABCDEFGH0123456789",
  },
]
```

### `getUserPreference()`

```typescript
import { getUserPreference } from "@misterpea/schwab-node";

const userPreference = await getUserPreference();
```

Example response shape:

```typescript
{
  accounts: [
    {
      accountNumber: "12345678",
      type: "BROKERAGE",
      displayAcctId: "...678",
    },
  ],
  streamerInfo: [
    {
      streamerSocketUrl: "wss://streamer-api.schwab.url/websocket",
      schwabClientChannel: "A1",
      schwabClientFunctionId: "APIAPP",
    },
  ],
  offers: [
    {
      level2Permissions: true,
      mktDataPermission: "NP",
    },
  ],
}
```

## Streaming API

Get streaming data from Schwab through the Streaming API.

- The WebSocket streamer uses [ZeroMQ](https://zeromq.org) to handle message delivery. This allows users to consume the streaming data with components built in any language that has ZeroMQ bindings.



### Basic subscription flow

```typescript
import { SchwabStreamer, createSubscriber, listen } from "@misterpea/schwab-node";

const streamer = new SchwabStreamer();

await streamer.connect();
await streamer.login();

const subscriber = await createSubscriber("tcp://localhost:5555", ["schwab"]);
await listen(subscriber, (topic, message) => {
  console.log(topic, message);
});

await streamer.subsL1Equities({
  keys: ["AAPL"],
  fields: ["symbol", "bidPrice", "askPrice", "lastPrice", "quoteTime"],
});
```

Common subscription entry points:
- `subsL1Equities`
- `subsL1Options`
- `subsL1Futures`
- `subsL1FuturesOptions`
- `subsL1Forex`
- `subsL2NyseBook`
- `subsL2NasdaqBook`
- `subsL2OptionsBook`
- `subsChartEquity`
- `subsChartFutures`
- `subsScreenerEquity`
- `subsScreenerOption`
- `subsAcctActivity`

If you want the transport details, field maps, or raw adapter helpers, they are documented below.

<details>
<summary>Advanced Streaming</summary>

The WebSocket streamer uses [ZeroMQ](https://zeromq.org/) for local message delivery. By default, the publish side binds on `tcp://*:5555`, and the package exports helpers for local subscribers.

```typescript
import { createSubscriber, listen } from "@misterpea/schwab-node";

const subscriber = await createSubscriber("tcp://localhost:5555", ["schwab"]);
await listen(subscriber, (topic, message) => {
  console.log(topic, message);
});
```

Field-map helpers are also exported for users building adapters on top of raw streamer payloads:
- `LEVELONE_EQUITIES_FIELDS`
- `LEVELONE_OPTIONS_FIELDS`
- `LEVELONE_FUTURES_FIELDS`
- `LEVELONE_FUTURES_OPTIONS_FIELDS`
- `LEVELONE_FOREX_FIELDS`
- `BOOK_FIELDS`
- `BOOK_PRICE_LEVEL_FIELDS`
- `BOOK_MARKET_MAKER_FIELDS`
- `CHART_EQUITY_FIELDS`
- `CHART_FUTURES_FIELDS`
- `SCREENER_FIELDS`
- `ACCT_ACTIVITY_FIELDS`
- inverse maps and resolver helpers such as `resolveFieldIds()` and `resolveFieldNames()`

Example:

```typescript
import {
  LEVELONE_FUTURES_FIELDS,
  SchwabStreamer,
} from "@misterpea/schwab-node";

const streamer = new SchwabStreamer();

await streamer.connect();
await streamer.login();

await streamer.subsL1Futures({
  keys: ["/ESH26"],
  fields: ["symbol", "bidPrice", "askPrice", "lastPrice", "quoteTime"],
});

console.log(LEVELONE_FUTURES_FIELDS["10"]); // "quoteTime"
```
</details>

## Explicit Auth

Most users can rely on default auth loaded from `.env`. Use `SchwabAuth` directly when you want to control token acquisition and refresh explicitly.

```typescript
import { SchwabAuth } from "@misterpea/schwab-node";

process.loadEnvFile(".env");

function reqEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const auth = new SchwabAuth({
  clientId: reqEnv("SCHWAB_CLIENT_ID"),
  clientSecret: reqEnv("SCHWAB_CLIENT_SECRET"),
  redirectUri: reqEnv("SCHWAB_REDIRECT_URI"),
});

const tokenInfo = await auth.getAuth();
```

Token shape:

```json
{
  "expires_in": 1800,
  "token_type": "Bearer",
  "scope": "api",
  "refresh_token": "bbbbbb-aaaaaa-zzzzzzz_yyyyyyy-xxxxx@",
  "access_token": "I0.aaaaaa.bbbbbb_cccccc@",
  "id_token": "abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz.abcdefghijklm-nopqrstuvwxyz",
  "obtained_at": 946684800000,
  "refresh_obtained_at": 946684800000
}
```

## Import Paths

The package root is the recommended import path for most users.

```typescript
import {
  getQuote,
  getPriceHistory,
  getOptionChain,
  getAccounts,
  SchwabAuth,
  SchwabStreamer,
} from "@misterpea/schwab-node";
```

<details>
<summary>Namespace subpaths</summary>

Use subpaths when you want a namespace boundary in your imports:

```typescript
import { getQuote, getPriceHistory } from "@misterpea/schwab-node/market-data";
import { getOptionChain, greekFilter } from "@misterpea/schwab-node/derivatives";
import { getAccounts } from "@misterpea/schwab-node/account";
import { SchwabAuth } from "@misterpea/schwab-node/oauth/schwabAuth";
import { createSubscriber, listen } from "@misterpea/schwab-node/streaming/zmq";
```
</details>

<details>
<summary>Legacy import routes</summary>

The package now uses kebab-case namespace paths such as `market-data`.

Legacy import routes still resolve for compatibility, but they emit a one-time `DeprecationWarning` telling callers which path to move to.

| Legacy import | Use instead |
| --- | --- |
| `@misterpea/schwab-node/marketData/quotes` | `@misterpea/schwab-node/market-data` |
| `@misterpea/schwab-node/marketData/highLevelData` | `@misterpea/schwab-node/market-data` |
| `@misterpea/schwab-node/marketData/derivatives` | `@misterpea/schwab-node/derivatives` |
| `@misterpea/schwab-node/marketData/request` | `@misterpea/schwab-node/scripts/request` |

Compatibility notes:
- `marketData/quotes` keeps the old array-wrapped quote and price-history envelope.
- `marketData/highLevelData` keeps the old movers envelope of `{ screeners: [...] }[]`.
- `marketData/derivatives` keeps the old array-wrapped option-chain shape and maps ATM output back to `day_of_week`.
</details>

## Feedback & Requests

Found a bug or have a feature request?
Please open an issue using the Issue Form:
https://github.com/MisterPea/schwab-node/issues/new/choose

## Upcoming Releases
Planned features currently in development:

- Expand coverage for remaining account endpoints
- Add historical replay support through the ZeroMQ stream
- Improve ZeroMQ adapter routing and message filtering
- Refine and expand documentation

## AI Assistance Disclosure

AI tooling (OpenAI Codex) was used as a development assistant for:
- Identifying potential bugs and edge cases
- Strengthening the authentication flow
- Assisting with test development and validation

All core architecture, implementation, and final code decisions were written and reviewed by the project author.
