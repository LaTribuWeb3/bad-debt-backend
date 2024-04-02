import axios from 'axios';

interface Platform {
  platform: string;
  counter: number;
}

// async function frontendDataUnifier() {
//   const headDirectory = 'bad-debt';
//   const githubDirName = 'latest';
//   const dirToGet = headDirectory + '/' + githubDirName + '/';

//   console.log('frontendDataUnifier: loading files from github');
//   const allDirs = await axios.get(
//     'https://api.github.com/repos/Risk-DAO/simulation-results/git/trees/main?recursive=1'
//   );
//   const loadedFiles = allDirs.data.tree.map((_) => _.path);
//   console.log(`getFileNames: loaded ${loadedFiles.length} files from github`);

//   const selectedFiles = loadedFiles.filter((_: string) => _.startsWith(dirToGet));
//   const fileNames = selectedFiles.map((_: string) => _.split('/').slice(-1)[0]);
//   const platformsCount: Platform[] = [];

//   fileNames.forEach((filename: string) => {
//     const platform = filename.replace('.json', '').split('_')[1];
//     const indexOfPlatform = platformsCount.findIndex((_) => _.platform === platform);
//     if (indexOfPlatform >= 0) {
//       platformsCount[indexOfPlatform].counter++;
//     } else {
//       platformsCount.push({
//         platform: platform,
//         counter: 1
//       });
//     }
//   });
// }
