import * as z from 'zod';
import { constructMarketDataUrl } from '../../helpers.js';
import { getRequest } from '../../scripts/request.js';
import {
  type OptionExpirationRequest,
  OptionExpirationRequestSchema,
  type OptionExpirationReturn,
  OptionExpirationReturnSchema,
} from './schema.js';

export async function getOptionExpirations(config: OptionExpirationRequest): Promise<OptionExpirationReturn | undefined> {
  const result = OptionExpirationRequestSchema.safeParse(config);

  if (!result.success) {
    console.error(JSON.stringify(z.treeifyError(result.error), undefined, 1));
    return;
  }

  const url = constructMarketDataUrl(config, '/expirationchain');
  const res = await getRequest(url);
  const json = await res.json();
  const { expirationList } = json;
  return OptionExpirationReturnSchema.parse(expirationList);
}
