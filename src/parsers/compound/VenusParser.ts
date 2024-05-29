import { ComptrollerVenus__factory } from '../../contracts/types';
import { FetchAllEventsAndExtractStringArray } from '../../utils/EventHelper';
import { LoadUserListFromDisk, SaveUserListToDisk } from '../../utils/UserHelper';
import { CompoundConfig } from './CompoundConfig';
import { CompoundParser } from './CompoundParser';
import { VenusConfig } from './VenusConfig';

export class VenusParser extends CompoundParser {
  diamondProxyFirstBlock: number; // this is the first block where we have a MarketEntered event with both indexed fields (new ABI from venus)
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
    console.log(`VenusParser: diamond block: ${this.diamondProxyFirstBlock}`);
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
}
