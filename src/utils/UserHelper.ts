import fs from 'fs';

export interface StoredUserData {
  lastBlockFetched: number;
  userList: string[];
}

export function LoadUserListFromDisk(userDataFullpath: string): StoredUserData | undefined {
  if (fs.existsSync(userDataFullpath)) {
    const savedData: StoredUserData = JSON.parse(fs.readFileSync(userDataFullpath, 'utf-8'));
    if (savedData.lastBlockFetched && savedData.userList) {
      console.log(`loadUserListFromDisk: found ${savedData.userList.length} users from ${userDataFullpath}`);
      return savedData;
    }
  } else {
    console.log(`loadUserListFromDisk: Could not find saved data file ${userDataFullpath}`);
  }

  return;
}

export function SaveUserListToDisk(userDataFullpath: string, userList: string[], lastFetchedBlock: number) {
  const userDataToSave: StoredUserData = {
    lastBlockFetched: lastFetchedBlock,
    userList: userList
  };

  console.log(`saveUserListToDisk: Saving ${userList.length} users to file ${userDataFullpath}`);
  fs.writeFileSync(userDataFullpath, JSON.stringify(userDataToSave));
}
