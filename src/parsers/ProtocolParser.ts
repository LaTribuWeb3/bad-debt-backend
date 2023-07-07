import BigNumber from 'bignumber.js';
import { UnmanagedSubscriber, ethers } from 'ethers';
import { retry, sleep } from '../utils/Utils';
import { ParserResult, UserData } from '../utils/Types';
import { MonitoringData, MonitoringStatusEnum, RecordMonitoring } from '../utils/MonitoringHelper';
import { UploadJsonFile } from '../utils/GithubHelper';
import fs from 'fs';
import path from 'path';
import { CONSTANTS } from '../utils/Constants';

/**
 * This is the base class that every parser should inherit from
 */
export abstract class ProtocolParser {
  web3Provider: ethers.JsonRpcProvider;
  heavyUpdateInterval: number;
  fetchDelayInHours: number;
  runnerName: string;
  userListFullPath: string;
  userList: string[];
  users: { [key: string]: UserData };
  lastUpdateBlock: number;
  prices: { [tokenAddress: string]: number };
  outputJsonFileName: string;
  lastHeavyUpdate = 0;
  tvl = 0;
  borrows = 0;

  constructor(rpcURL: string, outputJsonFileName: string, heavyUpdateInterval = 24, fetchDelayInHours = 1) {
    this.runnerName = `${this.constructor.name}-Runner`;
    console.log(`runner name: ${this.runnerName}`);
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.userListFullPath = path.join(dataDir, `${this.runnerName}-userlist.json`);
    this.web3Provider = new ethers.JsonRpcProvider(rpcURL);
    this.heavyUpdateInterval = heavyUpdateInterval;
    this.fetchDelayInHours = fetchDelayInHours;
    this.userList = [];
    this.users = {};
    this.lastUpdateBlock = 0;
    this.prices = {};
    this.outputJsonFileName = outputJsonFileName;
  }

  async main(onlyOnce = false): Promise<ParserResult> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const start = Date.now();
        if (!onlyOnce) {
          await this.SendMonitoringData(MonitoringStatusEnum.RUNNING, Math.round(start / 1000));
        }

        const parserResult = await this.parseProtocol();
        // if onlyOnce is set, just return the result.
        // it is used for debugging or unit testing purpose
        if (onlyOnce) {
          return parserResult;
        }

        const runEndDate = Math.round(Date.now() / 1000);
        const durationSec = runEndDate - Math.round(start / 1000);
        await this.SendMonitoringData(
          MonitoringStatusEnum.SUCCESS,
          undefined,
          runEndDate,
          durationSec,
          this.lastUpdateBlock
        );

