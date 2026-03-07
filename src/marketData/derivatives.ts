import { getAtmOptionData as getAtmOptionDataCurrent } from "../derivatives/get-atm-option-data/index.js";
import type { GetAtmOptionRequest } from "../derivatives/get-atm-option-data/schema.js";
import { getOptionChain as getOptionChainCurrent } from "../derivatives/get-option-chain/index.js";
import type { GetOptionChainRequest } from "../derivatives/get-option-chain/schema.js";
import { getOptionExpirations as getOptionExpirationsCurrent } from "../derivatives/get-option-expirations/index.js";
import type { OptionExpirationRequest } from "../derivatives/get-option-expirations/schema.js";
import { greekFilter as greekFilterCurrent } from "../derivatives/greek-filter/index.js";
import type { GreekFilterRequest } from "../derivatives/greek-filter/schema.js";
import { warnLegacyImportRoute } from "../legacy/warn.js";
import type {
  AtmOptionRtn,
  GetAtmOptionReq,
  GetOptionChainRtn,
  GreekFilterReq,
  GreekFilterRtn,
  OptionChainReq,
  OptionExpirationReq,
  OptionExpirationRtn,
} from "../types.js";

warnLegacyImportRoute(
  "@misterpea/schwab-node/marketData/derivatives",
  "@misterpea/schwab-node/derivatives",
);

export async function getOptionChain(
  config: OptionChainReq,
): Promise<GetOptionChainRtn[]> {
  const result = await getOptionChainCurrent(config as GetOptionChainRequest);
  return result ? [result as GetOptionChainRtn] : [];
}

export async function getOptionExpirations(
  config: OptionExpirationReq,
): Promise<OptionExpirationRtn[]> {
  return ((await getOptionExpirationsCurrent(
    config as OptionExpirationRequest,
  )) ?? []) as OptionExpirationRtn[];
}

export async function getAtmOptionData(
  config: GetAtmOptionReq,
): Promise<AtmOptionRtn[]> {
  const result = await getAtmOptionDataCurrent(config as GetAtmOptionRequest);

  return (result ?? []).map(({ day_of_expiry, rho: _rho, ...option }) => ({
    ...option,
    day_of_week: day_of_expiry,
  }));
}

export async function greekFilter(
  config: GreekFilterReq,
): Promise<GreekFilterRtn[]> {
  return ((await greekFilterCurrent(config as GreekFilterRequest)) ??
    []) as GreekFilterRtn[];
}
