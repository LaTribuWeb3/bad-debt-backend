import * as dotenv from 'dotenv';
import { ApeswapParser } from '../parsers/compound/ApeswapParser';
import config from '../configs/ApeswapRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
dotenv.config();

async function ApeswapRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const parser = new ApeswapParser(config, rpcUrl, 'bsc_apeswap.json', 24, 1);
  await parser.main();
}

ApeswapRunner();
