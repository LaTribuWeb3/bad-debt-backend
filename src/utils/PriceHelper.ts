/* eslint-disable @typescript-eslint/no-unused-vars */
import axios from 'axios';
import { normalize, retry, sleep } from './Utils';
import { JsonRpcProvider } from 'ethers';
import {
  CToken__factory,
  Chainlink__factory,
  Curve__factory,
  ERC20__factory,
  StakedToken__factory,
  UniswapV2Pair__factory,
  XJoe__factory
} from '../contracts/types';
import { GetTokenInfos } from './TokenHelper';
import * as dotenv from 'dotenv';
dotenv.config();

const web3ApiUrl = process.env.WEB3_API_URL || 'https://web3.api.la-tribu.xyz';

export async function getCTokenPriceFromZapper(
  ctoken: string,
  underlying: string,
  web3Provider: JsonRpcProvider,
  network: string
) {
  if (network.toUpperCase() != 'ETH') {
    throw new Error('getCTokenPriceFromZapper: only ETH is supported');
  }

  const totalBalanceInUSD = await fetchZapperTotal(ctoken);
  //console.log({totalBalanceInUSD})
  const underlyingContract = ERC20__factory.connect(underlying, web3Provider);

  const decimals = Number(await underlyingContract.decimals());
  const balance = await underlyingContract.balanceOf(ctoken);
  const normalizedBalance = normalize(balance, decimals);

  if (balance == 0n) {
    return 0;
  }

  const normalizedUSDValue = totalBalanceInUSD / normalizedBalance;

  return normalizedUSDValue;
}

export async function fetchZapperTotal(address: string): Promise<number> {
  const zapperKey = process.env.ZAPPER_KEY;
  if (!zapperKey) {
    throw new Error('Cannot find ZAPPER_KEY in env variables');
  }
  const base64ZapperKey = Buffer.from(zapperKey).toString('base64');

  try {
    const headers = {
      'Cache-Control': 'no-cache',
      Authorization: `Basic ${base64ZapperKey}`,
      accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0'
    };
    // post to zapper to force refresh data
    const postOptions = {
      method: 'post',
      url: 'https://api.zapper.fi/v2/balances/apps',
      params: {
        'addresses[]': address,
        'network[]': 'ethereum'
      },
      headers: headers
    };
    const postResponse = await axios(postOptions);
    const jobId = postResponse.data.jobId;

    // wait for job to complete by checking status every 5 seconds
    let jobComplete = false;
    while (!jobComplete) {
      const getStatusOptions = {
        method: 'get',
        url: 'https://api.zapper.fi/v2/balances/job-status',
        params: {
          jobId: jobId
        },
        headers: headers
      };

      const getStatusResponse = await axios(getStatusOptions);
      if (getStatusResponse.data.status == 'completed') {
        console.log(`Job ${jobId} status is ${getStatusResponse.data.status}`);
        jobComplete = true;
      } else if (getStatusResponse.data.status == 'unknown') {
        console.log('Zapper status is "unknown", restarting the process');
        return await fetchZapperTotal(address);
      } else {
        console.log(`Job ${jobId} status is ${getStatusResponse.data.status}, waiting 5 seconds`);
        await sleep(5000);
      }
    }

    // get the value
    const getOptions = {
      method: 'get',
      url: 'https://api.zapper.fi/v2/balances/apps',
      params: {
        'addresses[]': address,
        'network[]': 'ethereum'
      },
      headers: headers
    };

    const res = await axios(getOptions);

    // sum balance usd of all data where network is ethereum
    let sumBalanceUsd = 0;
    for (const result of res.data) {
      if (result.network == 'ethereum') {
        sumBalanceUsd += result.balanceUSD;
      }
    }
    return sumBalanceUsd;
  } catch (e) {
    console.error(`fetchZapperTotal for ${address} failed`);
    console.error(e);
    return 0;
  }
}

