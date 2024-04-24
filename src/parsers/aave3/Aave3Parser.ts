import {
  Aave3Pool,
  Aave3Pool__factory,
  Aave3PoolAddressesProviderRegistry__factory,
  Aave3PoolAddressesProvider__factory,
  Aave3PoolAddressesProviderRegistry
} from '../../contracts/types';
import { FetchAllEventsAndExtractStringArray } from '../../utils/EventHelper';
import { ExecuteMulticall, MulticallParameter } from '../../utils/MulticallHelper';
import { GetChainToken, TokenInfos } from '../../utils/TokenHelper';
import { LoadUserListFromDisk, SaveUserListToDisk } from '../../utils/UserHelper';
import { normalize, retry, roundTo, sleep } from '../../utils/Utils';
import { ProtocolParser } from '../ProtocolParser';
import { Aave3Config } from './Aave3Config';

const AAVE3_DECIMALS_USD = 8

export class Aave3Parser extends ProtocolParser {
  config: Aave3Config;
  poolAddressProviderRegistry: Aave3PoolAddressesProviderRegistry;
  pool?: Aave3Pool;
  chainToken: TokenInfos;

  constructor(
    config: Aave3Config,
    runnerName: string,
    rpcURL: string,
    outputJsonFileName: string,
    heavyUpdateInterval?: number,
    fetchDelayInHours?: number
  ) {
    super(runnerName, rpcURL, outputJsonFileName, heavyUpdateInterval, fetchDelayInHours);
    this.config = config;
    this.poolAddressProviderRegistry = Aave3PoolAddressesProviderRegistry__factory.connect(
      config.poolAddressesProviderRegistryAddress,
      this.web3Provider
    );

    this.chainToken = GetChainToken(this.config.network);
  }

  override getFallbackPrice(address: string): Promise<number> {
    return Promise.resolve(0);
  }

  override async initPrices(): Promise<void> {
    this.prices = { USD: 1 };
  }

  async getPool(): Promise<Aave3Pool> {
    if (!this.pool) {
      console.log(`${this.runnerName} | getLendingPool | getting lending pool`);
      const poolAddressProviderList = await this.poolAddressProviderRegistry.getAddressesProvidersList();
      if (poolAddressProviderList.length != 1) {
        throw new Error("Length of pool provider list for Aave3 addresses providers different than 1");
      }
      const poolAddressProviderContract = Aave3PoolAddressesProvider__factory.connect(poolAddressProviderList[0], this.web3Provider);
      const lendingPoolAddress = await poolAddressProviderContract.getPool();
      console.log(`${this.runnerName} | getLendingPool | got lending pool: ${lendingPoolAddress}`);
      this.pool = Aave3Pool__factory.connect(lendingPoolAddress, this.web3Provider);
    }

    return this.pool;
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
    const poolContract = await this.getPool();
    const poolAddress = await poolContract.getAddress();
    const getUserAccountDataParameters: MulticallParameter[] = [];
    for (const userAddress of userAddresses) {
      const assetInParam: MulticallParameter = {
        targetAddress: poolAddress,
        targetFunction: 'getUserAccountData(address)',
        inputData: [userAddress],
        outputTypes: ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256']
      };

      getUserAccountDataParameters.push(assetInParam);
    }

    // assetIn results will store each assetIn value for each users in the valid order
    const userAccountDataResults = await retry(ExecuteMulticall, [
      this.config.network,
      this.web3Provider,
      getUserAccountDataParameters
    ]);

    for (let i = 0; i < userAddresses.length; i++) {
      const userAddress = userAddresses[i];
      const accountData = userAccountDataResults[i];
      const userCollateral = accountData[0];
      const userCollateralNormalized = normalize(userCollateral, AAVE3_DECIMALS_USD);
      const userDebt = accountData[1];
      const userDebtNormalized = normalize(userDebt, AAVE3_DECIMALS_USD);

      if (userCollateralNormalized > 0 || userDebtNormalized > 0) {
        this.users[userAddress] = {
          collaterals: {
            "USD": userCollateralNormalized
          },
          debts: {
            "USD": userDebtNormalized
          }
        };
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

    const poolContract = await this.getPool();
    // fetch new users since lastBlockFetched or deploy block if first time
    const newUserList = await FetchAllEventsAndExtractStringArray(
      poolContract,
      'pool',
      'Supply',
      ['onBehalfOf'],
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
      Supply: ['onBehalfOf'],
      Withdraw: ['user'],
      Borrow: ['onBehalfOf'],
      Repay: ['user'],
      LiquidationCall: ['user', 'liquidator']
    };

    const lendingPoolContract = await this.getPool();
    for (const [eventName, eventArgs] of Object.entries(events)) {
      console.log(`${logPrefix} Fetching new event name: ${eventName}, args: ${eventArgs.join(', ')}`);
      const fetchedAccounts = await FetchAllEventsAndExtractStringArray(
        lendingPoolContract,
        'lendingPool',
        eventName,
        eventArgs,
        this.lastUpdateBlock,
        targetBlockNumber,
        this.config.blockStepLimit
      );
      // merge with usersToUpdate
      usersToUpdate = Array.from(new Set(usersToUpdate.concat(fetchedAccounts)));
    }
    console.log(`${logPrefix} : found ${usersToUpdate.length} users to update`);
    return usersToUpdate;
  }
}
