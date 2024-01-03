import { MetaMorpho, MetaMorpho__factory, MorphoBlue, MorphoBlue__factory } from '../../contracts/types';
import { GetPrice } from '../../utils/PriceHelper';
import { GetTokenInfos } from '../../utils/TokenHelper';
import { normalize } from '../../utils/Utils';
import { ProtocolParser } from '../ProtocolParser';
import { MorphoBlueConfig } from './MorphoBlueConfig';

interface MorphoMarketData {
  loanToken: string;
  collateralToken: string;
  totalSupply: number;
  totalBorrow: number;
  totalSupplyShares: number;
  totalBorrowShares: number;
}

export class MorphoBlueParser extends ProtocolParser {
  config: MorphoBlueConfig;
  morphoBlue: MorphoBlue;
  marketIds: Set<string>;
  marketData: { [marketId: string]: MorphoMarketData };

  constructor(
    config: MorphoBlueConfig,
    runnerName: string,
    rpcURL: string,
    outputJsonFileName: string,
    heavyUpdateInterval?: number,
    fetchDelayInHours?: number
  ) {
    super(runnerName, rpcURL, outputJsonFileName, heavyUpdateInterval, fetchDelayInHours);
    this.config = config;
    this.morphoBlue = MorphoBlue__factory.connect(config.morphoBlueAddress, this.web3Provider);
    this.marketIds = new Set<string>();
    this.marketData = {};
  }

  /**
   * Get all the morpho blue markets used in the configured metamorpho vaults
   */
  async initPrices(): Promise<void> {
    // reset prices
    this.prices = {};
    // reset morpho market data
    this.marketData = {};

    // reset total borrow and tvl
    this.borrows = 0;
    this.tvl = 0;

    for (const vaultAddress of this.config.vaultAddresses) {
      // instanciate new vault contract
      const vault: MetaMorpho = MetaMorpho__factory.connect(vaultAddress, this.web3Provider);

      // get the withdraw queue length to fetch the withdraw queue
      // and then the different markets
      const vaultQueueLength = Number(await vault.withdrawQueueLength());
      for (let i = 0; i < vaultQueueLength; i++) {
        const marketId = await vault.withdrawQueue(i);
        this.marketIds.add(marketId);
      }
    }

    console.log(`Fetched ${this.marketIds.size} markets from ${this.config.vaultAddresses.length} vaults`);
    console.log('Fetching prices');

    for (const marketId of this.marketIds) {
      // get the market params
      const marketParams = await this.morphoBlue.idToMarketParams(marketId);

      // get loan token price if not already known
      if (!this.prices[marketParams.loanToken]) {
        this.prices[marketParams.loanToken] = await GetPrice(
          this.config.network,
          marketParams.loanToken,
          this.web3Provider
        );
      }

      // get collateral token price if not already known
      if (!this.prices[marketParams.collateralToken]) {
        this.prices[marketParams.collateralToken] = await GetPrice(
          this.config.network,
          marketParams.collateralToken,
          this.web3Provider
        );
      }

      // get loan token infos
      const loanTokenInfos = await GetTokenInfos(this.config.network, marketParams.loanToken);

      // get morpho market data
      const marketInfo = await this.morphoBlue.market(marketId);
      const marketBorrow = normalize(marketInfo.totalBorrowAssets, loanTokenInfos.decimals);
      const marketSupply = normalize(marketInfo.totalSupplyAssets, loanTokenInfos.decimals);
      this.marketData[marketId] = {
        collateralToken: marketParams.collateralToken,
        loanToken: marketParams.loanToken,
        totalBorrow: marketBorrow,
        totalSupply: marketSupply,
        totalBorrowShares: normalize(marketInfo.totalBorrowShares, 12),
        totalSupplyShares: normalize(marketInfo.totalSupplyShares, 12)
      };

      this.tvl += marketSupply * this.prices[marketParams.loanToken];
      this.borrows += marketBorrow * this.prices[marketParams.loanToken];
    }
  }

  getFallbackPrice(address: string): Promise<number> {
    return Promise.resolve(0);
  }

  fetchUsersData(blockNumber: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
