import { ERC20__factory } from '../../contracts/types';
import { GetPrice, fetchZapperTotal } from '../../utils/PriceHelper';
import { GetTokenInfos } from '../../utils/TokenHelper';
import { normalize } from '../../utils/Utils';
import { ComputeUserValue } from '../ProtocolParser';
import { CompoundParser } from './CompoundParser';

/**
 * IronBank parser is a compound fork with specific additionalCollateralBalance
 */
export class IronBankParser extends CompoundParser {
  async balanceValue(token: string, user: string) {
    const alphaTokenContract = ERC20__factory.connect(token, this.web3Provider);
    const balance = await alphaTokenContract.balanceOf(user);
    const tokenInfos = await GetTokenInfos(this.config.network, token);
    const normalizedBalance = normalize(balance, tokenInfos.decimals);
    const price = await GetPrice(this.config.network, token, this.web3Provider);
    return price * normalizedBalance;
  }

  override async additionalCollateralBalance(userAddress: string): Promise<number> {
    if (userAddress === '0x560A8E3B79d23b0A525E15C6F3486c6A293DDAd2') {
      console.log('alpha homora v1 incident');
      const alphaTokenAddress = '0xa1faa113cbE53436Df28FF0aEe54275c13B40975';
      const alphaEscrowAddress = '0xB80C75B574715404dB4B5097688B3338fE637953';
      const alphaTokenCollateralValue = await this.balanceValue(alphaTokenAddress, alphaEscrowAddress);
      return alphaTokenCollateralValue;
    } else if (userAddress === '0xba5eBAf3fc1Fcca67147050Bf80462393814E54B') {
      console.log('alpha homora v2');
      const alphaHomoraLPTokenNFT = '0x06799a1e4792001AA9114F0012b9650cA28059a3';
      const result = await fetchZapperTotal(alphaHomoraLPTokenNFT);
      return result;
    } else if (userAddress === '0xcDDBA405f8129e5bAe101045aa45aCa11C03b1c8') {
      console.log('cream');
      const creamTokenAddress = '0x2ba592F78dB6436527729929AAf6c908497cB200';
      return await this.balanceValue(creamTokenAddress, userAddress);
    } else if (userAddress === '0x085682716f61a72bf8C573FBaF88CCA68c60E99B') {
      console.log('ice');
      const iceTokenAddress = '0xf16e81dce15B08F326220742020379B855B87DF9';
      return await this.balanceValue(iceTokenAddress, userAddress);
    } else if (userAddress === '0x9ae50BD64e45fd87dD05c768ff314b8FE246B3fF') {
      console.log('ftm');
      const ftmTokenAddress = '0x4E15361FD6b4BB609Fa63C81A2be19d873717870';
      return await this.balanceValue(ftmTokenAddress, userAddress);
    } else if (userAddress === '0x8338Aa899fB3168598D871Edc1FE2B4F0Ca6BBEF') {
      // yearm and fixed forex
      // first get debt of yearn and fixed forex 2, and substruct it from the extra collateral
      const otherYearnUser = '0x0a0B06322825cb979678C722BA9932E0e4B5fd90';
      let otherDebt = 0;
      const data = this.users[otherYearnUser];
      if (data) {
        const userValue = ComputeUserValue(data, this.prices);
        otherDebt = userValue.debtUsd;
        console.log('other debt', otherDebt.toString());
      }

      const zapperResult = await fetchZapperTotal('0x0D5Dc686d0a2ABBfDaFDFb4D0533E886517d4E83');

      return zapperResult - otherDebt;
    } else if (userAddress === '0x0a0B06322825cb979678C722BA9932E0e4B5fd90') {
      // fixed forex 2
      const otherYearnUser = '0x8338Aa899fB3168598D871Edc1FE2B4F0Ca6BBEF';
      let otherDebt = 0;
      const data = this.users[otherYearnUser];

      if (data) {
        const userValue = ComputeUserValue(data, this.prices);
        otherDebt = userValue.debtUsd;
        console.log('other debt', otherDebt.toString());
      }

      const zapperResult = await fetchZapperTotal('0x0D5Dc686d0a2ABBfDaFDFb4D0533E886517d4E83');

      return zapperResult - otherDebt;
    } else {
      return 0;
    }
  }
}
