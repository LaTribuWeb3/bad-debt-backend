import { ComptrollerVenus__factory } from '../../contracts/types';
import { FetchAllEventsAndExtractStringArray } from '../../utils/EventHelper';
import { LoadUserListFromDisk, SaveUserListToDisk } from '../../utils/UserHelper';
import { CompoundParser } from './CompoundParser';

const BLOCK_DIAMOND_PROXY = 32_139_323;

export class VenusParser extends CompoundParser {
  override async processHeavyUpdate(targetBlockNumber: number): Promise<string[]> {
    this.userList = [];
    let firstBlockToFetch = this.config.deployBlock;

    // load users from disk file if any
    const storedUserData = LoadUserListFromDisk(this.userListFullPath);
    if (storedUserData) {
      this.userList = storedUserData.userList;
      firstBlockToFetch = storedUserData.lastBlockFetched + 1;
    }

    if (firstBlockToFetch < BLOCK_DIAMOND_PROXY) {
      // first we fetch up to 'BLOCK_DIAMOND_PROXY' block with old abi
      const newUserList = await FetchAllEventsAndExtractStringArray(
        this.comptroller,
        'comptroller',
        'MarketEntered',
        ['account'],
        firstBlockToFetch,
        BLOCK_DIAMOND_PROXY - 1,
        this.config.blockStepLimit
      );

      // save user list in disk file
      this.userList = Array.from(new Set(this.userList.concat(newUserList)));
      SaveUserListToDisk(this.userListFullPath, this.userList, targetBlockNumber);
      firstBlockToFetch = BLOCK_DIAMOND_PROXY;
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

    // return full user list to be updated
    return this.userList;
  }
}
