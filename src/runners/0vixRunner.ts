import * as dotenv from 'dotenv';
import config from '../configs/0vixRunnerConfig.json';
import { GetRpcUrlForNetwork } from '../utils/Utils';
import { CompoundParser } from '../parsers/compound/CompoundParser';
dotenv.config();

async function _0vixRunner() {
  const rpcUrl = GetRpcUrlForNetwork(config.network);
  if (!rpcUrl) {
    throw new Error(`Could not find rpc url in env variable for network ${config.network}`);
  }

  const runnerName = '_0vixParser-Runner';
  const parser = new CompoundParser(config, runnerName, rpcUrl, 'polygon_0vix.json', 24, 1);
  await parser.main();
}

_0vixRunner();
