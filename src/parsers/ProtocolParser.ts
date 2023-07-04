import { ethers } from 'ethers';
import { retry } from '../utils/utils';
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
      const parserResult = this.calcBadDebt(currTime);

      console.log(`${this.runnerName}: ${JSON.stringify(parserResult)}`);
      this.lastUpdateBlock = currBlockNumber;

      // don't  increase cntr, this way if heavy update is needed, it will be done again next time
      console.log('sleeping', mainCntr++);
    }
  }

  abstract initPrices(): Promise<{ [tokenAddress: string]: number }>;

  abstract heavyUpdate(blockNumber: number): Promise<void>;
  abstract lightUpdate(blockNumber: number): Promise<void>;

  calcBadDebt(currTime: number): ParserResult {
    let tvl18Decimals = '0';
    let totalBorrow18Decimals = '0';
    let totalCollateral18Decimals = '0';
    let sumOfBadDebt18Decimals = '0';
    const usersWithBadDebt: { user: string; badDebt: string }[] = [];

    // for (const [user, data] of Object.entries(this.users)) {
    //   const userData = new User(user, data.marketsIn, data.borrowBalance, data.collateralBalace, data.error);
    //   //console.log({user})
    //   const additionalCollateral = await this.additionalCollateralBalance(user);
    //   const userValue = userData.getUserNetValue(this.web3, this.prices);

    //   //console.log("XXX", user, userValue.collateral.toString(), additionalCollateral.toString())
    //   deposits = deposits.add(userValue.collateral).add(additionalCollateral);
    //   borrows = borrows.add(userValue.debt);

    //   const netValue = this.web3.utils.toBN(userValue.netValue).add(additionalCollateral);
    //   tvl = tvl.add(netValue).add(additionalCollateral);

    //   if (this.web3.utils.toBN(netValue).lt(this.web3.utils.toBN('0'))) {
    //     //const result = await this.comptroller.methods.getAccountLiquidity(user).call()
    //     console.log('bad debt for user', user, Number(netValue.toString()) / 1e6 /*, {result}*/);
    //     this.sumOfBadDebt = this.sumOfBadDebt.add(this.web3.utils.toBN(netValue));

    //     console.log('total bad debt', Number(this.sumOfBadDebt.toString()) / 1e6);

    //     userWithBadDebt.push({ user: user, badDebt: netValue.toString() });
    //   }
    // }

    return {
      borrows: totalBorrow18Decimals,
      decimals: 18,
      deposits: totalCollateral18Decimals,
      tvl: tvl18Decimals,
      users: usersWithBadDebt,
      total: sumOfBadDebt18Decimals,
      updated: currTime
    };
  }
}
