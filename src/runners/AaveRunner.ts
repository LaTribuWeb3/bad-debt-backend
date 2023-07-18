import * as dotenv from 'dotenv';
import multiNetworkConfig from '../configs/AaveRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { AaveParser } from '../parsers/aave/AaveParser';
dotenv.config();

async function AaveRunner() {
  const config = multiNetworkConfig['ETH'];
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'AaveParser-Runner';
  const parser = new AaveParser(config, runnerName, rpcUrl, 'ethereum_aave.json', 24, 1);
  await parser.main();
}

AaveRunner();