export async function GetEthPrice(network: string): Promise<number> {
  try {
    const price = await chainTokenFetchers[`${network.toUpperCase()}` as keyof typeof chainTokenFetchers]();
    return price;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

async function GetSimplePrice(currency: string): Promise<number> {
  const fullUrl = `${web3ApiUrl}/api/price/simple?currency=${currency}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const axiosResp: any = await retry(axios.get, [fullUrl], 50);
  return Number(axiosResp.data.priceUSD);
}

const chainTokenFetchers = {
  MOONBEAM: async () => {
    return 0;
  },
  OPTIMISM: async () => {
    return await retry(GetSimplePrice, ['ethereum']);
  },
  GNOSIS: async () => {
    return await retry(GetSimplePrice, ['dai']);
  },
  ARBITRUM: async () => {
    return await retry(GetSimplePrice, ['ethereum']);
  },
  NEAR: async () => {
    return await retry(GetSimplePrice, ['ethereum']);
  },
  ETH: async () => {
    return await retry(GetSimplePrice, ['ethereum']);
  },
  AVAX: async () => {
    return await retry(GetSimplePrice, ['avalanche-2']);
  },
  MATIC: async () => {
    return await retry(GetSimplePrice, ['matic-network']);
  },
  BSC: async () => {
    return await retry(GetSimplePrice, ['binancecoin']);
  },
  FTM: async () => {
    return await retry(GetSimplePrice, ['fantom']);
  },
  CRO: async () => {
    return await retry(GetSimplePrice, ['crypto-com-chain']);
  }
};

export async function GetPrice(network: string, address: string, web3Provider: JsonRpcProvider): Promise<number> {
  if (network == 'GOERLI') {
    if (address.toLowerCase() == '0x62bd2a599664d421132d7c54ab4dbe3233f4f0ae') {
      return 1.0;
    }

    if (address.toLowerCase() == '0xd8134205b0328f5676aaefb3b2a0dc15f4029d8c') {
      return 1.01;
    }

    if (address.toLowerCase() == '0x576e379fa7b899b4de1e251e935b31543df3e954') {
      return 1.0;
    }
  }
  if (network === 'MOONBEAM') return 0;

  // force fallback price for stake stone ether on mode network
  if (network === 'MODE' && address.toLowerCase() == '0x80137510979822322193fc997d400d5a6c747bf7') {
    return 0;
  }

  const specialPriceFetcher =
    specialAssetPriceFetchers[`${network}_${address}` as keyof typeof specialAssetPriceFetchers];
  if (specialPriceFetcher) {
    const apiPrice = await specialPriceFetcher(web3Provider, network, address);
    return apiPrice;
  }
  const fullUrl = `${web3ApiUrl}/api/price?network=${network}&tokenAddress=${address}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const axiosResp: any = await retry(axios.get, [fullUrl], 50, 5000);
  //console.log(data)
  return axiosResp.data.priceUSD || 0;
}

const specialAssetPriceFetchers = {
  AVAX_0x57319d41F71E81F3c65F2a47CA4e001EbAFd4F33: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // xJoe
    const stakedTokenContract = XJoe__factory.connect(stakedTokenAddress, web3Provider);
    const tokenAddress = await stakedTokenContract.joe();
    const tokenContract = CToken__factory.connect(tokenAddress, web3Provider);

    const stakedDecimals = Number(await stakedTokenContract.decimals());
    const stakedTokenTotalSupply = await stakedTokenContract.totalSupply();
    const normalizedStakedTokenTotalSupply = normalize(stakedTokenTotalSupply, stakedDecimals);
    const stakedTokenUnderlyingBalance = await tokenContract.balanceOf(stakedTokenAddress);
    const normalizedStakedTokenUnderlyingBalance = normalize(stakedTokenUnderlyingBalance, stakedDecimals);

    const underlyingPrice = await GetPrice(network, tokenAddress, web3Provider);
    const price = (normalizedStakedTokenUnderlyingBalance * underlyingPrice) / normalizedStakedTokenTotalSupply;
    return price;
  },
  AVAX_0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // AVAX usdt
    // return ETH usdt price
    return await GetPrice('ETH', '0xdAC17F958D2ee523a2206206994597C13D831ec7', web3Provider);
  },
  BSC_0xd4CB328A82bDf5f03eB737f37Fa6B370aef3e888: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // CREAM
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=cream-2&vs_currencies=USD');
    return Number(data['cream-2'].usd);
  },
  BSC_0xAD6cAEb32CD2c308980a548bD0Bc5AA4306c6c18: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // BAND
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=band-protocol&vs_currencies=USD'
    );
    return Number(data['band-protocol'].usd);
  },
  BSC_0x16939ef78684453bfDFb47825F8a5F714f12623a: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // tezos
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tezos&vs_currencies=USD');
    return Number(data['tezos'].usd);
  },
  BSC_0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // yearn-finance
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=yearn-finance&vs_currencies=USD'
    );
    return Number(data['yearn-finance'].usd);
  },
  BSC_0x101d82428437127bF1608F699CD651e6Abf9766E: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // basic-attention-token
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=basic-attention-token&vs_currencies=USD'
    );
    return Number(data['basic-attention-token'].usd);
  },
  BSC_0x695FD30aF473F2960e81Dc9bA7cB67679d35EDb7: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // renzec
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=renzec&vs_currencies=USD');
    return Number(data['renzec'].usd);
  },
  BSC_0xA527a61703D82139F8a06Bc30097cC9CAA2df5A6: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x1B96B92314C44b159149f7E0303511fB2Fc4774f: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x7561EEe90e24F3b348E1087A005F78B4c8453524: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x70D8929d04b60Af4fb9B58713eBcf18765aDE422: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0xc15fa3E22c912A276550F3E5FE3b0Deb87B55aCd: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x0eD7e52944161450477ee417DE9Cd3a859b14fD0: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x61EB789d75A95CAa3fF50ed7E47b96c132fEc082: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x74E4716E431f45807DCF19f284c7aA99F18a4fbc: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x7EFaEf62fDdCCa950418312c6C91Aef321375A00: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // Pancake LPs (Cake-LP)
    return await getUniV2LPTokenPrice(network, stakedTokenAddress, web3Provider);
  },
  BSC_0x20bff4bbEDa07536FF00e073bd8359E5D80D733d: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    //CAN (cannon)
    return Number(1 / 1000000000);
  },
  ETH_0x43f11c02439e2736800433b4594994Bd43Cd066D: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    //FOLKI
    return Number(1 / 1000000000);
  },
  ETH_0x26FA3fFFB6EfE8c1E69103aCb4044C26B9A106a9: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // sSPELL
    const stakedTokenContract = StakedToken__factory.connect(stakedTokenAddress, web3Provider);
    const stakedTokenInfos = await GetTokenInfos(network, stakedTokenAddress);
    const tokenAddress = await stakedTokenContract.token();
    const tokenInfos = await GetTokenInfos(network, tokenAddress);
    const tokenContract = CToken__factory.connect(tokenAddress, web3Provider);

    const stakedTokenTotalSupply = await stakedTokenContract.totalSupply();
    const normalizedStakedTokenTotalSupply = normalize(stakedTokenTotalSupply, stakedTokenInfos.decimals);
    const stakedTokenUnderlyingBalance = await tokenContract.balanceOf(stakedTokenAddress);
    const normalizedStakedTokenUnderlyingBalance = normalize(stakedTokenUnderlyingBalance, tokenInfos.decimals);

    const underlyingPrice = await GetPrice(network, tokenAddress, web3Provider);

    return (normalizedStakedTokenUnderlyingBalance * underlyingPrice) / normalizedStakedTokenTotalSupply;
  },
  ETH_0xF3A43307DcAFa93275993862Aae628fCB50dC768: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // curve lp token for cvxFXS / FXS
    const curveContract = Curve__factory.connect('0xd658A338613198204DCa1143Ac3F01A722b5d94A', web3Provider);
    const priceInFxs = await curveContract.lp_price();
    const priceInFxsNormalized = normalize(priceInFxs, 18);

    const fxsPrice = await GetPrice(network, '0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0', web3Provider);
    console.log({ priceInFxs }, { fxsPrice });

    return priceInFxsNormalized * fxsPrice;
  },
  ETH_0x1985365e9f78359a9B6AD760e32412f4a445E862: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // old REP
    // return price of new rep
    return await GetPrice(network, '0x221657776846890989a759BA2973e427DfF5C9bB', web3Provider);
  },
  ETH_0x9cA85572E6A3EbF24dEDd195623F188735A5179f: async (
    web3Provider: JsonRpcProvider,
    network: string,
    stakedTokenAddress: string
  ) => {
    // y3Crv
    const stakedTokenContract = StakedToken__factory.connect(stakedTokenAddress, web3Provider);
    const stakedTokenInfos = await GetTokenInfos(network, stakedTokenAddress);
    const tokenAddress = await stakedTokenContract.token();
    const tokenInfos = await GetTokenInfos(network, tokenAddress);
    const tokenContract = CToken__factory.connect(tokenAddress, web3Provider);

    const stakedTokenTotalSupply = await stakedTokenContract.totalSupply();
    const normalizedStakedTokenTotalSupply = normalize(stakedTokenTotalSupply, stakedTokenInfos.decimals);
    const stakedTokenUnderlyingBalance = await tokenContract.balanceOf(stakedTokenAddress);
    const normalizedStakedTokenUnderlyingBalance = normalize(stakedTokenUnderlyingBalance, tokenInfos.decimals);

    const underlyingPrice = await GetPrice(network, tokenAddress, web3Provider);

    return (normalizedStakedTokenUnderlyingBalance * underlyingPrice) / normalizedStakedTokenTotalSupply;
  },
  ETH_0x81d66D255D47662b6B16f3C5bbfBb15283B05BC2: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // ibZAR
    return await getChainlinkPrice(web3Provider, '0x438F81D95761d7036cd2617295827D9d01Cf593f');
  },
  ETH_0x69681f8fde45345C3870BCD5eaf4A05a60E7D227: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // ibGBP
    return await getChainlinkPrice(web3Provider, '0x5c0Ab2d9b5a7ed9f470386e82BB36A3613cDd4b5');
  },
  ETH_0xFAFdF0C4c1CB09d430Bf88c75D88BB46DAe09967: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // ibAUD
    return await getChainlinkPrice(web3Provider, '0x77F9710E7d0A19669A13c055F62cd80d313dF022');
  },
  ETH_0x5555f75e3d5278082200Fb451D1b6bA946D8e13b: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // ibJPY
    return await getChainlinkPrice(web3Provider, '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3');
  },
  ETH_0x95dFDC8161832e4fF7816aC4B6367CE201538253: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // ibKRW
    return await getChainlinkPrice(web3Provider, '0x01435677FB11763550905594A16B645847C1d0F3');
  },
  ETH_0x1CC481cE2BD2EC7Bf67d1Be64d4878b16078F309: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // ibCHF
    return await getChainlinkPrice(web3Provider, '0x449d117117838fFA61263B61dA6301AA2a88B13A');
  },
  NEAR_0x5183e1B1091804BC2602586919E6880ac1cf2896: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // fetch USN price from coingecko simple price API
    const coingeckoCall = 'https://api.coingecko.com/api/v3/simple/price?ids=usn&vs_currencies=USD';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosResp: any = await retry(axios.get, [coingeckoCall]);
    return Number(axiosResp.data['usn'].usd);
  },
  CRO_0x87EFB3ec1576Dec8ED47e58B832bEdCd86eE186e: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // fetch TUSD price from coingecko simple price API
    const coingeckoCall = 'https://api.coingecko.com/api/v3/simple/price?ids=true-usd&vs_currencies=USD';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosResp: any = await retry(axios.get, [coingeckoCall]);
    return Number(axiosResp.data['true-usd'].usd);
  },
  OPTIMISM_0x1DB2466d9F5e10D7090E7152B68d62703a2245F0: async (
    web3Provider: JsonRpcProvider,
    network: string,
    address: string
  ) => {
    // SONNE
    const coingeckoCall = 'https://api.coingecko.com/api/v3/simple/price?ids=sonne-finance&vs_currencies=USD';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const axiosResp: any = await retry(axios.get, [coingeckoCall]);
    return Number(axiosResp.data['sonne-finance'].usd);
  }
};

