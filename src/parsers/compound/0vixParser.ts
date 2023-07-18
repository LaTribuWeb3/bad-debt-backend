import { CompoundOracle__factory } from '../../contracts/types';
import { GetChainToken, GetTokenInfos, TokenInfos } from '../../utils/TokenHelper';
import { normalize, retry } from '../../utils/Utils';
import { CompoundParser } from './CompoundParser';

/**
 * 0vix parser is a compound fork with specific getFallbackprice to not retry too muche
 */
export class _0vixParser extends CompoundParser {
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

    // The price of the asset in USD as an unsigned integer scaled up by 10 ^ (36 - underlying asset decimals
    try {
      // The price of the asset in USD as an unsigned integer scaled up by 10 ^ (36 - underlying asset decimals
      const underlyingPrice = await oracleContract.getUnderlyingPrice(address);
      return normalize(underlyingPrice, 36 - underlyingTokenInfos.decimals);
    } catch (e) {
      console.error(e);
      console.log(
        `Error when getting fallback price for token ${address} on oracle ${this.oracleAddress}. Returning 0`
      );
      return 0;
    }
  }
}
