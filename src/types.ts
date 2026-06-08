export type ISODate = `${number}-${number}-${number}` | number;
export type SymbolString = string;
export type ExpirationKey = `${number}-${number}-${number}:${number}`;
export type StrikeKey = string;
export type StrikeMap<TQuote> = Record<StrikeKey, TQuote[]>;
export type ExpDateMap<TQuote> = Record<ExpirationKey, StrikeMap<TQuote>>;
export type OptionSide = "call" | "put";
export type OptionSideMaps<TQuote> = {
  callExpDateMap: ExpDateMap<TQuote>;
  putExpDateMap: ExpDateMap<TQuote>;
};
