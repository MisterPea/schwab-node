# Schwab Interface for Node.js 💵

A Node.js wrapper for Schwab's Market Data API with OAuth, accounts, quotes, price history, market hours, movers, and options helpers.

![Node](https://img.shields.io/badge/node-%3E%3D20.6.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Installation

Install the package in your project:

```bash
npm install @misterpea/schwab-node
```

## Setup

1. Visit `https://developer.schwab.com`, create an account, and register your app.
2. Add an `.env` file to your project root:

```bash
SCHWAB_CLIENT_SECRET=A1B2C3D4E5F6G7H8
SCHWAB_CLIENT_ID=ABCDEFGHIJKLMNOPQRSTUVWXZY123456
SCHWAB_REDIRECT_URI=https://127.0.0.1:PORT
```

Notes:

- Use the exact environment variable names above.
- The redirect URI currently needs to be a localhost HTTPS address with an explicit port.

3. Generate local certs for the OAuth callback:

```bash
npx schwab-node-certs --callback https://my-redirect:port
```

The cert script prefers `mkcert` when available and falls back to `openssl` if `mkcert` is not installed.

## Import Paths

Import from the package root when you want the main public surface:

```typescript
import {
  getPriceHistory,
  getQuote,
  getOptionChain,
  getOptionExpirations,
  getAtmOptionData,
  greekFilter,
  getMovers,
  getMarketHours,
  getAccountNumbers,
  getAccounts,
  getUserPreference,
  SchwabAuth,
} from "@misterpea/schwab-node";
```

You can also import from namespace subpaths:

```typescript
import { getQuote, getPriceHistory } from "@misterpea/schwab-node/market-data";
import { getOptionChain, greekFilter } from "@misterpea/schwab-node/derivatives";
import { getAccounts } from "@misterpea/schwab-node/account";
import { SchwabAuth } from "@misterpea/schwab-node/oauth/schwabAuth";
```

## API

| Export | Description | Returns |
| --- | --- | --- |
| `getPriceHistory(config)` | Price history candles for a symbol | `Promise<GetPriceHistoryResponse \| undefined>` |
| `getQuote(config)` | Quote and/or fundamentals for one or more symbols | `Promise<GetQuotesResponse>` |
| `getMovers(config)` | Movers for an index or screener | `Promise<ScreenersResponse>` |
| `getMarketHours(config)` | Market hours for one or more markets | `Promise<MarketHoursRtn[]>` |
| `getOptionChain(config)` | Option chain keyed by expiration and strike | `Promise<GetOptionChainReturn \| undefined>` |
| `getOptionExpirations(config)` | Available expirations for a symbol | `Promise<OptionExpirationReturn \| undefined>` |
| `getAtmOptionData(config)` | At-the-money options within a DTE window | `Promise<GetAtmOptionReturn \| undefined>` |
| `greekFilter(config)` | Options filtered by DTE and Greek ranges | `Promise<GreekFilterReturn>` |
| `getAccountNumbers()` | Account numbers for the authenticated user | `Promise<UserAccountNumbers>` |
| `getAccounts()` | Accounts payload for the authenticated user | `Promise<AccountsResponse>` |
| `getUserPreference()` | User preference payload, including streamer metadata | `Promise<UserPreferenceResponse>` |
| `SchwabAuth` | Explicit OAuth client | `SchwabAuth` |
| `auth.getAuth()` | Valid token, refreshed or acquired as needed | `Promise<{ access_token: string; refresh_token: string; expires_in: number; ... }>` |

Validation notes:

- `getPriceHistory()`, `getOptionChain()`, `getOptionExpirations()`, and `getAtmOptionData()` validate request input before calling Schwab.
- When those request objects fail validation, the function logs a validation tree and returns `undefined`.
- Successful responses are parsed with Zod before being returned.

## Route Changes

The package now uses kebab-case namespace paths such as `market-data`.

Legacy import routes still resolve for compatibility, but they emit a one-time `DeprecationWarning` telling callers which path to move to.

| Legacy import | Use instead |
| --- | --- |
| `@misterpea/schwab-node/marketData/quotes` | `@misterpea/schwab-node/market-data` |
| `@misterpea/schwab-node/marketData/highLevelData` | `@misterpea/schwab-node/market-data` |
| `@misterpea/schwab-node/marketData/derivatives` | `@misterpea/schwab-node/derivatives` |
| `@misterpea/schwab-node/marketData/request` | `@misterpea/schwab-node/scripts/request` |

Compatibility notes for those legacy routes:

- `marketData/quotes` keeps the old array-wrapped quote and price-history envelope.
- `marketData/highLevelData` keeps the old movers envelope of `{ screeners: [...] }[]`.
- `marketData/derivatives` keeps the old array-wrapped option-chain shape and maps ATM output back to `day_of_week`.

## Examples

### Quote Data

```typescript
import { getQuote } from "@misterpea/schwab-node";

const quote = await getQuote({
  symbols: "AAPL,MSFT",
  fields: "quote",
});

console.log(quote.AAPL.quote?.bidPrice);
console.log(quote.MSFT.quote?.askPrice);
```

Example response shape:

```typescript
{
  AAPL: {
    assetMainType: "EQUITY",
    symbol: "AAPL",
    quote: {
      closePrice: 179.5,
      lastPrice: 180.15,
      netChange: 0.65,
      securityStatus: "Normal",
      tradeTime: 1760985600000,
      bidPrice: 180.12,
      askPrice: 180.18,
    },
  },
}
```

### Price History

```typescript
import { getPriceHistory } from "@misterpea/schwab-node";

const history = await getPriceHistory({
  symbol: "AAPL",
  periodType: "year",
  period: 1,
  frequencyType: "daily",
  frequency: 1,
});

if (!history) {
  throw new Error("Invalid price history request");
}

console.log(history.symbol);
console.log(history.candles[0]?.close);
```

### Option Chain

```typescript
import { getOptionChain } from "@misterpea/schwab-node";

const chain = await getOptionChain({
  symbol: "AAPL",
  contractType: "CALL",
  strikeCount: 2,
});

if (!chain) {
  throw new Error("Invalid option chain request");
}

const expirations = Object.keys(chain.callExpDateMap);
console.log(expirations);
```

### ATM Option Data

```typescript
import { getAtmOptionData } from "@misterpea/schwab-node";

const atm = await getAtmOptionData({
  symbol: "AAPL",
  window: [7, 21],
});

console.log(atm?.[0]);
```

Example row:

```typescript
{
  put_call: "CALL",
  day_of_expiry: "FRI",
  underlying: "AAPL",
  open_interest: 1000,
  total_volume: 100,
  symbol: "AAPL  260220C00180000",
  dte: 3,
  theta: -0.02,
  strike_price: 180,
  gamma: 0.1,
  volatility: 20,
  vega: 0.05,
  delta: 0.5,
  rho: 0.01,
}
```

### Greek Filter

```typescript
import { greekFilter } from "@misterpea/schwab-node";

const filtered = await greekFilter({
  symbol: "AAPL",
  window: [14, 35],
  greek: {
    delta: [0.2, 0.4],
    vega: [0.05, 0.15],
  },
  side: "CALL",
  strikeCount: 20,
});

console.log(filtered.length);
```

### Movers

```typescript
import { getMovers } from "@misterpea/schwab-node";

const movers = await getMovers({
  index: "$SPX",
  sort: "VOLUME",
});

console.log(movers[0]?.symbol);
```

### Market Hours

```typescript
import { getMarketHours } from "@misterpea/schwab-node";

const hours = await getMarketHours({
  markets: ["equity"],
});

console.log(hours[0]?.sessionHours?.regularMarket);
```

### Account Endpoints

```typescript
import {
  getAccountNumbers,
  getAccounts,
  getUserPreference,
} from "@misterpea/schwab-node";

const accountNumbers = await getAccountNumbers();
const accounts = await getAccounts();
const preferences = await getUserPreference();
```

### Explicit Auth

Most users do not need to instantiate `SchwabAuth` directly. Authenticated requests load default auth from `.env`.

Use an explicit auth client when you want direct control over the token lifecycle:

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

## Feedback & Requests

Found a bug or have a feature request?  
Please open an issue using the Issue Form:  
https://github.com/MisterPea/schwab-node/issues/new/choose

## AI Assistance Disclosure

AI tooling (OpenAI Codex) was used as a development assistant for:

- Identifying potential bugs and edge cases
- Strengthening the authentication flow
- Assisting with test development and validation

All core architecture, implementation, and final code decisions were written and reviewed by the project author.

***

> [!NOTE]
> Roadmap: We are in the process of implementing streaming quotes as part of this package - hang tight!
