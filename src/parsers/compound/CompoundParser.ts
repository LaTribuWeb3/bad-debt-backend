import { CToken__factory, Comptroller, Comptroller__factory } from '../../contracts/types';
import { Constants } from '../../utils/Constants';
import { FetchAllEventsAndExtractStringArray } from '../../utils/EventHelper';
import { ExecuteMulticall, MulticallParameter } from '../../utils/MulticallHelper';
import { GetEthPrice, GetPrice, getCTokenPriceFromZapper } from '../../utils/PriceHelper';
import { GetTokenInfos } from '../../utils/TokenHelper';
import { LoadUserListFromDisk, SaveUserListToDisk } from '../../utils/UserHelper';
import { normalize } from '../../utils/Utils';
import { ProtocolParser } from '../ProtocolParser';
import { CompoundConfig } from './CompoundConfig';

export class CompoundParser extends ProtocolParser {
  config: CompoundConfig;
  markets: string[];
  comptroller: Comptroller;
  decimals: { [tokenAddress: string]: number };
  rektMarkets: string[];
  nonBorrowableMarkets: string[];
  underlyings: { [cTokenAddress: string]: string };

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
    this.rektMarkets = this.config.rektMarket;
    this.nonBorrowableMarkets = this.config.nonBorrowableMarkets;
    this.underlyings = {};
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
        // for cETH, consider underlying to be WETH
        this.underlyings[market] = Constants.WETH_ADDRESS;
        console.log(`${logPrefix} eth price = $${prices[market]}`);
      } else {
        console.log(`${logPrefix} getting underlying`);
        const ctokenContract = CToken__factory.connect(market, this.web3Provider);
        const underlying = await ctokenContract.underlying();
        this.underlyings[market] = underlying;
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

  override async fetchUsersData(targetBlockNumber: number): Promise<void> {
    const logPrefix = `${this.runnerName} | fetchUsersData |`;
    // when fetching users data, we must check if it's time to do a heavy update or only a light one
    // basically a heavy update re-read all users debts and collateral when a light update only checks
    // the recent movements and only fetch users data for those movements
    let usersToUpdate: string[] = [];
    if (this.lastHeavyUpdate < Date.now() - this.heavyUpdateInterval * 3600 * 1000) {
      console.log(`${logPrefix} starting heavy update because last heavy update is: ${this.lastHeavyUpdate}`);
      usersToUpdate = await this.processHeavyUpdate(targetBlockNumber);
      console.log(`${logPrefix} heavy update completed, will fetch data for ${usersToUpdate.length} users`);
      this.lastHeavyUpdate = Date.now();
    } else {
      console.log(`${logPrefix} starting light update because last heavy update is: ${this.lastHeavyUpdate}`);
      usersToUpdate = await this.processLightUpdate(targetBlockNumber);
      console.log(`${logPrefix} light update completed, will fetch data for ${usersToUpdate.length} users`);
    }

    await this.updateUsers(usersToUpdate);
  }

  async updateUsers(usersToUpdate: string[]) {
    // need to get: 1) user in market 2) user collateral in all markets 3) user borrow balance in all markets
    let startIndex = 0;
    let promises = [];
    while (startIndex < usersToUpdate.length) {
      let endIndex = startIndex + this.config.multicallSize;
      if (endIndex >= usersToUpdate.length) {
        endIndex = usersToUpdate.length;
      }

      const userAddresses = usersToUpdate.slice(startIndex, endIndex);
      console.log(`starting multicall for user index [${startIndex} -> ${endIndex - 1}]`);
      promises.push(this.updateUsersWithMulticall(userAddresses));

      if (promises.length >= this.config.multicallParallelSize) {
        console.log('awaiting promises');
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
      const assetInParam: MulticallParameter = {
        targetAddress: this.config.comptrollerAddress,
        targetFunction: 'getAssetsIn(address)',
        inputData: [userAddress],
        outputTypes: ['address[]']
      };

      assetsInParameters.push(assetInParam);
    }

    // assetIn results will store each assetIn value for each users in the valid order
    const assetsInResults = await ExecuteMulticall(this.config.network, this.web3Provider, assetsInParameters);

    const borrowParameters: MulticallParameter[] = [];
    const collateralParameters: MulticallParameter[] = [];
    for (let userIndex = 0; userIndex < assetsInResults.length; userIndex++) {
      const selectedUser = userAddresses[userIndex];
      const userAssetsIn = assetsInResults[userIndex][0]; // the assetsIn array is the first result
      // console.log(`${selectedUser} is in markets ${userAssetsIn}`);

      for (const market of userAssetsIn) {
        const collateralParam: MulticallParameter = {
          targetAddress: market,
          targetFunction: 'balanceOfUnderlying(address)',
          inputData: [selectedUser],
          outputTypes: ['uint256']
        };

        if (this.rektMarkets.includes(market)) {
          // encode something that will return 0
          collateralParam.targetFunction = 'balanceOf(address)';
        }

        const borrowParam: MulticallParameter = {
          targetAddress: market,
          targetFunction: 'borrowBalanceCurrent(address)',
          inputData: [selectedUser],
          outputTypes: ['uint256']
        };

        if (this.nonBorrowableMarkets.includes(market)) {
          // encode something that will return 0
          borrowParam.targetFunction = 'balanceOf(address)';
        }

        borrowParameters.push(borrowParam);
        collateralParameters.push(collateralParam);
      }
    }

    // assetIn results will store each assetIn value for each users in the valid order
    const collateralResultsPromise = ExecuteMulticall(this.config.network, this.web3Provider, collateralParameters);
    const borrowResultsPromise = await ExecuteMulticall(this.config.network, this.web3Provider, borrowParameters);

    await Promise.all([collateralResultsPromise, borrowResultsPromise]);

    const collateralResults = await collateralResultsPromise;
    const borrowResults = await borrowResultsPromise;

    let index = 0;
    for (let userIndex = 0; userIndex < assetsInResults.length; userIndex++) {
      const selectedUser = userAddresses[userIndex];
      const userAssetsIn = assetsInResults[userIndex][0];
      // console.log(`${selectedUser} is in markets ${userAssetsIn}`);

      for (const market of userAssetsIn) {
        const marketTokenInfos = await GetTokenInfos(this.config.network, this.underlyings[market.toString()]);
        const collateralResultForMarket = collateralResults[index][0]; // collateral value is the first result
        const normalizedCollateralResultForMarket = normalize(
          BigInt(collateralResultForMarket.toString()),
          marketTokenInfos.decimals
        );
        const borrowResultForMarket = borrowResults[index][0]; // borrow value is the first result
        const normalizedBorrowResultForMarket = normalize(
          BigInt(borrowResultForMarket.toString()),
          marketTokenInfos.decimals
        );

        if (!this.users[selectedUser]) {
          this.users[selectedUser] = {
            collaterals: {},
            debts: {}
          };
        }

        this.users[selectedUser].collaterals[market] = normalizedCollateralResultForMarket;
        this.users[selectedUser].debts[market] = normalizedBorrowResultForMarket;

        index++;
      }
    }
  }

  async processHeavyUpdate(targetBlockNumber: number): Promise<string[]> {
    this.userList = [];
    let firstBlockToFetch = this.config.deployBlock;

    // load users from disk file if any
    const storedUserData = LoadUserListFromDisk(this.userListFullPath);
    if (storedUserData) {
      this.userList = storedUserData.userList;
      firstBlockToFetch = storedUserData.lastBlockFetched + 1;
    }

    // fetch new users since lastBlockFetched or deploy block if first time
    const newUserList = await FetchAllEventsAndExtractStringArray(
      this.comptroller,
      'comptroller',
      'MarketEntered',
      ['account'],
      firstBlockToFetch,
      targetBlockNumber
    );

    // merge into this.userList with old userList without duplicates
    this.userList = Array.from(new Set(this.userList.concat(newUserList)));

    // save user list in disk file
    SaveUserListToDisk(this.userListFullPath, this.userList, targetBlockNumber);

    // return full user list to be updated
    return this.userList;
  }

  async processLightUpdate(targetBlockNumber: number): Promise<string[]> {
    const logPrefix = `${this.runnerName} | processLightUpdate |`;
    let usersToUpdate: string[] = [];

    const events = {
      Mint: ['minter'],
      Redeem: ['redeemer'],
      Borrow: ['borrower'],
      RepayBorrow: ['borrower'],
      LiquidateBorrow: ['liquidator', 'borrower'],
      Transfer: ['from', 'to']
    };

    for (const market of this.markets) {
      const ctoken = CToken__factory.connect(market, this.web3Provider);
      for (const [eventName, eventArgs] of Object.entries(events)) {
        console.log(
          `${logPrefix} Fetching new events for market ${market}, event name: ${eventName}, args: ${eventArgs.join(
            ', '
          )}`
        );
        const fetchedAccounts = await FetchAllEventsAndExtractStringArray(
          ctoken,
          'CTOKEN',
          eventName,
          eventArgs,
          this.lastUpdateBlock,
          targetBlockNumber
        );
        // merge with usersToUpdate
        usersToUpdate = Array.from(new Set(usersToUpdate.concat(fetchedAccounts)));
      }
    }

    console.log(`${logPrefix}: found ${usersToUpdate.length} users to update`);
    return usersToUpdate;
  }
}
