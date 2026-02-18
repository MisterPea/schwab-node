# Schwab Interface for Node.js 💵
A Node.js wrapper for Schwab's Market Data API — get quotes, option chains, price history, and more with minimal setup

![Node](https://img.shields.io/badge/node-%3E%3D20.6.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Installation
Install the package in your project:
```bash
npm install @misterpea/schwab-node
```
## Setup
1. If you haven't done so, visit https://developer.schwab.com, create an account and register your app
2. Add an `.env` file to your project root containing your account info:
- Verbatim environment variable names required
- For now, your redirect URI must be a localhost address (e.g. https://127.0.0.1:3000); port number is required
```bash
SCHWAB_CLIENT_SECRET=A1B2C3D4E5F6G7H8
SCHWAB_CLIENT_ID=ABCDEFGHIJKLMNOPQRSTUVWXZY123456
SCHWAB_REDIRECT_URI=https://127.0.0.1:PORT
```

3. Generate local certs for Schwab OAuth callback:
```bash
npx schwab-node-certs --callback https://my-redirect:port
```
The cert script prefers `mkcert` (trusted local CA) when available, and falls back to `openssl` (self-signed certs) if `mkcert` is not installed.

## API
| Method                                                    | Description                                                                                         | Returns                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `getPriceHistory(config)`                                 | Get price-history candles for a symbol                                                              | `Promise<PriceHistoryRtnElement[]>`                                                 |
| `getQuote(config)`                                        | Get quote/fundamental data for one or more symbols                                                  | `Promise<QuoteRtn[]>`                                                               |
| `getOptionChain(config)`                                  | Get option chain data (calls + puts maps by expiration/strike)                                      | `Promise<GetOptionChainRtn[]>`                                                      |
| `getOptionExpirations(config)`                            | Get available option expiration dates for a symbol                                                  | `Promise<OptionExpirationRtn[]>`                                                    |
| `getAtmOptionData(config)`                                | Get at-the-money option rows within a DTE window                                                    | `Promise<AtmOptionRtn[]>`                                                           |
| `greekFilter(symbol, window, greek, side?, strikeCount?)` | Filter options by DTE and Greek ranges (`delta`, `gamma`, `theta`, `vega`, `rho`, `iv`, `absDelta`) | `Promise<GreekFilterRtn[]>`                                                         |
| `getMovers(config)`                                       | Get top movers for an index/screener                                                                | `Promise<ScreenersResponse>`                                                        |
| `getMarketHours(config)`                                  | Get market hours for one or more markets on a given date (or today)                                 | `Promise<MarketHoursRtn[]>`                                                         |
|                                                           |                                                                                                     |
| `SchwabAuth(config)`                                      | Creates an OAuth client for Schwab authentication                                                   | `SchwabAuth`                                                                        |
| `schwabAuth.getAuth()`                                    | Get a valid OAuth token (loads cached token, refreshes, or runs browser auth flow)                  | `Promise<{ access_token: string; refresh_token: string; expires_in: number; ... }>` |

## Examples

#### `getPriceHistory` - Get price history for a symbol
```typescript
const config: ChartRequest = {
    symbol: 'AAPL',
    periodType: 'year',
    period: 5,
    frequencyType: 'monthly',
    frequency: 1,
  };

const aaplHistory = await getPriceHistory(config);
```
<details>
<summary>Click to view getPriceHistory return</summary>

```typescript
//  Returns: [ 
//   {
//   "symbol": "AAPL",
//   "empty": false,
//   "candles": [
//    {
//     "open": 123.75,
//     "high": 128.72,
//     "low": 116.21,
//     "close": 122.15,
//     "volume": 2650845213,
//     "datetime": 1614578400000
//    }...] } ]
```
</details>

#### `getQuote` - Get current quote for symbol(s)
```typescript
const config: GetQuoteReq = {
  symbols: 'AAPL,AAPL  260306C00270000',
  fields: 'fundamental, quote'
};
const underlyingAndOptionQuote = await getQuote(config);
```
<details>
<summary>Click to view getQuote return</summary>

```typescript
// Returns :[
//  {
//   "AAPL": {
//    "assetMainType": "EQUITY",
//    "assetSubType": "COE",
//    "quoteType": "NBBO",
//    "realtime": true,
//    "ssid": 1973757747,
//    "symbol": "AAPL",
//    "fundamental": {
//     "avg10DaysVolume": 60058412,
//     "avg1YearVolume": 54140170,
//     "declarationDate": "2026-01-29T00:00:00Z",
//     "divAmount": 1.04,
//     "divExDate": "2026-02-09T00:00:00Z",
//     "divFreq": 4,
//     "divPayAmount": 0.26,
//     "divPayDate": "2026-02-12T00:00:00Z",
//     "divYield": 0.4066,
//     "eps": 7.46,
//     "fundLeverageFactor": 0,
//     "lastEarningsDate": "2026-01-29T00:00:00Z",
//     "nextDivExDate": "2026-05-11T00:00:00Z",
//     "nextDivPayDate": "2026-05-12T00:00:00Z",
//     "peRatio": 33.4679,
//     "sharesOutstanding": 14681140000
//    },
//    "quote": {
//     "52WeekHigh": 288.62,
//     "52WeekLow": 169.2101,
//     "askMICId": "XNAS",
//     "askPrice": 266.21,
//     "askSize": 200,
//     "askTime": 1771432265184,
//     "bidMICId": "IEGX",
//     "bidPrice": 266.18,
//     "bidSize": 500,
//     "bidTime": 1771432265259,
//     "closePrice": 263.88,
//     "highPrice": 266.22,
//     "lastMICId": "XADF",
//     "lastPrice": 266.21,
//     "lastSize": 200,
//     "lowPrice": 262.45,
//     "mark": 266.21,
//     "markChange": 2.33,
//     "markPercentChange": 0.88297711,
//     "netChange": 2.33,
//     "netPercentChange": 0.88297711,
//     "openPrice": 263.6,
//     "postMarketChange": 0,
//     "postMarketPercentChange": 0,
//     "quoteTime": 1771432265259,
//     "securityStatus": "Normal",
//     "totalVolume": 13584908,
//     "tradeTime": 1771432265200
//    }
//   },
//   "AAPL  260306C00270000": {
//    "assetMainType": "OPTION",
//    "realtime": true,
//    "ssid": 128608733,
//    "symbol": "AAPL  260306C00270000",
//    "quote": {
//     "52WeekHigh": 15,
//     "52WeekLow": 1.72,
//     "askPrice": 4.1,
//     "askSize": 15,
//     "bidPrice": 4.05,
//     "bidSize": 80,
//     "closePrice": 3.6,
//     "delta": 0.40524082,
//     "gamma": 0.02695638,
//     "highPrice": 4.05,
//     "indAskPrice": 0,
//     "indBidPrice": 0,
//     "indQuoteTime": 0,
//     "impliedYield": 0,
//     "lastPrice": 4.03,
//     "lastSize": 10,
//     "lowPrice": 3.04,
//     "mark": 4.075,
//     "markChange": 0.475,
//     "markPercentChange": 13.19444444,
//     "moneyIntrinsicValue": -3.79,
//     "netChange": 0.43,
//     "netPercentChange": 11.94444444,
//     "openInterest": 3351,
//     "openPrice": 3.45,
//     "quoteTime": 1771432265408,
//     "rho": 0.04602125,
//     "securityStatus": "Normal",
//     "theoreticalOptionValue": 4.05001506,
//     "theta": -0.17592784,
//     "timeValue": 4.03000021,
//     "totalVolume": 489,
//     "tradeTime": 1771432227313,
//     "underlyingPrice": 266.21,
//     "vega": 0.21723119,
//     "volatility": 25.66708864
//    }
//   }
//  }
// ]
```
</details>

#### `getOptionChain` - Get the option chain containing fundamentals for a particular underlying
```typescript
const config: OptionChainReq = {
  symbol: 'AAPL',
  contractType:'CALL',
  toDate:'2026-02-19',
  strikeCount:2
};
const aaplChain = await getOptionChain(config);
```
<details>
<summary>Click to view getOptionChain return</summary>

```typescript
// Returns: [
//  {
//   "symbol": "AAPL",
//   "status": "SUCCESS",
//   "underlying": null,
//   "strategy": "SINGLE",
//   "interval": 0,
//   "isDelayed": false,
//   "isIndex": false,
//   "interestRate": 3.6,
//   "underlyingPrice": 266.16,
//   "volatility": 29,
//   "daysToExpiration": 0,
//   "dividendYield": 0.391,
//   "numberOfContracts": 2,
//   "assetMainType": "EQUITY",
//   "assetSubType": "COE",
//   "isChainTruncated": false,
//   "callExpDateMap": {
//    "2026-02-18:0": {
//     "265.0": [
//      {
//       "putCall": "CALL",
//       "symbol": "AAPL  260218C00265000",
//       "description": "AAPL 02/18/2026 265.00 C",
//       "exchangeName": "OPR",
//       "bid": 1.51,
//       "ask": 1.55,
//       "last": 1.5,
//       "mark": 1.53,
//       "bidSize": 33,
//       "askSize": 18,
//       "bidAskSize": "33X18",
//       "lastSize": 2,
//       "highPrice": 2.05,
//       "lowPrice": 0.39,
//       "openPrice": 0,
//       "closePrice": 1.25,
//       "totalVolume": 34197,
//       "tradeTimeInLong": 1771432766879,
//       "quoteTimeInLong": 1771432767082,
//       "netChange": 0.25,
//       "volatility": 33.377,
//       "delta": 0.725,
//       "gamma": 0.164,
//       "theta": -0.35,
//       "vega": 0.02,
//       "rho": 0.001,
//       "openInterest": 5738,
//       "timeValue": 0.34,
//       "theoreticalOptionValue": 1.55,
//       "theoreticalVolatility": 29,
//       "optionDeliverablesList": [
//        {
//         "symbol": "AAPL",
//         "assetType": "STOCK",
//         "deliverableUnits": 100,
//         "currencyType": null
//        }
//       ],
//       "strikePrice": 265,
//       "expirationDate": "2026-02-18T21:00:00.000+00:00",
//       "daysToExpiration": 0,
//       "expirationType": "W",
//       "lastTradingDay": 1771462800000,
//       "multiplier": 100,
//       "settlementType": "P",
//       "deliverableNote": "100 AAPL",
//       "percentChange": 20,
//       "markChange": 0.28,
//       "markPercentChange": 22.4,
//       "intrinsicValue": 1.16,
//       "extrinsicValue": 0.34,
//       "optionRoot": "AAPL",
//       "exerciseType": "A",
//       "high52Week": 16.24,
//       "low52Week": 0.22,
//       "pennyPilot": true,
//       "inTheMoney": true,
//       "mini": false,
//       "nonStandard": false
//      }
//     ],
//     "267.5": [
//      {
//       "putCall": "CALL",
//       "symbol": "AAPL  260218C00267500",
//       "description": "AAPL 02/18/2026 267.50 C",
//       "exchangeName": "OPR",
//       "bid": 0.29,
//       "ask": 0.31,
//       "last": 0.28,
//       "mark": 0.3,
//       "bidSize": 111,
//       "askSize": 121,
//       "bidAskSize": "111X121",
//       "lastSize": 17,
//       "highPrice": 0.55,
//       "lowPrice": 0.1,
//       "openPrice": 0,
//       "closePrice": 0.48,
//       "totalVolume": 34694,
//       "tradeTimeInLong": 1771432766015,
//       "quoteTimeInLong": 1771432767284,
//       "netChange": -0.19,
//       "volatility": 32.42,
//       "delta": 0.258,
//       "gamma": 0.164,
//       "theta": -0.305,
//       "vega": 0.02,
//       "rho": 0,
//       "openInterest": 8089,
//       "timeValue": 0.28,
//       "theoreticalOptionValue": 0.305,
//       "theoreticalVolatility": 29,
//       "optionDeliverablesList": [
//        {
//         "symbol": "AAPL",
//         "assetType": "STOCK",
//         "deliverableUnits": 100,
//         "currencyType": null
//        }
//       ],
//       "strikePrice": 267.5,
//       "expirationDate": "2026-02-18T21:00:00.000+00:00",
//       "daysToExpiration": 0,
//       "expirationType": "W",
//       "lastTradingDay": 1771462800000,
//       "multiplier": 100,
//       "settlementType": "P",
//       "deliverableNote": "100 AAPL",
//       "percentChange": -40,
//       "markChange": -0.17,
//       "markPercentChange": -36.84,
//       "intrinsicValue": -1.34,
//       "extrinsicValue": 1.62,
//       "optionRoot": "AAPL",
//       "exerciseType": "A",
//       "high52Week": 13.94,
//       "low52Week": 0.1,
//       "pennyPilot": true,
//       "inTheMoney": false,
//       "mini": false,
//       "nonStandard": false
//      }
//     ]
//    }
//   },
//   "putExpDateMap": {}
//  }
// ]
```
</details>

#### `getOptionExpirations` - Get all options expirations for a particular ticker
```typescript
const config: OptionExpirationReq = {
    symbol: 'AAPL',
  };
const aaplExpirations = await getOptionExpirations(config);
```
<details>
<summary>Click to view getOptionExpirations return</summary>

```typescript
// Returns: [
//  {
//   "expirationDate": "2026-02-18",
//   "daysToExpiration": 0,
//   "expirationType": "W",
//   "settlementType": "P",
//   "optionRoots": "AAPL",
//   "standard": true
//  },
//  {
//   "expirationDate": "2026-02-20",
//   "daysToExpiration": 2,
//   "expirationType": "S",
//   "settlementType": "P",
//   "optionRoots": "AAPL",
//   "standard": true
//  },
//  ...
//  },
//  {
//   "expirationDate": "2028-03-17",
//   "daysToExpiration": 758,
//   "expirationType": "S",
//   "settlementType": "P",
//   "optionRoots": "AAPL",
//   "standard": true
//  },
//  {
//   "expirationDate": "2028-12-15",
//   "daysToExpiration": 1031,
//   "expirationType": "S",
//   "settlementType": "P",
//   "optionRoots": "AAPL",
//   "standard": true
//  }
// ]
```
</details>

#### `getAtmOptionData` - Get at-the-money (~delta 0.5) options for a particular ticker that expire in x to y days
```typescript
const config: GetAtmOptionReq = {
    symbol: 'AAPL',
    window: [10, 20], // dte
  };
const aaplAtmOptions = await getAtmOptionData(config);
```
<details>
<summary>Click to view getAtmOptionData return</summary>

```typescript
// Returns: [
//  {
//   "put_call": "CALL",
//   "day_of_week": "WED",
//   "underlying": "AAPL",
//   "open_interest": 124,
//   "total_volume": 305,
//   "symbol": "AAPL  260302C00265000",
//   "dte": 12,
//   "theta": -0.193,
//   "strike_price": 265,
//   "gamma": 0.035,
//   "volatility": 23.598,
//   "vega": 0.193,
//   "delta": 0.533
//  },
//  {
//   "put_call": "CALL",
//   "day_of_week": "WED",
//   "underlying": "AAPL",
//   "open_interest": 41,
//   "total_volume": 190,
//   "symbol": "AAPL  260304C00265000",
//   "dte": 14,
//   "theta": -0.183,
//   "strike_price": 265,
//   "gamma": 0.031,
//   "volatility": 24.398,
//   "vega": 0.208,
//   "delta": 0.529
//  },
//  {
//   "put_call": "CALL",
//   "day_of_week": "WED",
//   "underlying": "AAPL",
//   "open_interest": 1713,
//   "total_volume": 597,
//   "symbol": "AAPL  260306C00265000",
//   "dte": 16,
//   "theta": -0.178,
//   "strike_price": 265,
//   "gamma": 0.029,
//   "volatility": 24.952,
//   "vega": 0.222,
//   "delta": 0.532
//  },
//  {
//   "put_call": "PUT",
//   "day_of_week": "WED",
//   "underlying": "AAPL",
//   "open_interest": 59,
//   "total_volume": 79,
//   "symbol": "AAPL  260302P00265000",
//   "dte": 12,
//   "theta": -0.189,
//   "strike_price": 265,
//   "gamma": 0.035,
//   "volatility": 23.598,
//   "vega": 0.193,
//   "delta": -0.468
//  },
//  {
//   "put_call": "PUT",
//   "day_of_week": "WED",
//   "underlying": "AAPL",
//   "open_interest": 5,
//   "total_volume": 62,
//   "symbol": "AAPL  260304P00265000",
//   "dte": 14,
//   "theta": -0.182,
//   "strike_price": 265,
//   "gamma": 0.031,
//   "volatility": 24.398,
//   "vega": 0.208,
//   "delta": -0.471
//  },
//  {
//   "put_call": "PUT",
//   "day_of_week": "WED",
//   "underlying": "AAPL",
//   "open_interest": 979,
//   "total_volume": 467,
//   "symbol": "AAPL  260306P00265000",
//   "dte": 16,
//   "theta": -0.171,
//   "strike_price": 265,
//   "gamma": 0.029,
//   "volatility": 24.952,
//   "vega": 0.222,
//   "delta": -0.469
//  }
// ]
```
</details>

#### `greekFilter` - Find options for a ticker by DTE and Greek ranges (delta, gamma, theta, vega, rho, iv, absDelta)
```typescript
const config: GreekFilterReq = {
    symbol: 'AAPL',
    window: [0, 4], // Expires in 0 - 4 days
    greek: { 'absDelta': [0.4, 0.65] } // Has an absolute delta between 0.4 and 0.65
  };
const findAapl40to65Delta = await greekFilter(config);
```
<details>
<summary>Click to view greekFilter return</summary>

```typescript
// Returns: [
//  {
//   "put_call": "CALL",
//   "underlying": "AAPL",
//   "symbol": "AAPL  260220C00262500",
//   "dte": 2,
//   "total_volume": 7823,
//   "open_interest": 9716,
//   "day_of_expiry": "THR",
//   "theta": -0.623,
//   "strike_price": 262.5,
//   "gamma": 0.063,
//   "volatility": 29.793,
//   "vega": 0.074,
//   "delta": 0.644,
//   "rho": 0.009
//  },
//  {
//   "put_call": "CALL",
//   "underlying": "AAPL",
//   "symbol": "AAPL  260220C00265000",
//   "dte": 2,
//   "total_volume": 14949,
//   "open_interest": 26210,
//   "day_of_expiry": "THR",
//   "theta": -0.654,
//   "strike_price": 265,
//   "gamma": 0.069,
//   "volatility": 28.878,
//   "vega": 0.08,
//   "delta": 0.478,
//   "rho": 0.007
//  },
//  {
//   "put_call": "PUT",
//   "underlying": "AAPL",
//   "symbol": "AAPL  260218P00265000",
//   "dte": 0,
//   "total_volume": 35267,
//   "open_interest": 1973,
//   "day_of_expiry": "TUE",
//   "theta": -0.317,
//   "strike_price": 265,
//   "gamma": 0.298,
//   "volatility": 32.15,
//   "vega": 0.015,
//   "delta": -0.638,
//   "rho": 0
//  },
//  {
//   "put_call": "PUT",
//   "underlying": "AAPL",
//   "symbol": "AAPL  260220P00265000",
//   "dte": 2,
//   "total_volume": 7963,
//   "open_interest": 9000,
//   "day_of_expiry": "THR",
//   "theta": -0.627,
//   "strike_price": 265,
//   "gamma": 0.069,
//   "volatility": 28.878,
//   "vega": 0.08,
//   "delta": -0.523,
//   "rho": -0.008
//  }
// ]

```
</details>

#### `getMovers` - Get the top 10 movers for an index 
```typescript
const config: GetMoversConfig = {
  index: '$SPX',
  sort: 'TRADES'
};
const spxMovers = await getMovers(config);
```
<details>
<summary>Click to view getMovers return</summary>

```typescript
// Returns: [
//  {
//   "screeners": [
//    {
//     "description": "NVIDIA CORP",
//     "volume": 79190778,
//     "lastPrice": 189.29,
//     "netChange": 4.32,
//     "marketShare": 6.63,
//     "totalVolume": 1194251880,
//     "trades": 1531111,
//     "netPercentChange": 0.0234,
//     "symbol": "NVDA"
//    },
//    {
//     "description": "INTEL CORP",
//     "volume": 34147623,
//     "lastPrice": 46.26,
//     "netChange": 0.08,
//     "marketShare": 2.86,
//     "totalVolume": 1194251880,
//     "trades": 225262,
//     "netPercentChange": 0.0016,
//     "symbol": "INTC"
//    },
//    {
//     "description": "PALANTIR TECHNOLOGIE Class A",
//     "volume": 32025622,
//     "lastPrice": 139.31,
//     "netChange": 6.29,
//     "marketShare": 2.68,
//     "totalVolume": 1194251880,
//     "trades": 511846,
//     "netPercentChange": 0.0473,
//     "symbol": "PLTR"
//    },
//    {
//     "description": "FORD MTR CO DEL",
//     "volume": 28317312,
//     "lastPrice": 14.08,
//     "netChange": -0.05,
//     "marketShare": 2.37,
//     "totalVolume": 1194251880,
//     "trades": 65385,
//     "netPercentChange": -0.0035,
//     "symbol": "F"
//    },
//    {
//     "description": "AMAZON.COM INC",
//     "volume": 27434765,
//     "lastPrice": 206.21,
//     "netChange": 5.06,
//     "marketShare": 2.3,
//     "totalVolume": 1194251880,
//     "trades": 440608,
//     "netPercentChange": 0.0252,
//     "symbol": "AMZN"
//    },
//    {
//     "description": "TESLA INC",
//     "volume": 23390710,
//     "lastPrice": 415.52,
//     "netChange": 4.89,
//     "marketShare": 1.96,
//     "totalVolume": 1194251880,
//     "trades": 710655,
//     "netPercentChange": 0.0119,
//     "symbol": "TSLA"
//    },
//    {
//     "description": "ADVANCED MICRO DEVIC",
//     "volume": 20143875,
//     "lastPrice": 202.94,
//     "netChange": -0.14,
//     "marketShare": 1.69,
//     "totalVolume": 1194251880,
//     "trades": 296668,
//     "netPercentChange": -0.0007,
//     "symbol": "AMD"
//    },
//    {
//     "description": "MICRON TECHNOLOGY IN",
//     "volume": 18915188,
//     "lastPrice": 426.49,
//     "netChange": 26.71,
//     "marketShare": 1.58,
//     "totalVolume": 1194251880,
//     "trades": 360167,
//     "netPercentChange": 0.0668,
//     "symbol": "MU"
//    },
//    {
//     "description": "PALO ALTO NETWORKS I",
//     "volume": 16268542,
//     "lastPrice": 154.83,
//     "netChange": -8.67,
//     "marketShare": 1.36,
//     "totalVolume": 1194251880,
//     "trades": 225924,
//     "netPercentChange": -0.053,
//     "symbol": "PANW"
//    },
//    {
//     "description": "KENVUE INC",
//     "volume": 16180307,
//     "lastPrice": 18.88,
//     "netChange": 0.47,
//     "marketShare": 1.35,
//     "totalVolume": 1194251880,
//     "trades": 35109,
//     "netPercentChange": 0.0255,
//     "symbol": "KVUE"
//    }
//   ]
//  }
// ]
```
</details>

#### `getMarketHours` - Get the trading hours for a particular instrument, for today or a given day up to 1 year from today.
```typescript
const config: GetMarketHoursConfig = {
    markets: ['equity','bond']
  };
const equityBondHours = await getMarketHours(config);
```
<details>
<summary>Click to view getMarketHours return</summary>

```typescript
// Returns: [
//  {
//   "date": "2026-02-18",
//   "marketType": "EQUITY",
//   "isOpen": true,
//   "sessionHours": {
//    "preMarket": [
//     {
//      "start": "2026-02-18T07:00:00-05:00",
//      "end": "2026-02-18T09:30:00-05:00"
//     }
//    ],
//    "regularMarket": [
//     {
//      "start": "2026-02-18T09:30:00-05:00",
//      "end": "2026-02-18T16:00:00-05:00"
//     }
//    ],
//    "postMarket": [
//     {
//      "start": "2026-02-18T16:00:00-05:00",
//      "end": "2026-02-18T20:00:00-05:00"
//     }
//    ]
//   }
//  },
//  {
//   "date": "2026-02-18",
//   "marketType": "BOND",
//   "isOpen": true,
//   "sessionHours": {
//    "preMarket": [
//     {
//      "start": "2026-02-18T04:00:00-05:00",
//      "end": "2026-02-18T08:00:00-05:00"
//     }
//    ],
//    "regularMarket": [
//     {
//      "start": "2026-02-18T08:00:00-05:00",
//      "end": "2026-02-18T17:00:00-05:00"
//     }
//    ],
//    "postMarket": [
//     {
//      "start": "2026-02-18T17:00:00-05:00",
//      "end": "2026-02-18T20:00:00-05:00"
//     }
//    ]
//   }
//  }
// ]

```
</details>

***

<details>
<summary>Advanced Auth</summary>

#### `SchwabAuth` - Create new auth instance - Note: authentication flow is essentially automatic, so you should never need to use the following
```typescript
process.loadEnvFile('.env');

function reqEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

const auth = new SchwabAuth({
  clientId: reqEnv("SCHWAB_CLIENT_ID"),
  clientSecret: reqEnv("SCHWAB_CLIENT_SECRET"),
  redirectUri: reqEnv("SCHWAB_REDIRECT_URI")
});
```

#### `getAuth` - Get a valid OAuth token (loads cached token, refreshes, or runs browser auth flow)
```typescript
const tokenInfo = await auth.getAuth();
```
Return: 
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

</details>

## Feedback & Requests

Found a bug or have a feature request?  
Please open an issue using the Issue Form:  
https://github.com/your-username/your-repo/issues/new/choose

## AI Assistance Disclosure
AI tooling (OpenAI Codex) was used as a development assistant for:
- Identifying potential bugs and edge cases
- Strengthening the authentication flow
- Assisting with test development and validation

All core architecture, implementation, and final code decisions were written and reviewed by the project author.
***
> [!NOTE]
> Roadmap: We are in the process of implementing streaming quotes as part of this package - hang tight!
