import { ethers } from 'ethers';
import { MetaMorpho, MetaMorpho__factory, MorphoBlue, MorphoBlue__factory } from '../../contracts/types';
import { TypedDeferredTopicFilter, TypedContractEvent } from '../../contracts/types/common';
import { SupplyEvent } from '../../contracts/types/MorphoBlue';
import { FetchAllEventsAndExtractStringArray } from '../../utils/EventHelper';
import { ExecuteMulticall, MulticallParameter } from '../../utils/MulticallHelper';
import { GetPrice } from '../../utils/PriceHelper';
import { GetTokenInfos } from '../../utils/TokenHelper';
import { LoadUserListFromDisk, SaveUserListToDisk } from '../../utils/UserHelper';
import { normalize, retry, roundTo, sleep } from '../../utils/Utils';
import { ComputeUserValue, ProtocolParser } from '../ProtocolParser';
import { MorphoBlueConfig } from './MorphoBlueConfig';

const SHARE_DECIMALS = 10; // used to normalize the share number, does not really matter as long as it's always the same number that is used

interface MorphoMarketData {
  loanToken: string;
  loanTokenDecimals: number;
  collateralToken: string;
  collateralTokenDecimals: number;
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
        if (marketParams.collateralToken == ethers.ZeroAddress) {
          this.prices[marketParams.collateralToken] = 0;
        } else {
          this.prices[marketParams.collateralToken] = await GetPrice(
            this.config.network,
            marketParams.collateralToken,
            this.web3Provider
          );
        }
      }

      // get loan token infos
      const loanTokenInfos = await GetTokenInfos(this.config.network, marketParams.loanToken);

      // get morpho market data
      const marketInfo = await this.morphoBlue.market(marketId);
      const marketBorrow = normalize(marketInfo.totalBorrowAssets, loanTokenInfos.decimals);
      const marketSupply = normalize(marketInfo.totalSupplyAssets, loanTokenInfos.decimals);
      this.marketData[marketId] = {
        collateralToken: marketParams.collateralToken,
        collateralTokenDecimals: 0,
        loanToken: marketParams.loanToken,
        loanTokenDecimals: loanTokenInfos.decimals,
        totalBorrow: marketBorrow,
        totalSupply: marketSupply,
        totalBorrowShares: normalize(marketInfo.totalBorrowShares, SHARE_DECIMALS),
        totalSupplyShares: normalize(marketInfo.totalSupplyShares, SHARE_DECIMALS)
      };

      if (marketParams.collateralToken != ethers.ZeroAddress) {
        const collateralTokenInfos = await GetTokenInfos(this.config.network, marketParams.collateralToken);
        this.marketData[marketId].collateralTokenDecimals = collateralTokenInfos.decimals;
      }

      this.tvl += marketSupply * this.prices[marketParams.loanToken];
      this.borrows += marketBorrow * this.prices[marketParams.loanToken];
    }
  }

  getFallbackPrice(address: string): Promise<number> {
    return Promise.resolve(0);
  }

  /**
   * For now, does a full "heavy update" each run
   * @param blockNumber the block number to reach
   */
  async fetchUsersData(blockNumber: number): Promise<void> {
    const logPrefix = `${this.runnerName} | fetchUsersData |`;

    console.log(`${logPrefix} starting fetch users data`);
    const usersToUpdate: string[] = await this.collectAllUsersForMarkets(blockNumber);

    console.log(`${logPrefix} users to update: ${usersToUpdate.length}`);
    await this.updateUsers(usersToUpdate);

    console.log(`${logPrefix} users updated, computing specific TVL`);
    await this.computeTVL();
  }

  async computeTVL() {
    // from initPrices, the TVL is set as:
    //  this.tvl += marketSupply * this.prices[marketParams.loanToken];
    // which is the sum of the markets supply
    // now we also want to add the user net values to it
    console.log(`computeTVL: TVL without userNet value: ${this.tvl}`);
    for (const [user, data] of Object.entries(this.users)) {
      const userValue = ComputeUserValue(data, this.prices);

      // add optional aditional user collateral in $
      const additionalCollateral = await this.additionalCollateralBalance(user);
      if (additionalCollateral > 0) {
        console.log(`${this.runnerName}: adding additional collateral for user ${user}: ${additionalCollateral}`);
        userValue.netValueUsd = userValue.netValueUsd + additionalCollateral;
        userValue.collateralUsd = userValue.collateralUsd + additionalCollateral;
      }

      this.tvl += userValue.netValueUsd;
    }

    console.log(`computeTVL: TVL with userNet value: ${this.tvl}`);
  }

  async collectAllUsersForMarkets(blockNumber: number): Promise<string[]> {
    this.userList = [];
    let firstBlockToFetch = this.config.deployBlock;

    // load users from disk file if any
    const storedUserData = LoadUserListFromDisk(this.userListFullPath);
    if (storedUserData) {
      this.userList = storedUserData.userList;
      firstBlockToFetch = storedUserData.lastBlockFetched + 1;
    }

    for (const marketId of this.marketIds) {
      const filterSupply = this.morphoBlue.filters.Supply(marketId);
      await this.GetAndMergeUsersForFilter(filterSupply, firstBlockToFetch, blockNumber, marketId);
      const filterSupplyCollateral = this.morphoBlue.filters.SupplyCollateral(marketId);
      await this.GetAndMergeUsersForFilter(filterSupplyCollateral, firstBlockToFetch, blockNumber, marketId);
    }

    // save user list in disk file
    SaveUserListToDisk(this.userListFullPath, this.userList, blockNumber);

    // return full user list to be updated
    return this.userList;
  }

  private async GetAndMergeUsersForFilter(
    filter: TypedDeferredTopicFilter<
      TypedContractEvent<SupplyEvent.InputTuple, SupplyEvent.OutputTuple, SupplyEvent.OutputObject>
    >,
    firstBlockToFetch: number,
    blockNumber: number,
    marketId: string
  ) {
    const userListForThisMarket = await FetchAllEventsAndExtractStringArray(
      this.morphoBlue,
      'MorphoBlue',
      filter,
      ['onBehalf'],
      firstBlockToFetch,
      blockNumber,
      this.config.blockStepLimit
    );

    const concatenatedWithMarket = userListForThisMarket.map((userAddress) => `${userAddress}_${marketId}`);
    // merge into this.userList with old userList without duplicates
    this.userList = Array.from(new Set(this.userList.concat(concatenatedWithMarket)));
  }

  async updateUsers(usersToUpdate: string[]) {
    // delete all users that will be updated from this.users
    // this is needed because the 'updateUsersWithMulticall' function only updates debt and collateral
    // of the markets where the user is in. Without this, if a user is in market "A" during the first iteration
    // then change all his "A" tokens to "B", then the second iteration will not update his "A" token value to 0 and
    // will add some "B" tokens to debt/collateral. This creates a deviation from reality
    if (Object.keys(this.users).length > 0) {
      for (const userToUpdate of usersToUpdate) {
        console.log(`resetting values for user ${userToUpdate}`);
        delete this.users[userToUpdate];
      }
    }

    // then in batch, fetch users data using multicall
    let startIndex = 0;
    let promises = [];
    while (startIndex < usersToUpdate.length) {
      let endIndex = startIndex + this.config.multicallSize;
      if (endIndex >= usersToUpdate.length) {
        endIndex = usersToUpdate.length;
      }

      const userAddresses = usersToUpdate.slice(startIndex, endIndex);
      console.log(
        `updateUsers: fetching users [${startIndex} -> ${endIndex - 1}]. Progress: ${roundTo(
          (endIndex / usersToUpdate.length) * 100
        )}%`
      );

      promises.push(this.updateUsersWithMulticall(userAddresses));
      await sleep(100);

      if (promises.length >= this.config.multicallParallelSize) {
        // console.log('awaiting multicalls');
        await Promise.all(promises);
        promises = [];
      }

      startIndex += this.config.multicallSize;
    }
    await Promise.all(promises);
  }

  async updateUsersWithMulticall(userAddresses: string[]) {
    const assetsInParameters: MulticallParameter[] = [];
    for (const userAddress of userAddresses) {
      const user = userAddress.split('_')[0];
      const marketId = userAddress.split('_')[1];
      const assetInParam: MulticallParameter = {
        targetAddress: this.config.morphoBlueAddress,
        targetFunction: 'position(bytes32,address)',
        inputData: [marketId, user],
        //  supplyShares uint256, borrowShares uint128, collateral uint128
        outputTypes: ['uint256', 'uint128', 'uint128']
      };

      assetsInParameters.push(assetInParam);
    }

    // assetIn results will store each assetIn value for each users in the valid order
    const positionResults = await retry(ExecuteMulticall, [this.config.network, this.web3Provider, assetsInParameters]);

    let userIndex = 0;
    for (const userAddress of userAddresses) {
      const user = userAddress.split('_')[0];
      const marketId = userAddress.split('_')[1];

      const marketDataForMarket = this.marketData[marketId];

      const userResult = positionResults[userIndex];

      const borrowShares = normalize(userResult[1], SHARE_DECIMALS);
      const collateral = normalize(userResult[2], marketDataForMarket.collateralTokenDecimals);

      let borrowAssets = 0;
      if (borrowShares > 0) {
        borrowAssets =
          (this.marketData[marketId].totalBorrow * borrowShares) / this.marketData[marketId].totalBorrowShares;
      }

      this.users[userAddress] = {
        collaterals: {},
        debts: {}
      };

      this.users[userAddress].collaterals[marketDataForMarket.collateralToken] = collateral;
      this.users[userAddress].debts[marketDataForMarket.loanToken] = borrowAssets;

      userIndex++;
    }
  }

  /**
   * Utility function to list all markets, not used by the parser
   */
  async listMarketsForMorphoBlue() {
    const blue = MorphoBlue__factory.connect('0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb', this.web3Provider);

    const allEvents = await blue.queryFilter(blue.filters.CreateMarket, 18883124, 'latest');
    console.log(allEvents.map((_) => _.args[0]));
  }
}
