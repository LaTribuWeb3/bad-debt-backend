import { Comptroller, Comptroller__factory } from '../../contracts/types';
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

  async initPrices(): Promise<void> {
    console.log(`${this.runnerName}: get markets`);
    this.markets = await this.comptroller.getAllMarkets();
    console.log(`${this.runnerName}: found markets:`, this.markets);

    const prices: { [tokenAddress: string]: number } = {};
    for (const market of this.markets) {
      prices[market] = 1;
    }

    console.log(`${this.runnerName}: prices:`, prices);

    this.prices = prices;
  }

  heavyUpdate(blockNumber: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
  lightUpdate(blockNumber: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
