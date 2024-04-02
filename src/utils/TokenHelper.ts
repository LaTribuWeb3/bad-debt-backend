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

export interface TokenInfos {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

const tokenInfosCache: NetworkInfoCache = {};

const web3ApiUrl = process.env.WEB3_API_URL || 'https://web3.api.la-tribu.xyz';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosResp: any = await retry(axios.get, [fullUrl]);
    tokenInfosCache[network][address] = axiosResp.data;
  }

  // console.log(`GetTokenInfos[${network}]: infos for ${address}:`, tokenInfosCache[network][address]);
  return tokenInfosCache[network][address];
}

export function GetChainToken(network: string): TokenInfos {
  switch (network.toUpperCase()) {
    case 'ETH':
      return {
        address: '0x',
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH'
      };
    case 'BSC':
      return {
        address: '0x',
        decimals: 18,
        name: 'BNB',
        symbol: 'BNB'
      };
    case 'CRO':
      return {
        address: '0x',
        decimals: 18,
        name: 'CRO',
        symbol: 'CRO'
      };
    case 'MATIC':
      return {
        address: '0x',
        decimals: 18,
        name: 'MATIC',
        symbol: 'MATIC'
      };
    case 'GNOSIS':
      return {
        address: '0x',
        decimals: 18,
        name: 'xDAI',
        symbol: 'xDAI'
      };
    case 'NEAR':
      return {
        address: '0x',
        decimals: 18,
        name: 'Near',
        symbol: 'NEAR'
      };
    case 'OPTIMISM':
      return {
        address: '0x',
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH'
      };
    case 'AVAX':
      return {
        address: '0x',
        decimals: 18,
        name: 'Avax',
        symbol: 'AVAX'
      };
    case 'MOONBEAM':
      return {
        address: '0x',
        decimals: 18,
        name: 'Moonbeam',
        symbol: 'GLMR'
      };
    case 'FTM':
      return {
        address: '0x',
        decimals: 18,
        name: 'Fantom',
        symbol: 'FTM'
      };
    default:
      throw new Error(`Cannot find chain token for ${network}`);
  }
}
