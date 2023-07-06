import axios from 'axios';
import { retry } from './Utils';
import * as dotenv from 'dotenv';
dotenv.config();

interface NetworkInfoCache {
  [network: string]: TokenInfoCache;
}
interface TokenInfoCache {
  [tokenAddress: string]: TokenInfos;
}

interface TokenInfos {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

const tokenInfosCache: NetworkInfoCache = {};

const web3ApiUrl = process.env.WEB3_API_URL;
if (!web3ApiUrl) {
  throw new Error('Cannot find WEB3_API_URL in env variables');
}

/**
 * Get token infos from web3 api and cache them
 * @param network
 * @param address
 * @returns {TokenInfos}
 */
export async function GetTokenInfos(network: string, address: string): Promise<TokenInfos> {
  network = network.toLowerCase();
  address = address.toLowerCase();
  if (!tokenInfosCache[network] || !tokenInfosCache[network][address]) {
    if (!tokenInfosCache[network]) {
      tokenInfosCache[network] = {};
    }

    // console.log(`GetTokenInfos[${network}]: getting infos for ${address}`);
    const fullUrl = `${web3ApiUrl}/api/token/infos?network=${network}&tokenAddress=${address}`;
    const axiosResp: any = await retry(axios.get, [fullUrl]);
    tokenInfosCache[network][address] = axiosResp.data;
  }

  // console.log(`GetTokenInfos[${network}]: infos for ${address}:`, tokenInfosCache[network][address]);
  return tokenInfosCache[network][address];
}
