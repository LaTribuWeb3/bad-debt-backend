import { CompoundOracle__factory } from '../../contracts/types';
import { ExecuteMulticall, MulticallParameter } from '../../utils/MulticallHelper';
import { GetPrice } from '../../utils/PriceHelper';
import { GetChainToken, GetTokenInfos, TokenInfos } from '../../utils/TokenHelper';
import { normalize, retry } from '../../utils/Utils';
import { CompoundParser } from './CompoundParser';

const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';

/**
 * Ionic parser is a compound fork with specific getFallbackprice because the Ionic oracle returns the price in WETH
 * Because we want the price in usd: we simply multiply the oracle price by the weth price in usd.
 * Also the 'exchangeRateDecimals' in the updateUsersWithMulticall is set to 18 and not 18 - 8 + token decimals
 */
export class IonicParser extends CompoundParser {
  override async getFallbackPrice(address: string): Promise<number> {
    if (!this.oracleAddress) {
      this.oracleAddress = await retry(this.comptroller.oracle, []);
    }

    const oracleContract = CompoundOracle__factory.connect(this.oracleAddress, this.web3Provider);

    let underlyingTokenInfos: TokenInfos | undefined = undefined;
    if (this.config.cETHAddresses.some((_) => _.toLowerCase() == address.toLowerCase())) {
      underlyingTokenInfos = GetChainToken(this.config.network);
    } else {
      underlyingTokenInfos = await GetTokenInfos(this.config.network, this.underlyings[address]);
    }
    // The price of the asset in USD as an unsigned integer scaled up by 10 ^ (36 - underlying asset decimals)
    const underlyingPrice = await retry(oracleContract.getUnderlyingPrice, [address]);

    const wethPrice = await GetPrice(this.config.network, WETH_ADDRESS, this.web3Provider);
    return normalize(underlyingPrice, 36 - underlyingTokenInfos.decimals) * wethPrice;
  }

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
        // ignore market not in protocol market list
        if (!this.markets.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          // console.log(`ignoring market ${market} from userAssetsIn because not in this.markets`);
          continue;
        }
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
        if (!this.markets.some((_) => _.toLowerCase() == market.toString().toLowerCase())) {
          // console.log(`ignoring market ${market} from userAssetsIn because not in this.markets`);
          continue;
        }
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
        const exchangeRateDecimals = 18;
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
