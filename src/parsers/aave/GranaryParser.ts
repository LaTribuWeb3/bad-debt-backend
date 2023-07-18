import { AaveParser } from './AaveParser';

export class GranaryParser extends AaveParser {
  override initPrices(): Promise<void> {
    // granary report all values in usd with 8 decimals
    this.chainToken = {
      address: 'usd',
      decimals: 8,
      name: 'usd granary',
      symbol: 'usd'
    };

    this.prices = {
      [`${this.chainToken.address}`]: 1
    };

    return Promise.resolve();
  }
}
