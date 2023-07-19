import * as dotenv from 'dotenv';
import multiNetworkConfig from '../configs/GranaryRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { GranaryParser } from '../parsers/aave/GranaryParser';
dotenv.config();

const fileNameMap = {
  FANTOM: 'FTM_granary.json',
  OPTIMISM: 'optimism_granary.json'
};

async function GranaryRunner() {
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

  const runnerName = `GranaryParser-${config.network}-Runner`;
  const jsonFileName = fileNameMap[networkToUse.toUpperCase() as keyof typeof fileNameMap];
  const parser = new GranaryParser(config, runnerName, rpcUrl, jsonFileName, 24, 1);
  await parser.main();
}

GranaryRunner();
