import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { CONSTANT_1e18, retry, sleep } from '../utils/utils';
import { ParserResult, UserData } from '../utils/types';

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

  async main() {
    let mainCntr = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      this.prices = await this.initPrices();

      const currBlockNumber = (await retry(() => this.web3Provider.getBlockNumber(), [])) - 10;
      const currTime = (await retry(() => this.web3Provider.getBlock(currBlockNumber), []))?.timestamp;

      if (!currTime) {
        throw new Error('Could not get currTime');
      }

      if (mainCntr % this.heavyUpdateInterval == 0) {
        console.log(`${this.runnerName}: heavyUpdate start`);
        await this.heavyUpdate(currBlockNumber);
        console.log(`${this.runnerName}: heavyUpdate success, current userList contains ${this.userList.length} users`);
      } else {
        console.log(`${this.runnerName}: lightUpdate start`);
        await this.lightUpdate(currBlockNumber);
        console.log(`${this.runnerName}: lightUpdate success`);
      }
      console.log(`${this.runnerName}: calc bad debt`);
      const parserResult = await this.calcBadDebt(currTime);

      console.log(`${this.runnerName}: ${JSON.stringify(parserResult)}`);
      this.lastUpdateBlock = currBlockNumber;

      // don't  increase cntr, this way if heavy update is needed, it will be done again next time
      console.log(`${this.runnerName}: sleeping ${this.fetchDelayInHours} hour(s). Fetch counter: ${mainCntr++}`);
      await sleep(1000 * 3600 * this.fetchDelayInHours);
    }
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
          throw new Error(`Could not find token price for ${tokenPrice}`);
        }

        userDebt += tokenPrice * debtAmount;
      }

      // sum user collateral in $
      let userCollateral = 0;
      for (const [collateralTokenAddress, collateralAmount] of Object.entries(data.collaterals)) {
        // get price for token
        const tokenPrice = this.prices[collateralTokenAddress];
        if (!tokenPrice) {
          throw new Error(`Could not find token price for ${tokenPrice}`);
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
