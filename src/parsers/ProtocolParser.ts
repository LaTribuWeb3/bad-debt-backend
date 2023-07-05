import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { CONSTANT_1e18, retry, sleep } from '../utils/Utils';
import { ParserResult, UserData } from '../utils/Types';
import { MonitoringStatusEnum, RecordMonitoring } from '../utils/MonitoringHelper';

/**
 * This is the base class that every parser should inherit from
 */
export abstract class ProtocolParser {
  web3Provider: ethers.JsonRpcProvider;
  heavyUpdateInterval: number;
  fetchDelayInHours: number;
  runnerName: string;
  userListFileName: string;
  userList: string[];
  users: { [key: string]: UserData };
  lastUpdateBlock: number;
  prices: { [tokenAddress: string]: number };

  constructor(rpcURL: string, heavyUpdateInterval = 24, fetchDelayInHours = 1) {
    this.runnerName = `${this.constructor.name}-Runner`;
    console.log(`runner name: ${this.runnerName}`);
    this.userListFileName = `${this.runnerName}-userlist.json`;
    this.web3Provider = new ethers.JsonRpcProvider(rpcURL);
    this.heavyUpdateInterval = heavyUpdateInterval;
    this.fetchDelayInHours = fetchDelayInHours;
    this.userList = [];
    this.users = {};
    this.lastUpdateBlock = 0;
    this.prices = {};
  }

  async main(onlyOnce = false): Promise<ParserResult> {
    let mainCntr = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const start = Date.now();
        await RecordMonitoring({
          name: this.runnerName,
          type: 'Bad Debt',
          lastStart: Math.round(start / 1000),
          runEvery: this.fetchDelayInHours * 60, // run every fetchDelayInHours hours
          status: MonitoringStatusEnum.RUNNING
        });
        this.prices = await this.initPrices();

        const { currBlockNumber, currTime } = await this.getBlockNumAndTime();
        if (!currTime) {
          throw new Error('Could not get currTime');
        }

        if (mainCntr % this.heavyUpdateInterval == 0) {
          console.log(`${this.runnerName}: heavyUpdate start`);
          await this.heavyUpdate(currBlockNumber);
          console.log(
            `${this.runnerName}: heavyUpdate success, current userList contains ${this.userList.length} users`
          );
        } else {
          console.log(`${this.runnerName}: lightUpdate start`);
          await this.lightUpdate(currBlockNumber);
          console.log(`${this.runnerName}: lightUpdate success`);
        }
        console.log(`${this.runnerName}: calc bad debt`);
        const parserResult = await this.calcBadDebt(currTime);

        console.log(`${this.runnerName}: ${JSON.stringify(parserResult)}`);
        this.lastUpdateBlock = currBlockNumber;

        const runEndDate = Math.round(Date.now() / 1000);
        await RecordMonitoring({
          name: this.runnerName,
          type: 'Bad Debt',
          status: MonitoringStatusEnum.SUCCESS,
          lastEnd: runEndDate,
          lastDuration: runEndDate - Math.round(start / 1000)
        });
        // if onlyOnce is set, just return the result.
        // it is used for debugging or unit testing purpose
        if (onlyOnce) {
          return parserResult;
        }

        console.log(`${this.runnerName}: sleeping ${this.fetchDelayInHours} hour(s). Fetch counter: ${mainCntr++}`);
        await sleep(1000 * 3600 * this.fetchDelayInHours);
      } catch (err) {
        await RecordMonitoring({
          name: this.runnerName,
          type: 'Bad Debt',
          status: MonitoringStatusEnum.ERROR,
          error: `An exception occurred: ${err}`
        });

        // if an error occurs, the process will restart after 10 minutes
        await sleep(1000 * 10 * 60);
      }
    }
  }

  async getBlockNumAndTime() {
    const currBlockNumber = (await retry(() => this.web3Provider.getBlockNumber(), [])) - 10;
    const currTime = (await retry(() => this.web3Provider.getBlock(currBlockNumber), []))?.timestamp;

    return { currBlockNumber, currTime };
  }

  abstract initPrices(): Promise<{ [tokenAddress: string]: number }>;

  abstract heavyUpdate(blockNumber: number): Promise<void>;
  abstract lightUpdate(blockNumber: number): Promise<void>;

  /**
   * Return additional collateral balance (in $) for a user
   * used for Iron Bank specific incidents for example
   * @param userAddress the user address
   * @returns user additional collateral value in $
   */
  async additionalCollateralBalance(userAddress: string): Promise<number> {
    console.log(`additionalCollateralBalance[${userAddress}]: 0`);
    return 0;
  }

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
        console.log(`${this.runnerName}: bad debt for user ${user}: ${userNetValue}`);
        sumOfBadDebt += userNetValue;

        console.log(`${this.runnerName}: total bad debt: ${sumOfBadDebt}`);

        usersWithBadDebt.push({ user: user, badDebt: new BigNumber(userNetValue).times(CONSTANT_1e18).toFixed() });
      }
    }

    return {
      borrows: new BigNumber(totalBorrow).times(CONSTANT_1e18).toFixed(),
      decimals: 18,
      deposits: new BigNumber(totalCollateral).times(CONSTANT_1e18).toFixed(),
      tvl: new BigNumber(tvl).times(CONSTANT_1e18).toFixed(),
      users: usersWithBadDebt,
      total: new BigNumber(sumOfBadDebt).times(CONSTANT_1e18).toFixed(),
      updated: currTime
    };
  }
}
