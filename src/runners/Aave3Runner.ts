import * as dotenv from 'dotenv';
import multiNetworkConfig from '../configs/AaveV3RunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { Aave3Parser } from '../parsers/aave3/Aave3Parser';
dotenv.config();

const fileNameMap = {
  ETH: 'ETH_AAVE3.json'
};

async function Aave3Runner() {
  const networkToUse = process.argv[2];
  if (!networkToUse) {
    throw new Error(
      `Cannot start aave3 runner without network as first argument. Available networks: ${Object.keys(
        multiNetworkConfig
      ).join(', ')}`
    );
  }
  const config = multiNetworkConfig[networkToUse as keyof typeof multiNetworkConfig];
  if(!config) {
    throw new Error(`Could not find config for ${networkToUse} in the networks definitions`);
  }
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = `Aave3Parser-${config.network}-Runner`;
  const jsonFileName = fileNameMap[networkToUse.toUpperCase() as keyof typeof fileNameMap];
  const parser = new Aave3Parser(config, runnerName, rpcUrl, jsonFileName, 24, 1);
  await parser.main();
}

Aave3Runner();
