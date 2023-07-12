import { CompoundOracle__factory } from '../../contracts/types';
import { GetChainToken, GetTokenInfos, TokenInfos } from '../../utils/TokenHelper';
import { normalize, retry } from '../../utils/Utils';
import { CompoundParser } from './CompoundParser';

/**
 * Inverse parser is a compound fork with specific getFallbackprice
 */
export class InverseParser extends CompoundParser {
  oracleAddress?: string;

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

    // The price of the asset in USD as an unsigned integer scaled up by 10 ^ (36 - underlying asset decimals)
    const underlyingPrice = await retry(oracleContract.getUnderlyingPrice, [address]);
    return normalize(underlyingPrice, 36 - underlyingTokenInfos.decimals);
  }
}
