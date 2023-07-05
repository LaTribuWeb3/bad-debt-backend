import BigNumber from 'bignumber.js';
import { ProtocolParser } from '../src/parsers/ProtocolParser';
import { CONSTANT_1e18 } from '../src/utils/Utils';
import { UserData } from '../src/utils/Types';
import { MonitoringStatusEnum } from '../src/utils/MonitoringHelper';

class TestParser extends ProtocolParser {
  injectedPrices: { [tokenAddress: string]: number } | undefined;
  injectedUsers: { [key: string]: UserData } | undefined;

  override async SendMonitoringData(
    status: MonitoringStatusEnum,
    start?: number | undefined,
    end?: number | undefined,
    duration?: number | undefined,
    blockFetched?: number | undefined,
    error?: string | undefined
  ): Promise<void> {
    // do nothing
  }

  async getBlockNumAndTime() {
    return { currBlockNumber: 10, currTime: 125 };
  }
  initPrices(): Promise<{ [tokenAddress: string]: number }> {
    if (!this.injectedPrices) {
      throw new Error('Need injected prices for TestParser');
    }

    return Promise.resolve(this.injectedPrices);
  }

  heavyUpdate(blockNumber: number): Promise<void> {
    if (!this.injectedUsers) {
      throw new Error('Need injectedUsers for TestParser');
    }

    this.users = this.injectedUsers;
    this.userList = Object.keys(this.injectedUsers);
    return Promise.resolve();
  }

  lightUpdate(blockNumber: number): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

function getInjectedPrices() {
  return {
    tokenA: 1,
    tokenB: 10,
    tokenC: 100
  };
}

// create 2 users
// u1 has no bad debt
// u2 has no bad debt either
function getUsersWithoutBadDebt() {
  return {
    u1: {
      collaterals: {
        tokenA: 0,
        tokenB: 0,
        tokenC: 100
      },
      debts: {
        tokenA: 10,
        tokenB: 0,
        tokenC: 0
      }
    },
    u2: {
      collaterals: {
        tokenA: 1000,
        tokenB: 10,
        tokenC: 0
      },
      debts: {
        tokenA: 0,
        tokenB: 0,
        tokenC: 10
      }
    }
  };
}

// create 2 users
// u1 has no bad debt
// u2 has bad debt
function getUsersWithBadDebt() {
  return {
    u1: {
      collaterals: {
        tokenA: 0,
        tokenB: 0,
        tokenC: 100
      },
      debts: {
        tokenA: 10,
        tokenB: 0,
        tokenC: 0
      }
    },
    u2: {
      collaterals: {
        tokenA: 0,
        tokenB: 10,
        tokenC: 0
      },
      debts: {
        tokenA: 0,
        tokenB: 0,
        tokenC: 10
      }
    }
  };
}

describe('testing Protocol Parser calc bad debt function', () => {
  test('Test Parser without Bad debt', async () => {
    const parser = new TestParser('http://fakeRpcUrl', 24, 1);

    parser.injectedPrices = getInjectedPrices();

    parser.injectedUsers = getUsersWithoutBadDebt();

    const parserResult = await parser.main(true);

    // should not have any users as bad debt
    const usersWithBadDebt = parserResult.users.map((_) => _.user);
    expect(usersWithBadDebt).toHaveLength(0);

    // user u2 has 10 tokenB as collateral and 10 tokenC as debt
    expect(parserResult.total).toBe('0');
  });

  test('Test Parser with Bad debt', async () => {
    const parser = new TestParser('http://fakeRpcUrl', 24, 1);

    parser.injectedPrices = getInjectedPrices();

    // create 2 users
    // u1 has no bad debt
    // u2 has bad debt
    parser.injectedUsers = getUsersWithBadDebt();

    const parserResult = await parser.main(true);

    const tokenAPrice = parser.injectedPrices['tokenA'];
    const tokenBPrice = parser.injectedPrices['tokenB'];
    const tokenCPrice = parser.injectedPrices['tokenC'];

    // borrows are 10 tokenA and 10 tokenC
    const totalBorrow = 10 * tokenAPrice + 10 * tokenCPrice;
    const totalBorrow18Decimals = new BigNumber(totalBorrow).times(CONSTANT_1e18).toFixed();
    expect(parserResult.borrows).toBe(totalBorrow18Decimals);

    // collateral are 10 tokenB and 100 token C
    const totalCollateral = 10 * tokenBPrice + 100 * tokenCPrice;
    const totalCollateral18Decimals = new BigNumber(totalCollateral).times(CONSTANT_1e18).toFixed();
    expect(parserResult.deposits).toBe(totalCollateral18Decimals);

    // user u2 should be in the users with bad debt
    const usersWithBadDebt = parserResult.users.map((_) => _.user);
    expect(usersWithBadDebt).toContain('u2');

    // user u2 has 10 tokenB as collateral and 10 tokenC as debt
    const u2BadDebt = 10 * tokenBPrice - 10 * tokenCPrice;
    const u2BadDebt18Decimals = new BigNumber(u2BadDebt).times(CONSTANT_1e18).toFixed();
    expect(parserResult.total).toBe(u2BadDebt18Decimals);
  });
});
