import * as dotenv from 'dotenv';
import config from '../configs/ApeswapRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function ApeswapRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = 'ApeswapParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'BSC_apeswap.json', 24, 1);
  await parser.main();
}

ApeswapRunner();