        // sleep for 'fetchDelayInHours' hours minus the time it took to run the parser
        const sleepTime = 1000 * 3600 * this.fetchDelayInHours - durationSec * 1000;
        if (sleepTime > 0) {
          console.log(`${this.runnerName}: sleeping ${Math.round(sleepTime / 1000)} seconds`);
          await sleep(sleepTime);
        }
      } catch (err) {
        console.error(`${this.runnerName}: An exception occurred: ${err}`);
        if (!onlyOnce) {
          await this.SendMonitoringData(
            MonitoringStatusEnum.ERROR,
            undefined,
            undefined,
            undefined,
            undefined,
            `An exception occurred: ${err}`
          );

          // if an error occurs, the process will restart after 10 minutes
          console.log('sleeping 10 minutes before restarting');
          await sleep(1000 * 10 * 60);
        } else {
          // if onlyOnce == true, rethrow
          throw err;
        }
      }
    }
  }

  /**
   * this is the base function that CAN be overriden for certains parsers
   * Example: MIM markets because of the number of calderons
   * @returns
   */
  async parseProtocol() {
    await this.initPrices();

    if (!this.prices || Object.keys(this.prices).length == 0) {
      throw new Error('this.prices is not initialized');
    }

    const { currBlockNumber, currTime } = await this.getBlockNumAndTime();
    if (!currTime) {
      throw new Error('Could not get currTime');
    }

    await this.fetchUsersData(currBlockNumber);

    if (!this.userList || this.userList.length == 0) {
      throw new Error('this.userList is not initialized');
    }
    if (!this.users || Object.keys(this.users).length == 0) {
      throw new Error('this.users is not initialized');
    }

    console.log(`${this.runnerName}: computing bad debt`);
    const parserResult = await this.calcBadDebt(currTime);
    console.log(`${this.runnerName}: bad debt calculation ended`);
    this.lastUpdateBlock = currBlockNumber;

    console.log(`${this.runnerName}: sending results for file ${this.outputJsonFileName}`);
    await this.sendResults(parserResult);
    console.log(`${this.runnerName}: parser results sent for file ${this.outputJsonFileName}`);
    return parserResult;
  }

  /**
   * Send the parsing results, should not be overriden unless for testing
   * @param parserResult
   */
  async sendResults(parserResult: ParserResult) {
    await UploadJsonFile(JSON.stringify(parserResult), this.outputJsonFileName);
  }

  async getBlockNumAndTime() {
    const currBlockNumber = (await retry(() => this.web3Provider.getBlockNumber(), [])) - 10;
    const currTime = (await retry(() => this.web3Provider.getBlock(currBlockNumber), []))?.timestamp;

    return { currBlockNumber, currTime };
  }

  // this method can be overwritten for test purpose
  async SendMonitoringData(
    status: MonitoringStatusEnum,
    start?: number,
    end?: number,
    duration?: number,
    blockFetched?: number,
    error?: string
  ) {
    const m: MonitoringData = {
      name: this.runnerName,
      type: 'Bad Debt',
      status: status,
      runEvery: this.fetchDelayInHours * 60 * 60
    };

    if (start) {
      m.lastStart = start;
    }

    if (end) {
      m.lastEnd = end;
    }

    if (duration) {
      m.lastDuration = duration;
    }

    if (blockFetched) {
      m.lastBlockFetched = blockFetched;
    }

    if (error) {
      m.error = error;
    }

    await RecordMonitoring(m);
  }

  /**
   * This function MUST initialize this.prices
   */
  abstract initPrices(): Promise<void>;

  abstract getFallbackPrice(address: string): Promise<number>;

  /**
   * This function MUST initialize this.users and this.userList
   * @param blockNumber the blocknumber until where to search for events
   */
  abstract fetchUsersData(blockNumber: number): Promise<void>;

  /**
   * Return additional collateral balance (in $) for a user
   * used for Iron Bank specific incidents for example
   * @param userAddress the user address
   * @returns user additional collateral value in $
   */
  async additionalCollateralBalance(userAddress: string): Promise<number> {
    // console.log(`additionalCollateralBalance[${userAddress}]: 0`);
    return 0;
  }

  /**
   * Calculate protocol bad debt
   * Bad debt is simple: for every user that as less collateral (in $) than debt (in $), we add bad debt
   * @param currTime
   * @returns
   */
  async calcBadDebt(currTime: number): Promise<ParserResult> {
    let tvl = 0;
    let totalBorrow = 0;
    let totalCollateral = 0;
    let sumOfBadDebt = 0;
    const usersWithBadDebt: { user: string; badDebt: string }[] = [];

    for (const [user, data] of Object.entries(this.users)) {
      // sum user debts in $
      let userDebt = 0;
      for (const [debtTokenAddress, debtAmount] of Object.entries(data.debts)) {
        // get price for token
        const tokenPrice = this.prices[debtTokenAddress];
        if (!tokenPrice) {
          throw new Error(`Could not find token price for ${debtTokenAddress}`);
        }

        userDebt += tokenPrice * debtAmount;
      }

      // sum user collateral in $
      let userCollateral = 0;
      for (const [collateralTokenAddress, collateralAmount] of Object.entries(data.collaterals)) {
        // get price for token
        const tokenPrice = this.prices[collateralTokenAddress];
        if (!tokenPrice) {
          throw new Error(`Could not find token price for ${collateralTokenAddress}`);
        }

        userCollateral += tokenPrice * collateralAmount;
      }

      // add optional aditional user collateral in $
      const additionalCollateral = await this.additionalCollateralBalance(user);
      if (additionalCollateral > 0) {
        console.log(`${this.runnerName}: adding additional collateral for user ${user}: ${additionalCollateral}`);
        userCollateral += additionalCollateral;
      }

      const userNetValue = userCollateral - userDebt;
      totalBorrow += userDebt;
      totalCollateral += userCollateral;
      tvl += userNetValue;

      if (userNetValue < 0) {
        //const result = await this.comptroller.methods.getAccountLiquidity(user).call()
        // console.log(`${this.runnerName}: bad debt for user ${user}: ${userNetValue}`);
        sumOfBadDebt += userNetValue;

        // console.log(`${this.runnerName}: total bad debt: ${sumOfBadDebt}`);

        usersWithBadDebt.push({ user: user, badDebt: new BigNumber(userNetValue).times(CONSTANTS.BN_1E18).toFixed() });
      }
    }

    // if the class did not initialized this.tvl and this.borrow, set them to calculated value
    if (!this.tvl) {
      this.tvl = tvl;
    }
    if (!this.borrows) {
      this.borrows = totalBorrow;
    }

    console.log(`${this.runnerName} tvl: ${this.tvl}`);
    console.log(`${this.runnerName} borrows: ${this.borrows}`);
    console.log(`${this.runnerName} bad debt: ${sumOfBadDebt}`);

    return {
      total: new BigNumber(sumOfBadDebt).times(CONSTANTS.BN_1E18).toFixed(),
      updated: currTime.toString(),
      decimals: '18',
      users: usersWithBadDebt,
      tvl: new BigNumber(this.tvl).times(CONSTANTS.BN_1E18).toFixed(),
      deposits: new BigNumber(totalCollateral).times(CONSTANTS.BN_1E18).toFixed(),
      borrows: new BigNumber(this.borrows).times(CONSTANTS.BN_1E18).toFixed(),
      calculatedBorrows: new BigNumber(totalBorrow).times(CONSTANTS.BN_1E18).toFixed()
    };
  }
}

export interface UserListDataStore {
  lastBlockFetched: number;
  userList: string[];
}
