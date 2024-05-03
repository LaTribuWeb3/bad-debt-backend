import { CompoundOracle__factory } from '../../contracts/types';
import { GetPrice } from '../../utils/PriceHelper';
import { GetChainToken, GetTokenInfos, TokenInfos } from '../../utils/TokenHelper';
import { normalize, retry } from '../../utils/Utils';
import { CompoundParser } from './CompoundParser';

const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

/**
 * Ionic parser is a compound fork with specific getFallbackprice because the Ionic oracle returns the price in WETH
 * Because we want the price in usd: we simply multiply the oracle price by the weth price in usd.
 * Also the 'exchangeRateDecimals' in the updateUsersWithMulticall is set to 18 and not 18 - 8 + token decimals
 */
export class IonicParser extends CompoundParser {
  override async getFallbackPrice(address: string): Promise<number> {
    if (!this.oracleAddress) {
      this.oracleAddress = await retry(this.comptroller.oracle, []);
    }

    const oracleContract = CompoundOracle__factory.connect(this.oracleAddress, this.web3Provider);

    let underlyingTokenInfos: TokenInfos | undefined = undefined;
    if (this.config.cETHAddresses.some((_) => _.toLowerCase() == address.toLowerCase())) {
      underlyingTokenInfos = GetChainToken(this.config.network);
    } else {
      underlyingTokenInfos = await GetTokenInfos(this.config.network, this.underlyings[address]);
    }
    // The price of the asset in ETH as an unsigned integer scaled up by 10 ^ (36 - underlying asset decimals)
    const underlyingPrice = await retry(oracleContract.getUnderlyingPrice, [address]);

    const wethPrice = await GetPrice(this.config.network, WETH_ADDRESS, this.web3Provider);
    return normalize(underlyingPrice, 36 - underlyingTokenInfos.decimals) * wethPrice;
  }

  // for Ionic, exchange rate decimals is 18
  override getExchangeRateDecimals(marketTokenInfos: TokenInfos) {
    return 18;
  }
}
