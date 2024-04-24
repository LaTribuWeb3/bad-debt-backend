import * as dotenv from 'dotenv';
import multiNetworkConfig from '../configs/KinzaRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { KinzaParser } from '../parsers/kinza/KinzaParser';
dotenv.config();

const fileNameMap = {
  BSC: 'bsc_kinza.json',
  ETH: 'ethereum_kinza.json'
};

async function KinzaRunner() {
  const networkToUse = process.argv[2];
  if (!networkToUse) {
    throw new Error(
      `Cannot start granary runner without network as first argument. Available networks: ${Object.keys(
        multiNetworkConfig
      ).join(', ')}`
    );
  }
  const config = multiNetworkConfig[networkToUse as keyof typeof multiNetworkConfig];

  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = `KinzaParser-${config.network}-Runner`;
  const jsonFileName = fileNameMap[networkToUse.toUpperCase() as keyof typeof fileNameMap];

  const parser = new KinzaParser(config, runnerName, rpcUrl, jsonFileName, 24, 1);
  await parser.main();
}

KinzaRunner();
