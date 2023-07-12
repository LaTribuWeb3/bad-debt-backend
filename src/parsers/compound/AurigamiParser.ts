import { ExecuteMulticall, MulticallParameter } from '../../utils/MulticallHelper';
import { GetChainToken, GetTokenInfos, TokenInfos } from '../../utils/TokenHelper';
import { normalize, retry } from '../../utils/Utils';
import { CompoundParser } from './CompoundParser';

/**
 * Aurigami parser is a compound fork with one specificity:
 * Contrary to normal CToken contracts, Aurigami CToken getAccountSnapshot function returns ['uint256', 'uint256', 'uint256']
 * instead of ['uint256', 'uint256', 'uint256', 'uint256']. That's why the 'updateUsersWithMulticall' function has been overriden here
 */
export class AurigamiParser extends CompoundParser {
  /**
   * Aurigami implemented getAccountSnapshot with only 3 uint256 as the return value (instead of 4 for compound)
   * This override is only needed for this change, nothing else changed from the compound function
   * @param userAddresses
   */
  override async updateUsersWithMulticall(userAddresses: string[]) {
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
        if (!this.markets.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          // console.log(`ignoring market ${market} from userAssetsIn because not in this.markets`);
          continue;
        }
        const snapshotParam: MulticallParameter = {
          targetAddress: market,
          targetFunction: 'getAccountSnapshot(address)',
          inputData: [selectedUser],
          outputTypes: ['uint256', 'uint256', 'uint256']
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
        if (!this.markets.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          // console.log(`ignoring market ${market} from userAssetsIn because not in this.markets`);
          continue;
        }
        const cTokenInfos = await GetTokenInfos(this.config.network, market.toString());
        let marketTokenInfos: TokenInfos | undefined = undefined;
        if (this.config.cETHAddresses.some((_) => _.toLowerCase() == market.toLowerCase())) {
          marketTokenInfos = GetChainToken(this.config.network);
        } else {
          marketTokenInfos = await GetTokenInfos(this.config.network, this.underlyings[market.toString()]);
        }
        // snapshot returns: (token balance, borrow balance, exchange rate mantissa)
        const collateralBalanceInCToken = snapshotResults[index][0];
        const normalizedCollateralBalanceInCToken = normalize(
          BigInt(collateralBalanceInCToken.toString()),
          cTokenInfos.decimals
        );
        const borrowBalance = snapshotResults[index][1];
        const exchangeRateMantissa = snapshotResults[index][2];

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
}
