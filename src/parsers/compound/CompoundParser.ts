import { CToken__factory, Comptroller, Comptroller__factory } from '../../contracts/types';
import { GetEthPrice, GetPrice, getCTokenPriceFromZapper } from '../../utils/PriceHelper';
import { GetTokenInfos } from '../../utils/TokenHelper';
import { ProtocolParser } from '../ProtocolParser';
import { CompoundConfig } from './CompoundConfig';

export class CompoundParser extends ProtocolParser {
  config: CompoundConfig;
  markets: string[];
  comptroller: Comptroller;
  decimals: { [tokenAddress: string]: number };

  constructor(
    config: CompoundConfig,
    rpcURL: string,
    outputJsonFileName: string,
    heavyUpdateInterval?: number,
    fetchDelayInHours?: number
  ) {
    super(rpcURL, outputJsonFileName, heavyUpdateInterval, fetchDelayInHours);
    this.config = config;
    this.markets = [];
    this.comptroller = Comptroller__factory.connect(config.comptrollerAddress, this.web3Provider);
    this.decimals = {};
  }

  override async initPrices(): Promise<void> {
    let logPrefix = `${this.runnerName} | initPrices |`;
    console.log(`${logPrefix} getting compound markets`);
    this.markets = await this.comptroller.getAllMarkets();
    console.log(`${logPrefix} found ${this.markets.length} markets`);

    const prices: { [tokenAddress: string]: number } = {};
    for (const market of this.markets) {
      const marketInfos = await GetTokenInfos(this.config.network, market);
      logPrefix = `${this.runnerName} | initPrices | ${marketInfos.symbol} |`;
      console.log(`${logPrefix} working on ${marketInfos.symbol}`);
      if (market == this.config.cETHAddress) {
        console.log(`${logPrefix} market is cETH, getting eth price`);
        prices[market] = await GetEthPrice(this.config.network);
        console.log(`${logPrefix} eth price = $${prices[market]}`);
      } else {
        console.log(`${logPrefix} getting underlying`);
        const ctokenContract = CToken__factory.connect(market, this.web3Provider);
        const underlying = await ctokenContract.underlying();
        const underlyingInfos = await GetTokenInfos(this.config.network, underlying);
        console.log(`${logPrefix} underlying is ${underlyingInfos.symbol}`);
        prices[market] = await GetPrice(this.config.network, underlying, this.web3Provider);
        if (prices[market] == 0) {
          console.log(`${logPrefix} using zapper to get price for underlying`);
          prices[market] = await getCTokenPriceFromZapper(market, underlying, this.web3Provider, this.config.network);
        }
        console.log(`${logPrefix} price is ${prices[market]}`);
      }

      if (prices[market] == 0) {
        console.log(`${logPrefix} getting fallback price`);
        prices[market] = await this.getFallbackPrice(market);
        console.log(`${logPrefix} price is ${prices[market]}`);
      }
    }

    console.log(`${this.runnerName} | initPrices | prices:`, prices);

    this.prices = prices;
  }

  override async getFallbackPrice(address: string): Promise<number> {
    return 0;
  }

  override async fetchUsersData(blockNumber: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
