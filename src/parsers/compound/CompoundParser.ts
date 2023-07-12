import { CToken__factory, Comptroller, Comptroller__factory, ERC20__factory } from '../../contracts/types';
import { CONSTANTS } from '../../utils/Constants';
import { FetchAllEventsAndExtractStringArray } from '../../utils/EventHelper';
import { ExecuteMulticall, MulticallParameter } from '../../utils/MulticallHelper';
import { GetEthPrice, GetPrice, getCTokenPriceFromZapper } from '../../utils/PriceHelper';
import { GetChainToken, GetTokenInfos, TokenInfos } from '../../utils/TokenHelper';
import { LoadUserListFromDisk, SaveUserListToDisk } from '../../utils/UserHelper';
import { normalize, retry, roundTo, sleep } from '../../utils/Utils';
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
    runnerName: string,
    rpcURL: string,
    outputJsonFileName: string,
    heavyUpdateInterval?: number,
    fetchDelayInHours?: number
  ) {
    super(runnerName, rpcURL, outputJsonFileName, heavyUpdateInterval, fetchDelayInHours);
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
    this.markets = await retry(this.comptroller.getAllMarkets, []);
    console.log(`${logPrefix} found ${this.markets.length} markets`);

    this.tvl = 0;
    this.borrows = 0;
    const prices: { [tokenAddress: string]: number } = {};
    for (const market of this.markets) {
      const ctokenContract = CToken__factory.connect(market, this.web3Provider);
      let marketBalanceNormalized = 0;
      let marketBorrowsNormalized = 0;
      const marketInfos = await GetTokenInfos(this.config.network, market);
      logPrefix = `${this.runnerName} | initPrices | ${marketInfos.symbol} |`;
      console.log(`${logPrefix} working on ${marketInfos.symbol}`);

      if (this.config.cETHAddresses.some((_) => _.toLowerCase() == market.toLowerCase())) {
        const chainToken = GetChainToken(this.config.network);
        console.log(`${logPrefix} market is cETH: ${chainToken.symbol}, getting chain token price`);
        prices[market] = await GetEthPrice(this.config.network);
        // for cETH, consider underlying to be ETH
        this.underlyings[market] = chainToken.address;
        console.log(`${logPrefix} ${chainToken.symbol} price = $${prices[market]}`);
        marketBalanceNormalized = normalize(
          await retry(() => this.web3Provider.getBalance(market), []),
          chainToken.decimals
        );
        marketBorrowsNormalized = normalize(await retry(ctokenContract.totalBorrows, []), chainToken.decimals);
      } else {
        console.log(`${logPrefix} getting underlying`);
        const underlying = await retry(ctokenContract.underlying, []);
        this.underlyings[market] = underlying;
        const underlyingInfos = await GetTokenInfos(this.config.network, underlying);
        console.log(`${logPrefix} underlying is ${underlyingInfos.symbol}`);
        prices[market] = await GetPrice(this.config.network, underlying, this.web3Provider);
        if (prices[market] == 0 && this.config.network.toUpperCase() == 'ETH') {
          console.log(`${logPrefix} using zapper to get price for underlying`);
          prices[market] = await getCTokenPriceFromZapper(market, underlying, this.web3Provider, this.config.network);
        }
        console.log(`${logPrefix} price is ${prices[market]}`);
        const underlyingErc20Contract = ERC20__factory.connect(underlying, this.web3Provider);
        marketBalanceNormalized = normalize(
          await retry(underlyingErc20Contract.balanceOf, [market]),
          underlyingInfos.decimals
        );

        if (this.nonBorrowableMarkets.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          marketBorrowsNormalized = 0;
        } else {
          marketBorrowsNormalized = normalize(await retry(ctokenContract.totalBorrows, []), underlyingInfos.decimals);
        }
      }

      if (prices[market] == 0) {
        console.log(`${logPrefix} getting fallback price`);
        prices[market] = await this.getFallbackPrice(market);
        console.log(`${logPrefix} price is ${prices[market]}`);
      }

      const marketBalanceUsd = marketBalanceNormalized * prices[market];
      this.tvl += marketBalanceUsd;
      const marketBorrowsUsd = marketBorrowsNormalized * prices[market];
      this.borrows += marketBorrowsUsd;
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
    let isHeavyUpdate = false;
    if (this.lastHeavyUpdate < Date.now() - this.heavyUpdateInterval * 3600 * 1000) {
      isHeavyUpdate = true;
      console.log(`${logPrefix} starting heavy update because last heavy update is: ${this.lastHeavyUpdate}`);
      usersToUpdate = await this.processHeavyUpdate(targetBlockNumber);
      console.log(`${logPrefix} heavy update completed, will fetch data for ${usersToUpdate.length} users`);
    } else {
      const nextHeavyUpdateSeconds =
        (this.heavyUpdateInterval * 3600 * 1000 - (Date.now() - this.lastHeavyUpdate)) / 1000;
      console.log(
        `${logPrefix} starting light update because last heavy update is: ${this.lastHeavyUpdate}. Next heavy update: ${nextHeavyUpdateSeconds}`
      );
      usersToUpdate = await this.processLightUpdate(targetBlockNumber);
      console.log(`${logPrefix} light update completed, will fetch data for ${usersToUpdate.length} users`);
    }

    await this.updateUsers(usersToUpdate);

    // Only update this.lastHeavyUpdate if everything went OK
    if (isHeavyUpdate) {
      this.lastHeavyUpdate = Date.now();
    }
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

  /**
   * TODO EXPLAIN THIS FUNCTION BECAUSE ITS THE ONE THAT GET USERS DATA
   * @param userAddresses
   */
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
    const assetsInResults = await retry(ExecuteMulticall, [this.config.network, this.web3Provider, assetsInParameters]);

    const snapshotParameters: MulticallParameter[] = [];
    for (let userIndex = 0; userIndex < assetsInResults.length; userIndex++) {
      const selectedUser = userAddresses[userIndex];
      const userAssetsIn = assetsInResults[userIndex][0]; // the assetsIn array is the first result
      // console.log(`${selectedUser} is in markets ${userAssetsIn}`);

      for (const market of userAssetsIn) {
        const snapshotParam: MulticallParameter = {
          targetAddress: market,
          targetFunction: 'getAccountSnapshot(address)',
          inputData: [selectedUser],
          outputTypes: ['uint256', 'uint256', 'uint256', 'uint256']
        };

        snapshotParameters.push(snapshotParam);
      }
    }

    const snapshotResults = await retry(ExecuteMulticall, [this.config.network, this.web3Provider, snapshotParameters]);

    let index = 0;
    for (let userIndex = 0; userIndex < assetsInResults.length; userIndex++) {
      const selectedUser = userAddresses[userIndex];
      const userAssetsIn = assetsInResults[userIndex][0];
      // console.log(`${selectedUser} is in markets ${userAssetsIn}`);

      for (const market of userAssetsIn) {
        const cTokenInfos = await GetTokenInfos(this.config.network, market.toString());
        let marketTokenInfos: TokenInfos | undefined = undefined;
        if (this.config.cETHAddresses.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          marketTokenInfos = GetChainToken(this.config.network);
        } else {
          marketTokenInfos = await GetTokenInfos(this.config.network, this.underlyings[market.toString()]);
        }

        // snapshot returns: (possible error, token balance, borrow balance, exchange rate mantissa)
        const collateralBalanceInCToken = snapshotResults[index][1];
        const normalizedCollateralBalanceInCToken = normalize(
          BigInt(collateralBalanceInCToken.toString()),
          cTokenInfos.decimals
        );
        const borrowBalance = snapshotResults[index][2];
        const exchangeRateMantissa = snapshotResults[index][3];

        const exchangeRateDecimals = 18 - 8 + marketTokenInfos.decimals;
        const normalizedExchangeRate = normalize(BigInt(exchangeRateMantissa.toString()), exchangeRateDecimals);
        let normalizedCollateralBalance = normalizedExchangeRate * normalizedCollateralBalanceInCToken;
        let normalizedBorrowBalance = normalize(BigInt(borrowBalance.toString()), marketTokenInfos.decimals);

        if (this.nonBorrowableMarkets.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          normalizedBorrowBalance = 0;
        }
        if (this.rektMarkets.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          normalizedCollateralBalance = 0;
        }

        // only save user if he has any value (collateral or borrow)
        // this is done to save some RAM
        if (normalizedCollateralBalance > 0 || normalizedBorrowBalance > 0) {
          if (!this.users[selectedUser]) {
            this.users[selectedUser] = {
              collaterals: {},
              debts: {}
            };
          }

          // only save value if not 0 to save RAM
          if (normalizedCollateralBalance > 0) {
            this.users[selectedUser].collaterals[market] = normalizedCollateralBalance;
          }
          if (normalizedBorrowBalance > 0) {
            this.users[selectedUser].debts[market] = normalizedBorrowBalance;
          }
        }

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
      targetBlockNumber,
      this.config.blockStepLimit
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
          targetBlockNumber,
          this.config.blockStepLimit
        );
        // merge with usersToUpdate
        usersToUpdate = Array.from(new Set(usersToUpdate.concat(fetchedAccounts)));
      }
    }

    console.log(`${logPrefix}: found ${usersToUpdate.length} users to update`);
    return usersToUpdate;
  }
}
