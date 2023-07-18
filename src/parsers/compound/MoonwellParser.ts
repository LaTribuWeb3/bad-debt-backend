import { CompoundOracle__factory } from '../../contracts/types';
import { GetChainToken, GetTokenInfos, TokenInfos } from '../../utils/TokenHelper';
import { normalize, retry } from '../../utils/Utils';
import { CompoundParser } from './CompoundParser';

/**
 * Moonwell parser is a compound fork with specific getFallbackprice
 * All prices will come from the oracle because we can't find token prices from coingecko
 */
export class MoonwellParser extends CompoundParser {
  override async getFallbackPrice(address: string): Promise<number> {
    const rektMarkets = [
      '0xc3090f41eb54a7f18587fd6651d4d3ab477b07a4', // mETH
      '0x24a9d8f1f350d59cb0368d3d52a77db29c833d1d', // mWBTC
      '0x02e9081dfadd37a852f9a73c4d7d69e615e61334' // mUSDC
    ];

    // negligable value
    if (rektMarkets.some((_) => _.toLowerCase() == address.toLowerCase())) {
      return 1 / 1e18;
    } else {
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
      const underlyingPrice = await retry(oracleContract.getUnderlyingPrice, [address]);
      return normalize(underlyingPrice, 36 - underlyingTokenInfos.decimals);
    }
  }
}
