import { BaseContract } from 'ethers';
import { CToken__factory, ComptrollerVenus__factory, VToken__factory } from '../../contracts/types';
import { FetchAllEventsAndExtractStringArray } from '../../utils/EventHelper';
import { ExecuteMulticall, MulticallParameter } from '../../utils/MulticallHelper';
import { GetPrice } from '../../utils/PriceHelper';
import { LoadUserListFromDisk, SaveUserListToDisk } from '../../utils/UserHelper';
import { normalize, retry, roundTo } from '../../utils/Utils';
import { CompoundConfig } from './CompoundConfig';
import { CompoundParser } from './CompoundParser';
import { VenusConfig } from './VenusConfig';

const VAI_ADDRESS = '0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7';

export class VenusParser extends CompoundParser {
  diamondProxyFirstBlock: number; // this is the first block where we have a MarketEntered event with both indexed fields (new ABI from venus)
  checkVai: boolean;
  constructor(
    config: VenusConfig,
    runnerName: string,
    rpcURL: string,
    outputJsonFileName: string,
    heavyUpdateInterval?: number,
    fetchDelayInHours?: number
  ) {
    super(config as CompoundConfig, runnerName, rpcURL, outputJsonFileName, heavyUpdateInterval, fetchDelayInHours);
    this.diamondProxyFirstBlock = config.diamondProxyFirstBlock;
    this.checkVai = config.checkVai;
    console.log(`VenusParser: diamond block: ${this.diamondProxyFirstBlock}`);
  }

  override getCTokenContract(marketAddress: string): BaseContract {
    if (this.checkVai) {
      // this is only for the Core Pool
      return CToken__factory.connect(marketAddress, this.web3Provider);
    }
    return VToken__factory.connect(marketAddress, this.web3Provider);
  }

  override async processHeavyUpdate(targetBlockNumber: number): Promise<string[]> {
    this.userList = [];
    let firstBlockToFetch = this.config.deployBlock;

    // load users from disk file if any
    const storedUserData = LoadUserListFromDisk(this.userListFullPath);
    if (storedUserData) {
      this.userList = storedUserData.userList;
      firstBlockToFetch = storedUserData.lastBlockFetched + 1;
    }

    if (firstBlockToFetch < this.diamondProxyFirstBlock) {
      // first we fetch up to 'this.diamondProxyFirstBlock' block with old abi
      const newUserList = await FetchAllEventsAndExtractStringArray(
        this.comptroller,
        'comptroller',
        'MarketEntered',
        ['account'],
        firstBlockToFetch,
        this.diamondProxyFirstBlock - 1,
        this.config.blockStepLimit
      );

      // save user list in disk file
      this.userList = Array.from(new Set(this.userList.concat(newUserList)));
      SaveUserListToDisk(this.userListFullPath, this.userList, this.diamondProxyFirstBlock - 1);
      firstBlockToFetch = this.diamondProxyFirstBlock;
    }

    // fetch new users since lastBlockFetched using the comptrollerDiamond instead of the other one
    const comptollerDiamond = ComptrollerVenus__factory.connect(this.config.comptrollerAddress, this.web3Provider);
    const newUserList = await FetchAllEventsAndExtractStringArray(
      comptollerDiamond,
      'comptroller',
      'MarketEntered',
      ['account'],
      firstBlockToFetch,
      targetBlockNumber,
      this.config.blockStepLimit
    );

    // merge into this.userList with old userList without duplicates
    this.userList = Array.from(new Set(this.userList.concat(newUserList)));
    SaveUserListToDisk(this.userListFullPath, this.userList, targetBlockNumber);

    // return full user list to be updated
    return this.userList;
  }

  override async fetchAdditionnalDebt(usersToUpdate: string[]) {
    if (this.checkVai) {
      // fetch vai price
      const vaiPrice = await GetPrice(this.config.network, VAI_ADDRESS, this.web3Provider);
      this.prices[VAI_ADDRESS] = vaiPrice;
      console.log(`VAI PRICE: ${this.prices[VAI_ADDRESS]}`);
      // then in batch, fetch users data using multicall
      let startIndex = 0;
      const mintedVAIsStep = 1000;
      while (startIndex < usersToUpdate.length) {
        let endIndex = startIndex + mintedVAIsStep;
        if (endIndex >= usersToUpdate.length) {
          endIndex = usersToUpdate.length;
        }

        const userAddresses = usersToUpdate.slice(startIndex, endIndex);
        console.log(
          `fetchAdditionnalDebt: fetching users VAI [${startIndex} -> ${endIndex - 1}]. Progress: ${roundTo(
            (endIndex / usersToUpdate.length) * 100
          )}%`
        );

        const mintedVaisParameters: MulticallParameter[] = [];

        for (const userAddress of userAddresses) {
          const mintedVaisParam: MulticallParameter = {
            targetAddress: this.config.comptrollerAddress,
            targetFunction: 'mintedVAIs(address)',
            inputData: [userAddress],
            outputTypes: ['uint256']
          };

          mintedVaisParameters.push(mintedVaisParam);
        }

        const mintedVaisResults = await retry(ExecuteMulticall, [
          this.config.network,
          this.web3Provider,
          mintedVaisParameters
        ]);

        let cursor = 0;
        for (const userAddress of userAddresses) {
          const userMintedVais = normalize(BigInt(mintedVaisResults[cursor++].toString()), 18);
          if (userMintedVais > 0) {
            if (!this.users[userAddress]) {
              this.users[userAddress] = {
                collaterals: {},
                debts: {}
              };
            }

            this.users[userAddress].debts[VAI_ADDRESS] = userMintedVais;
          }
        }

        startIndex += mintedVAIsStep;
      }
    } else {
      console.log('fetchAdditionnalDebt: noop');
    }
  }
}