async function getUniV2LPTokenPrice(network: string, address: string, web3Provider: JsonRpcProvider) {
  try {
    const lptoken = UniswapV2Pair__factory.connect(address, web3Provider);
    const token0Address = await lptoken.token0();
    const token1Address = await lptoken.token1();
    const totalSupply = await lptoken.totalSupply();
    const lpTokenInfos = await GetTokenInfos(network, address);
    const totalSupplyNormalized = normalize(totalSupply, lpTokenInfos.decimals);

    const token0 = ERC20__factory.connect(token0Address, web3Provider);
    const token1 = ERC20__factory.connect(token1Address, web3Provider);

    const token0Infos = await GetTokenInfos(network, token0Address);
    const token1Infos = await GetTokenInfos(network, token1Address);
    const bal0 = await token0.balanceOf(address);
    const bal1 = await token1.balanceOf(address);
    const bal0Normalized = normalize(bal0, token0Infos.decimals);
    const bal1Normalized = normalize(bal1, token1Infos.decimals);

    const price0 = await GetPrice(network, token0Address, web3Provider);
    const price1 = await GetPrice(network, token1Address, web3Provider);

    const token0Val = bal0Normalized * price0;
    const token1Val = bal1Normalized * price1;

    const lpValue = (token0Val + token1Val) / totalSupplyNormalized;

    return lpValue;
  } catch (e) {
    console.error(e);
    return 0;
  }
}

async function getChainlinkPrice(web3Provider: JsonRpcProvider, feedAddress: string) {
  const feed = Chainlink__factory.connect(feedAddress, web3Provider);

  const answer = await feed.latestAnswer();
  const decimals = Number(await feed.decimals());
  const price = normalize(answer, decimals);
  return price;
}
